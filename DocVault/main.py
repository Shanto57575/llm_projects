from dotenv import load_dotenv
from langchain_mistralai import ChatMistralAI
from langchain_huggingface import HuggingFaceEmbeddings
from fastapi import FastAPI, UploadFile, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.prompts import ChatPromptTemplate
from langchain_qdrant import QdrantVectorStore
from langchain_core.output_parsers import PydanticOutputParser
from qdrant_client import QdrantClient
from pydantic import BaseModel, Field
import os
import tempfile
import shutil
import uuid

# load_dotenv() reads your .env file and injects variables (API keys, URLs)
# into os.environ, so os.getenv("X") below can find them. Without this,
# os.getenv() would return None for anything defined only in .env.
load_dotenv()

app = FastAPI(title="DocVault API", version="1.0.0")

QDRANT_ENDPOINT = os.getenv("QDRANT_ENDPOINT")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
# Collection = like a "table" in Qdrant (vector DB). All PDF chunks from
# every uploaded file go into this single collection, separated only by
# metadata (document_id/filename), not by separate collections.
COLLECTION_NAME = "knowledge_base"

# Embedding model: turns text into a vector (list of numbers) that captures
# meaning. This is what lets us do "semantic search" later — finding chunks
# that are conceptually similar to a question, not just keyword matches.
# This one runs locally/free via HuggingFace (no API cost per embedding call).
embedding = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

# The actual LLM that will read retrieved context and generate an answer.
# temperature=0 -> deterministic, factual answers (no creative randomness).
# Good for RAG/QA where you want consistent, non-hallucinatory responses.
# max_retries=2 -> if the API call fails (network blip, rate limit), retry
# twice before giving up, instead of crashing on the first failure.
llm = ChatMistralAI(model="mistral-large-latest", temperature=0, max_retries=2)

# This is the instruction template sent to the LLM every time we ask a question.
# {pdf_data} gets replaced with the retrieved chunks (the "context").
# {question} gets replaced with the user's actual question.
# {format_instructions} gets replaced with auto-generated instructions telling
# the LLM exactly what JSON shape to reply in (see PydanticOutputParser below).
#
# The "Rules" section is prompt engineering to prevent hallucination: we
# explicitly force the LLM to only use the given context and give a fixed
# fallback sentence when the answer isn't in the document, instead of making
# something up.
prompt = ChatPromptTemplate([
    (
        "system",
        """You are a helpful AI assistant for document question answering.

Answer the user's question using ONLY the provided context.

Context:
{pdf_data}

Rules:
1. Use only the provided context.
2. Do not use your own knowledge.
3. You may summarize or combine information from multiple retrieved context passages.
4. Do not introduce information that is not supported by the provided context.
5. If the answer cannot be found in the context, reply exactly:
   "I don't have enough information in the provided document to answer this question."
6. Keep your answer clear, concise, and factual.

{format_instructions}"""
    ),
    ("human", "{question}")
])


# Defines the exact shape we want the LLM's answer in. Instead of getting
# back raw text and hoping it's formatted right, PydanticOutputParser tells
# the LLM "reply as JSON matching this schema" and then parses+validates the
# JSON into this Python object automatically. If the LLM messes up the format,
# this step will raise an error instead of silently passing bad data forward.
class AnswerResponse(BaseModel):
    answer: str = Field(description="Answer generated strictly from the provided document")


parser = PydanticOutputParser(pydantic_object=AnswerResponse)

# LCEL (LangChain Expression Language) pipe syntax: output of one step becomes
# input of the next. Flow: prompt (fills template) -> llm (generates raw
# response) -> parser (validates/converts raw text into AnswerResponse object).
chain = prompt | llm | parser


@app.get("/")
async def root():
    return {"message": "DocVault API is running", "version": "1.0.0"}


