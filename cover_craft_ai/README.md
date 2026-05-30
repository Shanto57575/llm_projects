<div align="center">

<img src="https://img.shields.io/badge/AI-Powered-7C3AED?style=for-the-badge&logo=openai&logoColor=white" />
<img src="https://img.shields.io/badge/Status-Live-22C55E?style=for-the-badge" />
<img src="https://img.shields.io/badge/License-MIT-3B82F6?style=for-the-badge" />

# 📄 CoverCraft AI

### *Let the right job find your words.*

**CoverCraft AI** evaluates your resume against a job description and — only if you qualify — generates a tailored, professional cover letter. No spam. No false hope. Just honest AI-powered matching.

[🚀 Live Demo](https://cover-craft-ai.netlify.app) · [🐛 Report a Bug](https://github.com/Shanto57575/llm_projects/issues) · [✨ Request a Feature](https://github.com/Shanto57575/llm_projects/issues)

</div>

---

## ✨ What Makes It Different

Most cover letter generators just take your resume and generate something. **CoverCraft AI doesn't.**

It first runs a qualification analysis — and only generates a cover letter if the AI determines you're a genuine fit for the role. If you're not, it tells you exactly why, what's missing, and how to improve. No wasted words.

---

| Upload & Analyze | Qualified — Results |
|---|---|
| Upload your resume (PDF/DOCX) and paste the job description | Match score, strengths, weaknesses & AI cover letter |

| Not Qualified — Honest Feedback |
|---|
| Missing skills, improvement suggestions — no cover letter generated |

---

## 🔍 Core Features

### ✅ AI Qualification Analysis
Before generating anything, the AI evaluates your resume against the job description across three dimensions:
- **Technical Skills** match percentage
- **Experience** relevance score
- **Responsibilities** alignment score

### 📊 Overall Match Score
A weighted score (0–100%) with a clear label — *Excellent, Good, Fair, Low* — so you know exactly where you stand.

### 💪 Strengths & Weaknesses Breakdown
- Detailed list of your **matching strengths** with context
- Honest **weaknesses** — gaps that could hurt your application

### 💡 Resume Improvement Suggestions
Categorized, actionable suggestions (Work Experience, Skills, Projects, etc.) to help you strengthen your resume before reapplying.

### ✉️ AI-Generated Cover Letter *(Qualified candidates only)*
A tailored, professional cover letter — generated only when the AI determines you meet the role's requirements. Copy it instantly.

### 🚫 Transparent Rejection
If you don't qualify, you get the full analysis — match score, weaknesses, missing skills — but no cover letter. Honest feedback over false hope.

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React (TypeScript) | UI framework |
| Tailwind CSS | Styling |
| Netlify | Deployment |

### Backend
| Technology | Purpose |
|---|---|
| Python + FastAPI | REST API |
| LangChain | LLM chain orchestration (LCEL) |
| Google Gemini 2.5 Flash | Qualification analysis (structured output) |
| Groq — LLaMA 3.3 70B | Cover letter generation |
| pypdf + docx2txt | Resume text extraction |
| Render | Deployment |

---

## 🏗️ Architecture Overview

```
User uploads Resume (PDF/DOCX) + Job Description
         │
         ▼
  ┌─────────────────┐
  │   FastAPI        │  ← Validates file format, extracts text
  └────────┬────────┘
           │
           ▼
  ┌─────────────────────────────────────────┐
  │  Analysis Chain (LCEL)                  │
  │  analysis_prompt | Gemini 2.5 Flash     │
  │  → Structured Output (AnalysisResponse) │
  └────────┬────────────────────────────────┘
           │
     ┌─────┴──────┐
     │            │
  Qualified    Not Qualified
     │            │
     ▼            ▼
  ┌──────────┐  Return analysis only
  │ Cover    │  (score, weaknesses,
  │ Letter   │   missing skills,
  │ Chain    │   suggestions)
  │ (Groq    │
  │ LLaMA)   │
  └──────────┘
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- API keys: Google Gemini, Groq

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/Shanto57575/llm_projects.git

cd cover-craft-ai/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Add your GOOGLE_API_KEY and GROQ_API_KEY to .env

# Run the server
fastapi dev main.py 
or 
uvicorn main:app --reload
```

### Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your VITE_API_URL to .env

# Start development server
npm run dev
```

---

## 🔌 API Reference

### `POST /api/v1/generate-cover-letter`

Analyzes resume against job description and conditionally generates a cover letter.

**Request** — `multipart/form-data`

| Field | Type | Constraints |
|---|---|---|
| `job_description` | `string` | 100–10,000 chars, min 30 words |
| `resume` | `file` | PDF, DOC, DOCX — max 5MB |

**Response**

```json
{
  "qualified": true,
  "assessment": {
    "is_qualified": true,
    "overall_score": 91,
    "technical_skills_score": 92,
    "experience_score": 88,
    "responsibilities_score": 93,
    "strengths": ["..."],
    "weaknesses": ["..."],
    "missing_skills": [],
    "improvement_suggestions": ["..."]
  },
  "cover_letter": "Dear Hiring Manager, ..."
}
```

**Error Responses**

| Status | Reason |
|---|---|
| `400` | Invalid file format |
| `422` | Resume too short / Job description too short / Scanned PDF |
| `500` | Unexpected server error |

---

---

## ⚠️ Known Limitations

- **Scanned / image-based PDFs** are not supported. The resume must be a text-based PDF (not a scanned document). If text extraction returns empty, the API returns a clear 422 error.
- Resume text must be between **100 and 20,000 characters**.
- Job description must be at least **30 words** and **100 characters**.

---

## 🗺️ Roadmap

- [ ] Streaming cover letter generation
- [ ] OCR support for scanned PDFs
- [ ] Multiple tone options (formal, conversational, creative)
- [ ] Cover letter history / saved sessions
- [ ] LinkedIn job URL import

---

## 🤝 Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

```bash
# Fork the repo, then:
git checkout -b feature/your-feature-name
git commit -m "feat: add your feature"
git push origin feature/your-feature-name
# Open a Pull Request
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<div align="center">

Built with ❤️ using LangChain, FastAPI, and React

[⬆ Back to Top](#-covercraft-ai)

</div>