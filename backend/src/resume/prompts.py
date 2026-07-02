"""
Extended prompts for resume parsing - based on SmartResume with additional fields
"""

SYSTEM_PROMPT = """
You are a professional resume parsing assistant. Your task is to convert the given resume text into the JSON output specified below.
- If both Chinese and English versions of the same resume appear, focus on the Chinese version.
- Output strictly valid JSON only. Do not add extra explanations.
"""

BASIC_INFO_PROMPT = """
Extract the following information into JSON. If a field does not exist, output an empty string "".
{
  "basicInfo": {
    "name": "",           # Name, e.g. Zhang San
    "title": "",          # Job title, e.g. Product Manager or Software Engineer
    "personalEmail": "",  # Email, e.g. example@qq.com
    "phoneNumber": "",    # Phone number, keep the original format
    "age": "",            # Age
    "born": "",           # Birth date, e.g. 1996-11
    "gender": "",         # Gender
    "currentLocation": "",# Current location or city
    "nationality": "",    # Nationality
    "website": "",        # Personal website
    "summary": ""         # Personal summary or self-evaluation
  }
}
"""

WORK_EXPERIENCE_PROMPT = """
{
  "workExperience": [
    {
      "companyName": "",     # Company name
      "location": "",        # Work location, e.g. Beijing or Shanghai
      "position": "",        # Position
      "employmentPeriod": {
        "startDate": "",     # Format: YYYY.MM or YYYY
        "endDate": ""        # If current, use the original "present/current" wording from the resume
      },
      "internship": 0,       # Whether this was an internship: 1=yes, 0=no
      "jobDescription_refer_index_range": []  # [start_idx, end_idx]
    }
  ]
}

About jobDescription_refer_index_range:
- It is the line index range of the job description in the original text.
- For example, [22, 40] means lines 22 through 40.
- Do not include basic information lines such as company name, time period, or position.
"""

EDUCATION_PROMPT = """
{
  "education": [
    {
      "school": "",          # School name
      "location": "",        # School location
      "degreeLevel": "",     # Degree level, e.g. bachelor, master, doctorate, associate, high school
      "major": "",           # Major
      "department": "",      # Department or faculty
      "period": {
        "startDate": "",
        "endDate": ""
      },
      "gpa": "",             # GPA, e.g. 3.8/4.0
      "educationDescription": ""  # Relevant coursework, honors, etc.
    }
  ]
}
"""

SKILLS_PROMPT = """
{
  "skills": [
    {
      "name": "",            # Skill name, e.g. Python or project management
      "category": "",        # Category: technical/soft/language
      "level": 3             # Proficiency level, 1-5
    }
  ],
  "languages": [
    {
      "name": "",            # Language, e.g. English or Japanese
      "level": ""            # Level: native/fluent/advanced/intermediate/basic
    }
  ]
}
"""

PROJECTS_PROMPT = """
{
  "projects": [
    {
      "name": "",               # Project name
      "role": "",               # Role in the project
      "organization": "",       # Organization or company
      "period": {
        "startDate": "",
        "endDate": ""
      },
      "technologies": [],       # Technologies used
      "description_refer_index_range": []  # Line index range of the project description
    }
  ]
}
"""

def get_prompts():
    """Get all prompts for different extraction types"""
    return {
        "basic_info": SYSTEM_PROMPT + BASIC_INFO_PROMPT,
        "work_experience": SYSTEM_PROMPT + WORK_EXPERIENCE_PROMPT,
        "education": SYSTEM_PROMPT + EDUCATION_PROMPT,
        "skills": SYSTEM_PROMPT + SKILLS_PROMPT,
        "projects": SYSTEM_PROMPT + PROJECTS_PROMPT,
    }
