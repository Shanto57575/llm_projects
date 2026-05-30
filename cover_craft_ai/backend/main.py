from datetime import datetime
from fastapi import FastAPI, HTTPException, Form, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from schema import (
    AnalysisResponse,
    GenerateCoverLetterResponse
)
from prompt_store import (
    analysis_prompt,
    cover_letter_generator_prompt
)
from logger import logger
import io, pypdf, docx2txt

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

analysis_model = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0
)

cover_letter_model = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0.7
)

analysis_chain = (
    analysis_prompt
    | analysis_model.with_structured_output(AnalysisResponse)
)

cover_letter_chain = (
    cover_letter_generator_prompt
    | cover_letter_model
)

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc"}

@app.post(
    "/api/v1/generate-cover-letter",
    response_model=GenerateCoverLetterResponse
)
async def generate_cover_letter(
    job_description: str = Form(..., min_length=100, max_length=10000),
    resume: UploadFile = File(...)
    ):
    print("job_description", job_description)
    print("resume", resume)
    
    logger.info("Cover letter generation request received")
        
    # 1. Validate JD Word Count
    if len(job_description.split()) < 30:
            raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Job description must contain at least 30 words."
        )
        
    filename = resume.filename.lower()
    if not any(filename.endswith(ext) for ext in ALLOWED_EXTENSIONS):
            raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Resume must be a PDF, DOC, or DOCX file."
        )
            
    try:
        file_bytes = await resume.read()
        extracted_text = ""
        
        if filename.endswith('.pdf'):
           pdf_file = io.BytesIO(file_bytes)
           reader = pypdf.PdfReader(pdf_file)
           extracted_text = "".join([page.extract_text() or "" for page in reader.pages])
        else:
            docx_file = io.BytesIO(file_bytes)
            extracted_text = docx2txt.process(docx_file)
        
        resume_length = len(extracted_text)
        if resume_length < 100 or resume_length > 20000:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Extracted resume text length ({resume_length}) must be between 100 and 20000 characters."
            )

        if len(extracted_text.split()) < 50:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Resume text content is too short. Must contain at least 50 words."
            )
        
        qualification_analysis = analysis_chain.invoke({
            "job_description": job_description,
            "resume": extracted_text
        })
        
        logger.info(
            f"Qualification analysis completed. "
            f"Qualified={qualification_analysis.is_qualified}"
        )
        if qualification_analysis.is_qualified:
            cover_letter = cover_letter_chain.invoke({
                "job_description": job_description,
                "resume": resume,
                "strengths": qualification_analysis.strengths,
                "weaknesses": qualification_analysis.weaknesses,
            })
            logger.info("Cover letter generated successfully")
            return GenerateCoverLetterResponse(
                qualified=True,
                assessment=qualification_analysis,
                cover_letter=cover_letter.content
            )
        logger.info(
            "Candidate not qualified. Cover letter generation skipped."
        )
        return GenerateCoverLetterResponse(
            qualified=False,
            assessment=qualification_analysis,
            cover_letter=None
        )
    except Exception as e:
        logger.exception(
            f"Unexpected error while generating cover letter: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail="Internal server error while generating cover letter."
        )

@app.get("/", include_in_schema=False)
async def root():
    logger.info("Health check endpoint called")
    return {
        "success": True,
        "message": "Cover Craft AI is running fine",
        "time": f"{datetime.now():%d %B %Y %I:%M %p}"
    }