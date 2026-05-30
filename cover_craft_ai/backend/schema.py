from pydantic import BaseModel, Field
from typing import List, Optional

    # =====================================================================
    # PIPELINE STEP 1: ANALYSIS (Your Current Model)
    # =====================================================================
class ProjectFixSuggestion(BaseModel):
    section: str = Field(..., description="The section of the resume needing attention.")
    instruction: str = Field(..., description="Specific, actionable feedback on how to improve it.")

class AnalysisResponse(BaseModel):
    overall_match_percentage: int = Field(..., ge=0, le=100)
    technical_skills_score: int = Field(..., ge=0, le=100)
    experience_score: int = Field(..., ge=0, le=100)
    responsibilities_score: int = Field(..., ge=0, le=100)
    strengths: List[str]
    missing_required_skills: List[str]
    weaknesses: List[str]
    suggestions: List[ProjectFixSuggestion]
    is_qualified: bool
            
    # =====================================================================
    # PIPELINE STEP 2: COVER LETTER GENERATION
    # =====================================================================
        
class GenerateCoverLetterResponse(BaseModel):
        qualified: bool
        assessment: AnalysisResponse
        cover_letter: Optional[str] = None