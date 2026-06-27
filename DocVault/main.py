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

load_dotenv()

app = FastAPI(title="DocVault API", version="1.0.0")

QDRANT_ENDPOINT = os.getenv("QDRANT_ENDPOINT")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
COLLECTION_NAME = "knowledge_base"

embedding = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
llm = ChatMistralAI(model="mistral-large-latest", temperature=0, max_retries=2)

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


class AnswerResponse(BaseModel):
    answer: str = Field(description="Answer generated strictly from the provided document")


parser = PydanticOutputParser(pydantic_object=AnswerResponse)
chain = prompt | llm | parser


@app.get("/")
async def root():
    return {"message": "DocVault API is running", "version": "1.0.0"}


@app.post("/upload-pdf")
async def upload_pdf(files: list[UploadFile]):
    all_chunks = []
    results = []

    for file in files:
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"'{file.filename}' is not a valid PDF file.",
            )

        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
                shutil.copyfileobj(file.file, tmp_file)
                tmp_path = tmp_file.name

            loader = PyPDFLoader(tmp_path)
            docs = loader.load()
            total_pages = len(docs)

            splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200,
                separators=["\n\n", "\n", " ", ""],
            )
            chunks = splitter.split_documents(docs)

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
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)

    if all_chunks:
     try:
        try:
            vector_store = QdrantVectorStore.from_existing_collection(
                embedding=embedding,
                collection_name=COLLECTION_NAME,
                url=QDRANT_ENDPOINT,
                api_key=QDRANT_API_KEY,
                prefer_grpc=True,
            )
            vector_store.add_documents(all_chunks)
        except Exception:
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

    retriever = vector_store.as_retriever(
      search_type="similarity_score_threshold",
      search_kwargs={
          "score_threshold": 0.65,
          "k": 5,
      },
    )

    documents = retriever.invoke(data.question)

    if not documents:
        return {
            "status": "success",
            "response": "I don't have enough information in the provided documents to answer this question.",
            "sources": [],
        }

    context = "\n\n".join(doc.page_content for doc in documents)

    sources = []
    seen = set()
    for doc in documents:
        key = (doc.metadata.get("filename"), doc.metadata.get("page"), doc.metadata.get("document_id"))
        if key not in seen:
            seen.add(key)
            sources.append({
                "filename": doc.metadata.get("filename", "Unknown"),
                "page": doc.metadata.get("page", 0) + 1,
                "document_id": doc.metadata.get("document_id", ""),
            })

    try:
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