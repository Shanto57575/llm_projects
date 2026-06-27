# 🗄️ DocVault

A RAG-powered PDF Question Answering system. Upload PDFs, index them into a vector database, and ask natural language questions with answers grounded strictly in your documents.

**Stack:** FastAPI · Streamlit · LangChain · Qdrant Cloud · MistralAI · HuggingFace Embeddings

---

**Upload flow:** PDF → PyPDFLoader → RecursiveCharacterTextSplitter (1000 chars, 200 overlap) → HuggingFace embeddings → Qdrant

**Query flow:** Question → similarity score threshold retrieval (k=5, score ≥ 0.65) → context assembly → Mistral LLM → structured answer via Pydantic parser

---

## Prerequisites

- Python 3.10+
- A [Qdrant Cloud](https://cloud.qdrant.io/) cluster (free tier works)
- A [MistralAI](https://console.mistral.ai/) API key

---

## Setup

### 1. Clone & create a virtual environment

```bash
git clone https://github.com/your-username/docvault.git
cd docvault

python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in your credentials in `.env` (see [Environment Variables](#environment-variables) below).

### 4. Run the backend

```bash
fastapi dev main.py
```

API docs available at `http://localhost:8000/docs`

### 5. Run the frontend (new terminal)

```bash
streamlit run app.py
```

Opens at `http://localhost:8501`

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MISTRAL_API_KEY` | ✅ | Your MistralAI API key |
| `QDRANT_ENDPOINT` | ✅ | Qdrant cluster URL (e.g. `https://xyz.qdrant.io`) |
| `QDRANT_API_KEY` | ✅ | Qdrant API key from your cluster dashboard |
| `API_BASE` | ❌ | FastAPI base URL for the Streamlit frontend (default: `http://localhost:8000`) |

Copy `.env.example` to `.env` and fill in the values. Never commit `.env`.

---

## API Reference

### `GET /`
Health check. Returns version info.

### `POST /upload-pdf`
Upload and index one or more PDF files.

- **Body:** `multipart/form-data` — field name `files`, accepts multiple PDFs
- **Response:**
```json
{
  "status": "success",
  "message": "2 file(s) processed and indexed successfully.",
  "documents": [
    {
      "filename": "report.pdf",
      "total_pages": 12,
      "total_chunks": 38,
      "document_id": "pdf_abc123"
    }
  ]
}
```

### `POST /ask-question`
Ask a question against all indexed documents.

- **Body:** `{ "question": "What is the refund policy?" }`
- **Response:**
```json
{
  "status": "success",
  "response": "The refund policy states...",
  "sources": [
    { "filename": "report.pdf", "page": 4, "document_id": "pdf_abc123" }
  ]
}
```

---

## Project Structure

```
docvault/
├── main.py              # FastAPI backend — upload, embed, retrieve, answer
├── app.py               # Streamlit frontend — upload UI, chat interface
├── requirements.txt     # Python dependencies
├── .env.example         # Environment variable template
├── .env                 # Your secrets (gitignored)
└── README.md
```

---

## Key Design Decisions

- **Strict RAG grounding** — the LLM is prompted to answer only from retrieved context; it will explicitly say so if the answer isn't in the documents.
- **Score-threshold retrieval** — chunks below 0.65 cosine similarity are filtered out to avoid hallucination from loosely related passages.
- **Pydantic output parser** — the LLM response is parsed into a structured `AnswerResponse` object, making the API response predictable.
- **Idempotent indexing** — if the Qdrant collection already exists, new documents are added; otherwise the collection is created fresh.