@app.post("/upload-pdf")
async def upload_pdf(files: list[UploadFile]):
    all_chunks = []  # will hold text chunks from ALL uploaded files combined
    results = []      # per-file summary info to return to the client

    for file in files:
        # Basic file-type validation before doing any expensive work
        # (parsing/chunking) on something that isn't even a PDF.
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"'{file.filename}' is not a valid PDF file.",
            )

        tmp_path = None
        try:
            # WHY A TEMP FILE:
            # FastAPI gives us the uploaded file as an in-memory stream
            # (file.file), not a path on disk. But PyPDFLoader (the PDF
            # parser) is built to open a PDF by its FILE PATH, not a raw
            # byte stream. So we must write the uploaded bytes to an actual
            # temporary file on disk first, then hand PyPDFLoader that path.
            #
            # WHY shutil.copyfileobj:
            # This copies data from the source stream (file.file) to the
            # destination stream (tmp_file) in small chunks, instead of
            # loading the entire file into RAM at once with .read(). This
            # matters for large PDFs — it's memory-efficient streaming
            # copy rather than one giant read+write.
            #
            # delete=False: normally NamedTemporaryFile auto-deletes itself
            # when closed. We set False because we need the file to still
            # exist on disk AFTER this "with" block closes it, so
            # PyPDFLoader can open it afterward. We manually delete it
            # ourselves in the `finally` block below.
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
                shutil.copyfileobj(file.file, tmp_file)
                tmp_path = tmp_file.name

            # Reads the PDF page by page. Each page becomes one "Document"
            # object with .page_content (text) and .metadata (e.g. page number).
            loader = PyPDFLoader(tmp_path)
            docs = loader.load()
            total_pages = len(docs)

            # WHY CHUNKING AT ALL:
            # LLMs have a limited context window, and embedding models also
            # work best on smaller pieces of text. We can't dump an entire
            # PDF into the prompt every time someone asks a question — it'd
            # be slow, expensive, and often exceed token limits. So instead
            # we break the PDF into small overlapping chunks, embed each
            # chunk separately, and later retrieve only the few chunks most
            # relevant to the user's specific question.
            #
            # WHY RecursiveCharacterTextSplitter specifically:
            # It tries to split on natural boundaries first (paragraphs "\n\n",
            # then lines "\n", then spaces " ", then as a last resort raw
            # characters ""). This keeps sentences/paragraphs intact as much
            # as possible instead of cutting text mid-sentence, which would
            # produce chunks that don't make semantic sense on their own.
            #
            # WHY chunk_size=1000:
            # ~1000 characters (~150-250 words) is a common sweet spot: big
            # enough to hold a full idea/paragraph for good context, small
            # enough to embed accurately and fit several chunks into the
            # LLM's prompt without wasting tokens.
            #
            # WHY chunk_overlap=200:
            # Without overlap, an important sentence could get cut in half
            # right at a chunk boundary, and neither chunk would contain the
            # full idea. Overlapping the last 200 characters of one chunk
            # into the start of the next preserves context continuity across
            # boundaries, so retrieval doesn't miss information that
            # straddles two chunks.
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200,
                separators=["\n\n", "\n", " ", ""],
            )
            chunks = splitter.split_documents(docs)

            # Give this upload a unique ID so we can later filter/trace which
            # chunks came from which specific upload (e.g. for deleting a
            # doc, or showing "source" info back to the user).
            document_id = f"pdf_{uuid.uuid4().hex}"
            for chunk in chunks:
                chunk.metadata["filename"] = file.filename
                chunk.metadata["document_id"] = document_id

            all_chunks.extend(chunks)
            results.append({
                "filename": file.filename,
                "total_pages": total_pages,
                "total_chunks": len(chunks),
                "document_id": document_id,
            })

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to process '{file.filename}': {str(e)}",
            )
        finally:
            # WHY CLEANUP HERE:
            # Since delete=False above, the temp file survives on disk until
            # we remove it ourselves. This `finally` runs whether processing
            # succeeded or failed, so we never leave orphaned temp PDF files
            # piling up on the server's disk over time.
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)

    if all_chunks:
     try:
        try:
            # Try to reuse an existing Qdrant collection (fast path — the
            # collection was already created by a previous upload).
            vector_store = QdrantVectorStore.from_existing_collection(
                embedding=embedding,
                collection_name=COLLECTION_NAME,
                url=QDRANT_ENDPOINT,
                api_key=QDRANT_API_KEY,
                prefer_grpc=True,  # gRPC is faster than plain HTTP for bulk uploads
            )
            vector_store.add_documents(all_chunks)
        except Exception:
            # If the collection doesn't exist yet (first-ever upload), this
            # call creates it AND inserts the documents in one step. This is
            # essentially "create collection if missing" fallback logic.
            QdrantVectorStore.from_documents(
                all_chunks,
                embedding=embedding,
                url=QDRANT_ENDPOINT,
                prefer_grpc=True,
                api_key=QDRANT_API_KEY,
                collection_name=COLLECTION_NAME,
            )
     except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store embeddings: {str(e)}",
        )
    return {
        "status": "success",
        "message": f"{len(results)} file(s) processed and indexed successfully.",
        "documents": results,
    }


