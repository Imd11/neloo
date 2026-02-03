"""
Extended prompts for resume parsing - based on SmartResume with additional fields
"""

SYSTEM_PROMPT = """
您是一个专业的简历分析助手。您的任务是将给定的简历文本转换为下面给定的 JSON 输出。
- 如果有中英文简历同时出现时，只关注中文简历
- 严格按照 JSON 格式输出，不要添加额外的解释
"""

BASIC_INFO_PROMPT = """
提取如下信息到json，若某些字段不存在则输出 "" 空
{
  "basicInfo": {
    "name": "",           # 姓名 如: 张三
    "title": "",          # 职位/头衔 如: 产品经理、软件工程师
    "personalEmail": "",  # 邮箱 如: example@qq.com
    "phoneNumber": "",    # 电话 保留原格式
    "age": "",            # 年龄
    "born": "",           # 出生年月 如 1996-11
    "gender": "",         # 男/女
    "currentLocation": "",# 现居地/当前城市
    "nationality": "",    # 国籍
    "website": "",        # 个人网站
    "summary": ""         # 个人简介/自我评价
  }
}
"""

WORK_EXPERIENCE_PROMPT = """
{
  "workExperience": [
    {
      "companyName": "",     # 公司名称
      "location": "",        # 工作地点 如: 北京、上海
      "position": "",        # 职位
      "employmentPeriod": {
        "startDate": "",     # 格式 YYYY.MM 或 YYYY
        "endDate": ""        # 若至今填 "至今"
      },
      "internship": 0,       # 是否实习 1=是 0=否
      "jobDescription_refer_index_range": []  # [start_idx, end_idx]
    }
  ]
}

关于 jobDescription_refer_index_range:
- 指工作描述在原文中的行索引范围
- 例如 [22, 40] 表示第22行到第40行的内容
- 不包括公司名、时间、职位这些基础信息行
"""

EDUCATION_PROMPT = """
{
  "education": [
    {
      "school": "",          # 学校名称
      "location": "",        # 学校所在地
      "degreeLevel": "",     # 学位: 本科/硕士/博士/专科/高中
      "major": "",           # 专业
      "department": "",      # 院系
      "period": {
        "startDate": "",
        "endDate": ""
      },
      "gpa": "",             # GPA 如 3.8/4.0
      "educationDescription": ""  # 相关课程、荣誉等
    }
  ]
}
"""

SKILLS_PROMPT = """
{
  "skills": [
    {
      "name": "",            # 技能名称 如: Python, 项目管理
      "category": "",        # 分类: technical/soft/language
      "level": 3             # 熟练度 1-5
    }
  ],
  "languages": [
    {
      "name": "",            # 语言 如: 英语、日语
      "level": ""            # 水平: native/fluent/advanced/intermediate/basic
    }
  ]
}
"""

PROJECTS_PROMPT = """
{
  "projects": [
    {
      "name": "",               # 项目名称
      "role": "",               # 在项目中的角色
      "organization": "",       # 所属组织/公司
      "period": {
        "startDate": "",
        "endDate": ""
      },
      "technologies": [],       # 使用的技术栈
      "description_refer_index_range": []  # 项目描述的行索引范围
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
