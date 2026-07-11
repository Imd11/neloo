"""
Field mapper: Convert SmartResume output to resume-builder ResumeData format
"""

import uuid
from typing import Any, Dict, List, Optional


def create_id() -> str:
    """Generate a unique ID"""
    return str(uuid.uuid4())[:8]


def extract_text_from_index_range(text_lines: List[str], index_range: Optional[List[int]]) -> str:
    """Extract text from original content using index range"""
    if not index_range or len(index_range) != 2:
        return ""

    start, end = index_range
    if start < 0 or end >= len(text_lines) or start > end:
        return ""

    return "\n".join(text_lines[start : end + 1])


def map_basic_info(smart_resume_data: Dict[str, Any]) -> Dict[str, Any]:
    """Map basicInfo to personal"""
    basic = smart_resume_data.get("basicInfo", {})

    return {
        "name": basic.get("name", ""),
        "title": basic.get("title", ""),
        "email": basic.get("personalEmail", ""),
        "phone": basic.get("phoneNumber", ""),
        "address": "",
        "city": basic.get("currentLocation", ""),
        "country": "",
        "postalCode": "",
        "website": basic.get("website", ""),
        "photo": "",
        "nationality": basic.get("nationality", ""),
        "birthday": basic.get("born", ""),
        "summary": basic.get("summary", ""),
        "philosophy": "",
    }


def map_work_experience(
    smart_resume_data: Dict[str, Any], text_lines: List[str]
) -> List[Dict[str, Any]]:
    """Map workExperience to experience array"""
    work_exp = smart_resume_data.get("workExperience", [])
    result = []

    for exp in work_exp:
        period = exp.get("employmentPeriod", {})
        end_date = period.get("endDate", "")

        result.append(
            {
                "id": create_id(),
                "company": exp.get("companyName", ""),
                "position": exp.get("position", ""),
                "location": exp.get("location", ""),
                "startDate": period.get("startDate", ""),
                "endDate": end_date,
                "current": end_date in ["至今", "Present", "至今"],
                "description": extract_text_from_index_range(
                    text_lines, exp.get("jobDescription_refer_index_range")
                ),
                "highlights": [],
            }
        )

    return result


def map_education(smart_resume_data: Dict[str, Any], text_lines: List[str]) -> List[Dict[str, Any]]:
    """Map education array"""
    education = smart_resume_data.get("education", [])
    result = []

    for edu in education:
        period = edu.get("period", {})

        # Combine department and major
        field = edu.get("major", "")
        if edu.get("department"):
            field = f"{edu.get('department')} - {field}" if field else edu.get("department")

        result.append(
            {
                "id": create_id(),
                "institution": edu.get("school", ""),
                "degree": edu.get("degreeLevel", ""),
                "field": field,
                "location": edu.get("location", ""),
                "startDate": period.get("startDate", ""),
                "endDate": period.get("endDate", ""),
                "gpa": edu.get("gpa", ""),
                "description": edu.get("educationDescription", ""),
                "courses": [],
            }
        )

    return result


def map_skills(smart_resume_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Map skills array"""
    skills = smart_resume_data.get("skills", [])
    result = []

    for skill in skills:
        result.append(
            {
                "id": create_id(),
                "name": skill.get("name", ""),
                "level": skill.get("level", 3),
                "category": skill.get("category", "technical"),
                "icon": "",
                "years": 0,
                "subSkills": [],
            }
        )

    return result


def map_languages(smart_resume_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Map languages array"""
    languages = smart_resume_data.get("languages", [])
    result = []

    level_map = {
        "native": 5,
        "fluent": 4,
        "advanced": 4,
        "intermediate": 3,
        "basic": 2,
    }

    for lang in languages:
        level_str = lang.get("level", "intermediate").lower()

        result.append(
            {
                "id": create_id(),
                "name": lang.get("name", ""),
                "level": level_str,
                "levelNumber": level_map.get(level_str, 3),
                "flag": "",
            }
        )

    return result


def map_projects(smart_resume_data: Dict[str, Any], text_lines: List[str]) -> List[Dict[str, Any]]:
    """Map projects array"""
    projects = smart_resume_data.get("projects", [])
    result = []

    for proj in projects:
        period = proj.get("period", {})

        result.append(
            {
                "id": create_id(),
                "name": proj.get("name", ""),
                "role": proj.get("role", ""),
                "organization": proj.get("organization", ""),
                "startDate": period.get("startDate", ""),
                "endDate": period.get("endDate", ""),
                "description": extract_text_from_index_range(
                    text_lines, proj.get("description_refer_index_range")
                ),
                "highlights": [],
                "technologies": proj.get("technologies", []),
                "url": "",
            }
        )

    return result


def convert_to_resume_data(
    smart_resume_output: Dict[str, Any], text_lines: List[str]
) -> Dict[str, Any]:
    """
    Convert SmartResume output to resume-builder ResumeData format

    Args:
        smart_resume_output: Combined output from all extraction prompts
        text_lines: Original text split by lines (for index-based extraction)

    Returns:
        ResumeData compatible dictionary
    """
    return {
        "personal": map_basic_info(smart_resume_output),
        "experience": map_work_experience(smart_resume_output, text_lines),
        "education": map_education(smart_resume_output, text_lines),
        "skills": map_skills(smart_resume_output),
        "languages": map_languages(smart_resume_output),
        "socialLinks": [],
        "projects": map_projects(smart_resume_output, text_lines),
        "certificates": [],
        "awards": [],
        "publications": [],
        "talks": [],
        "volunteer": [],
        "references": [],
        "hobbies": [],
        "customSections": [],
        "sectionVisibility": {
            "projects": len(smart_resume_output.get("projects", [])) > 0,
            "certificates": False,
            "awards": False,
            "publications": False,
            "hobbies": False,
        },
    }