class QuestionRequest(BaseModel):
    question: str


@app.post("/ask-question")
async def ask_question(data: QuestionRequest):
    if not data.question.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty.",
        )

    try:
        # Connect to the already-populated Qdrant collection so we can
        # search it. This does NOT re-embed or re-upload anything — it just
        # opens a connection to existing stored vectors.
        vector_store = QdrantVectorStore.from_existing_collection(
            embedding=embedding,
            collection_name=COLLECTION_NAME,
            url=QDRANT_ENDPOINT,
            api_key=QDRANT_API_KEY,
            prefer_grpc=True,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Could not connect to vector store: {str(e)}",
        )

    # Retriever = the "R" in RAG (Retrieval-Augmented Generation). It embeds
    # the user's question the same way we embedded the PDF chunks, then finds
    # the chunks whose vectors are closest in meaning.
    #
    # search_type="similarity_score_threshold": instead of always returning
    # a fixed number of results, only return chunks whose similarity score
    # clears the threshold. This avoids feeding the LLM irrelevant chunks
    # just to fill a quota.
    #
    # score_threshold=0.65: cutoff for "close enough to be relevant."
    # Roughly a tuned value: too low -> noisy/irrelevant chunks get in;
    # too high -> real matches wrongly get excluded.
    #
    # k=5: even among chunks that pass the threshold, cap it at the top 5
    # closest matches, to keep the prompt short/cheap and avoid diluting the
    # LLM's attention with too much context.
    retriever = vector_store.as_retriever(
      search_type="similarity_score_threshold",
      search_kwargs={
          "score_threshold": 0.65,
          "k": 5,
      },
    )

    documents = retriever.invoke(data.question)

    # If nothing relevant was found, don't even bother calling the LLM —
    # saves an API call/cost and guarantees an honest "I don't know" answer
    # instead of risking the LLM inventing something.
    if not documents:
        return {
            "status": "success",
            "response": "I don't have enough information in the provided documents to answer this question.",
            "sources": [],
        }

    # Merge all retrieved chunk texts into one big context string, separated
    # by blank lines, to feed into the prompt's {pdf_data} slot.
    context = "\n\n".join(doc.page_content for doc in documents)

    # Build a de-duplicated list of "sources" (filename + page + doc id) so
    # the frontend can show the user WHERE each answer came from. We use a
    # `seen` set to avoid listing the same source twice if multiple chunks
    # came from the same page.
    sources = []
    seen = set()
    for doc in documents:
        key = (doc.metadata.get("filename"), doc.metadata.get("page"), doc.metadata.get("document_id"))
        if key not in seen:
            seen.add(key)
            sources.append({
                "filename": doc.metadata.get("filename", "Unknown"),
                # +1 because PDF pages are 0-indexed internally but humans
                # expect page numbers starting at 1.
                "page": doc.metadata.get("page", 0) + 1,
                "document_id": doc.metadata.get("document_id", ""),
            })

    try:
        # Run the actual RAG chain: fill the prompt with context + question,
        # send to the LLM, parse the structured JSON response into
        # AnswerResponse.
        response = chain.invoke({
            "pdf_data": context,
            "question": data.question,
            "format_instructions": parser.get_format_instructions(),
        })
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"LLM failed to generate answer: {str(e)}",
        )

    return {
        "status": "success",
        "message": "Answer returned successfully.",
        "response": response.answer,
        "sources": sources,
    }