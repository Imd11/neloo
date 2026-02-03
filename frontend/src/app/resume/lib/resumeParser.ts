// Resume Parser - Extract structured data from resume text using Qwen (faster parsing)

import type { ResumeData } from '../types/resume';
import { defaultResumeData } from '../types/resume';

// Qwen API for resume parsing (faster than DeepSeek)
const QWEN_API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

// Schema description for the AI
const RESUME_SCHEMA = `
{
  "personal": {
    "name": "姓名",
    "title": "职位头衔",
    "email": "邮箱",
    "phone": "电话",
    "address": "地址",
    "website": "个人网站",
    "summary": "个人简介"
  },
  "experience": [{
    "id": "唯一ID",
    "company": "公司名",
    "position": "职位",
    "location": "地点",
    "startDate": "开始日期",
    "endDate": "结束日期（如在职则为空）",
    "description": "工作描述",
    "highlights": ["工作亮点/成就"]
  }],
  "education": [{
    "id": "唯一ID",
    "institution": "学校名",
    "degree": "学位（如: 本科、硕士）",
    "field": "专业",
    "startDate": "开始日期",
    "endDate": "毕业日期",
    "description": "描述"
  }],
  "skills": [{
    "id": "唯一ID",
    "name": "技能名称",
    "level": 3,
    "category": "technical 或 soft",
    "icon": "表情符号"
  }],
  "languages": [{
    "id": "唯一ID",
    "name": "语言名称",
    "level": "native/fluent/advanced/intermediate/basic",
    "levelNumber": 5,
    "flag": "国旗表情"
  }],
  "projects": [{
    "id": "唯一ID",
    "name": "项目名",
    "role": "角色",
    "organization": "组织",
    "startDate": "开始日期",
    "endDate": "结束日期",
    "description": "描述",
    "technologies": ["技术栈"]
  }],
  "awards": [{
    "id": "唯一ID",
    "title": "奖项名称",
    "issuer": "颁发机构",
    "date": "获奖日期",
    "description": "描述"
  }],
  "certificates": [{
    "id": "唯一ID",
    "name": "证书名称",
    "issuer": "颁发机构",
    "date": "获取日期"
  }]
}`;

const PARSE_SYSTEM_PROMPT = `你是一个专业的简历解析专家。你的任务是从用户提供的简历文本中精准提取结构化信息。

【输出格式】
严格按照以下 JSON 格式返回，只返回 JSON，不要有任何其他文字：
${RESUME_SCHEMA}

【字段识别规则】

1. **personal（个人信息）**
   - name: 通常在简历最顶部。如果格式是"姓名/其他信息"（如"杨锦航/CET6:451"），只提取姓名部分（杨锦航）
   - title: 如果没有明确职位，可以根据简历内容推断（如有研究助理经历可填"研究助理"）
   - email: 包含 @ 符号的文字
   - phone: 包含数字的电话号码，如 13812345678、(+86) xxx
   - address: 包含省/市/区的地址信息
   - website: 包含 github/linkedin/http 的链接
   - summary: 识别关键词"个人简介"、"自我评价"、"个人评价"、"About Me"开头的段落

2. **experience（工作/实习经历）** - 非常重要！
   - 识别关键词：工作经历、工作经验、实习经历、社会工作与实习、社会实践、Work Experience、Internship
   - 研究助理（RA）、研究助手、助研 也算工作经历
   - company: 公司/机构/大学名称
   - position: 职位名称，如"总经理助理"、"研究员"、"研究助理(RA)"
   - startDate/endDate: 提取日期，格式如"2024年3月-12月"转为"2024-03"和"2024-12"
   - description: "主要工作"、"负责"后面的内容
   - highlights: 以"•"、"□"、"-"、"1."开头的条目

3. **education（教育背景）** - 非常重要！
   - 识别关键词：教育背景、教育经历、学历、Education
   - institution: 学校名称，如"天津财经大学"、"河北农业大学"（包含"大学"、"学院"的都是学校）
   - degree: 如果没有明确写，默认本科="本科"，研究生="硕士"
   - field: 专业名称，如"统计学"、"经济统计学"，通常紧跟学校名称后面
   - description: 课程、成绩、学术成就等

4. **skills（技能）**
   - 识别各种技能：Stata、R、Python、SPSS、Excel、SQL 等
   - 如果有技能条/进度条，根据长度判断 level（满=5）
   - category: 编程/数据类=technical

5. **languages（语言能力）**
   - CET6/CET4 表示英语能力
   - CET6 分数 > 450 → levelNumber=4, 分数 > 550 → levelNumber=5

6. **publications（期刊论文）**
   - 识别关键词：期刊论文、发表论文、Publications
   - 格式通常是 [序号] 作者. 论文标题 [J]. 期刊名

7. **projects（项目/论文/竞赛）**
   - 识别关键词：会议论文、竞赛与科研、项目经历、Projects
   - 论文名称、竞赛名称都可以作为项目

8. **awards（荣誉奖项）**
   - 识别：一等奖、二等奖、三等奖、优秀奖等
   - 从"竞赛与科研"部分提取获奖信息

【特别注意】
1. 仔细阅读整个简历，不要遗漏任何章节
2. "社会工作与实习"等同于"工作经历"，必须提取到 experience 数组
3. 学校名称和专业通常在同一行，如"天津财经大学 统计学"，分别填入 institution 和 field
4. 日期格式统一为 "YYYY-MM" 或 "YYYY"
5. 为每个数组项生成唯一 id，格式如 "exp_xxx"、"edu_xxx"
6. 确保 JSON 格式正确

【重要：双栏布局处理】
如果文本中出现以下标记，说明简历是双栏布局，已被分栏提取：
- 【侧边栏 - 个人信息/技能】：包含姓名、联系方式、技能、语言等
- 【主内容 - 经历/项目】：包含工作经历、教育背景、项目经验等

请注意：
- 侧边栏中的大学名称属于 education，不是 experience 的 company
- 主内容中的公司/机构名称才是 experience 的 company
- 不要把教育背景中的学校误认为工作经历的公司`;

// ============================================
// 技术增强：预处理 + 后处理
// ============================================

// 预处理：用正则表达式提取关键信息
function preExtractInfo(text: string): {
  email: string | null;
  phone: string | null;
  name: string | null;
  universities: string[];
  companies: string[];
  dates: string[];
  sections: { [key: string]: string };
} {
  // 提取邮箱
  const emailMatch = text.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : null;

  // 提取电话
  const phoneMatch = text.match(/(\+86|86)?[\s-]?1[3-9]\d{9}|\(\+86\)\s*\d{11}/);
  const phone = phoneMatch ? phoneMatch[0].replace(/\s/g, '') : null;

  // 提取姓名（通常在开头，2-4个汉字，后面可能有/分隔的其他信息）
  const nameMatch = text.match(/^[\s]*([一-龥]{2,4})(?:\/|$|\s)/m);
  const name = nameMatch ? nameMatch[1] : null;

  // 提取大学名称（包含"大学"或"学院"的词）
  const universityMatches = text.match(/[一-龥]+(?:大学|学院)/g) || [];
  const universities = [...new Set(universityMatches)];

  // 提取公司名称（包含"公司"、"集团"、"有限"的词）
  const companyMatches = text.match(/[一-龥]+(?:公司|集团|有限)/g) || [];
  const companies = [...new Set(companyMatches)];

  // 提取日期
  const dateMatches = text.match(/\d{4}\s*[年.-]\s*\d{1,2}(?:\s*[月.-]\s*\d{1,2})?|\d{4}(?:\s*-\s*\d{4})?/g) || [];
  const dates = [...new Set(dateMatches)];

  // 识别章节（通过常见章节标题）
  const sectionKeywords = [
    '教育背景', '教育经历', '学历',
    '工作经历', '工作经验', '社会工作与实习', '实习经历', '社会实践',
    '项目经验', '项目经历',
    '技能', '专业技能',
    '期刊论文', '会议论文', '发表论文',
    '竞赛与科研', '荣誉奖项', '获奖经历',
    '自我评价', '个人简介',
  ];

  const sections: { [key: string]: string } = {};
  for (const keyword of sectionKeywords) {
    const regex = new RegExp(`${keyword}[：:.]?\\s*([\\s\\S]*?)(?=${sectionKeywords.map(k => k).join('|')}|$)`, 'i');
    const match = text.match(regex);
    if (match && match[1] && match[1].trim().length > 10) {
      sections[keyword] = match[1].trim();
    }
  }

  console.log('🔍 预处理提取结果:', {
    email,
    phone,
    name,
    universities,
    companies,
    dateCount: dates.length,
    sectionsFound: Object.keys(sections),
  });

  return { email, phone, name, universities, companies, dates, sections };
}

// 后处理：验证并修复 AI 返回的数据
function postProcessData(
  parsed: Partial<ResumeData>,
  preExtracted: ReturnType<typeof preExtractInfo>
): ResumeData {
  const result = { ...defaultResumeData };

  // 1. 修复 personal 信息
  result.personal = {
    ...defaultResumeData.personal,
    ...parsed.personal,
    // 如果 AI 没提取到，用预处理的结果补充
    name: parsed.personal?.name || preExtracted.name || '',
    email: parsed.personal?.email || preExtracted.email || '',
    phone: parsed.personal?.phone || preExtracted.phone || '',
  };

  // 清理姓名中的额外信息（如 "杨锦航/CET6:451" → "杨锦航"）
  if (result.personal.name && result.personal.name.includes('/')) {
    result.personal.name = result.personal.name.split('/')[0].trim();
  }

  // 2. 修复 education（如果 AI 没提取到学校名，用预处理的）
  const education = parsed.education || [];
  if (education.length === 0 && preExtracted.universities.length > 0) {
    // AI 没解析到教育背景，但预处理找到了大学名
    for (const uni of preExtracted.universities) {
      education.push({
        id: `edu_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        institution: uni,
        degree: '',
        field: '',
        location: '',
        startDate: '',
        endDate: '',
        gpa: '',
        courses: [],
        description: '',
      });
    }
    console.log('🔧 后处理: 补充了教育背景', preExtracted.universities);
  } else {
    // 检查教育背景是否缺少学校名
    for (const edu of education) {
      if (!edu.institution && preExtracted.universities.length > 0) {
        edu.institution = preExtracted.universities[0];
        preExtracted.universities.shift();
      }
    }
  }
  result.education = education;

  // 3. 修复 experience（如果 AI 没提取到，检查是否有"社会工作与实习"章节）
  const experience = parsed.experience || [];
  if (experience.length === 0 && preExtracted.sections['社会工作与实习']) {
    // 尝试从章节内容中提取
    const sectionText = preExtracted.sections['社会工作与实习'];
    for (const company of preExtracted.companies) {
      if (sectionText.includes(company)) {
        experience.push({
          id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          company: company,
          position: '',
          location: '',
          startDate: '',
          endDate: '',
          current: false,
          description: sectionText.substring(sectionText.indexOf(company), sectionText.indexOf(company) + 200).trim(),
          highlights: [],
        });
      }
    }
    console.log('🔧 后处理: 补充了工作经历', preExtracted.companies);
  }
  result.experience = experience;

  // 4. 确保所有数组项都有 id
  const ensureIds = <T extends { id?: string }>(arr: T[], prefix: string): T[] => {
    return arr.map((item, index) => ({
      ...item,
      id: item.id || `${prefix}_${Date.now()}_${index}`,
    }));
  };

  result.education = ensureIds(result.education, 'edu');
  result.experience = ensureIds(result.experience, 'exp');
  result.skills = parsed.skills || [];
  result.languages = parsed.languages || [];
  result.projects = parsed.projects || [];
  result.awards = parsed.awards || [];
  result.certificates = parsed.certificates || [];
  result.publications = parsed.publications || [];
  result.socialLinks = parsed.socialLinks || [];
  result.talks = parsed.talks || [];
  result.volunteer = parsed.volunteer || [];
  result.references = parsed.references || [];
  result.hobbies = parsed.hobbies || [];
  result.customSections = parsed.customSections || [];
  result.sectionVisibility = parsed.sectionVisibility
    ? {
      ...defaultResumeData.sectionVisibility,
      ...parsed.sectionVisibility,
    }
    : {
      projects: result.projects.length > 0,
      certificates: result.certificates.length > 0,
      awards: result.awards.length > 0,
      publications: result.publications.length > 0,
      hobbies: result.hobbies.length > 0,
    };

  console.log('✅ 后处理完成:', {
    name: result.personal.name,
    email: result.personal.email,
    educationCount: result.education.length,
    experienceCount: result.experience.length,
    skillsCount: result.skills.length,
  });

  return result;
}

export async function parseResumeText(text: string): Promise<ResumeData> {
  const apiKey = process.env.NEXT_PUBLIC_QWEN_API_KEY;

  if (!apiKey) {
    throw new Error('Qwen API key not configured');
  }

  // 步骤 1: 预处理 - 用正则提取关键信息
  console.log('📄 [步骤1] 预处理文本...');
  const preExtracted = preExtractInfo(text);

  // 步骤 2: AI 解析
  console.log('📄 [步骤2] 发送给 Qwen AI 解析...');
  console.log('📄 文本长度:', text.length, '字符');
  console.log('📄 文本预览:\n', text.substring(0, 800));

  // 构建增强的 prompt，包含预处理信息
  const enhancedPrompt = `请仔细解析以下简历内容，提取所有信息。

【预处理提示】
- 检测到的邮箱: ${preExtracted.email || '未检测到'}
- 检测到的电话: ${preExtracted.phone || '未检测到'}
- 检测到的姓名: ${preExtracted.name || '未检测到'}
- 检测到的大学: ${preExtracted.universities.join(', ') || '未检测到'}
- 检测到的公司/机构: ${preExtracted.companies.join(', ') || '未检测到'}
- 检测到的章节: ${Object.keys(preExtracted.sections).join(', ') || '未检测到'}

请基于以上提示和下面的简历原文，提取完整的结构化数据：

${text}`;

  const response = await fetch(QWEN_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'qwen-plus',
      messages: [
        { role: 'system', content: PARSE_SYSTEM_PROMPT },
        { role: 'user', content: enhancedPrompt },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`解析失败: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  console.log('🤖 AI 返回内容:', content.substring(0, 500));

  // 提取 JSON
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI 返回的内容不是有效的 JSON');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    // 步骤 3: 后处理 - 验证和修复
    console.log('📄 [步骤3] 后处理验证...');
    const result = postProcessData(parsed, preExtracted);

    return result;
  } catch (e) {
    console.error('❌ JSON 解析错误:', e);
    throw new Error('JSON 解析失败，请重试');
  }
}

// ============================================
// PDF 图片提取
// ============================================

interface ExtractedImage {
  data: string; // base64
  width: number;
  height: number;
  x: number;
  y: number;
  isLikelyProfilePhoto: boolean;
}

// Extract images from PDF and identify profile photo
export async function extractImagesFromPDF(file: File): Promise<string | null> {
  console.log('🖼️ 开始提取 PDF 图片...');

  try {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

    // Only check first page for profile photo
    const page = await pdf.getPage(1);
    // const viewport = page.getViewport({ scale: 1 });

    // Get operator list (contains all drawing operations including images)
    const ops = await page.getOperatorList();
    const extractedImages: ExtractedImage[] = [];

    // Find paintImageXObject operations (image drawing)
    for (let i = 0; i < ops.fnArray.length; i++) {
      // OPS.paintImageXObject = 85, OPS.paintJpegXObject = 82
      if (ops.fnArray[i] === 85 || ops.fnArray[i] === 82) {
        const imageName = ops.argsArray[i][0];

        try {
          // Get the image object
          const objs = page.objs;
          const imgData = await new Promise<{
            width: number;
            height: number;
            data?: Uint8ClampedArray;
            src?: string;
          } | null>((resolve) => {
            objs.get(imageName, (data: unknown) => {
              resolve(data as { width: number; height: number; data?: Uint8ClampedArray; src?: string } | null);
            });
          });

          if (!imgData) continue;

          // Convert image data to base64
          let base64 = '';

          if (imgData.src) {
            // Already has a source URL (JPEG)
            base64 = imgData.src;
          } else if (imgData.data) {
            // Raw image data - convert to canvas then to base64
            const canvas = document.createElement('canvas');
            canvas.width = imgData.width;
            canvas.height = imgData.height;
            const ctx = canvas.getContext('2d');

            if (ctx) {
              const imageData = ctx.createImageData(imgData.width, imgData.height);
              imageData.data.set(imgData.data);
              ctx.putImageData(imageData, 0, 0);
              base64 = canvas.toDataURL('image/png');
            }
          }

          if (base64) {
            // Determine if this looks like a profile photo
            const width = imgData.width;
            const height = imgData.height;
            const aspectRatio = width / height;

            // Profile photos are usually:
            // - Roughly square (aspect ratio 0.7 - 1.4)
            // - Between 50-500px in size
            // - Located in top portion or sidebar
            const isSquarish = aspectRatio >= 0.6 && aspectRatio <= 1.5;
            const isReasonableSize = width >= 50 && width <= 600 && height >= 50 && height <= 600;
            const isLikelyProfilePhoto = isSquarish && isReasonableSize;

            console.log(`🖼️ 发现图片: ${width}x${height}, 比例: ${aspectRatio.toFixed(2)}, 可能是头像: ${isLikelyProfilePhoto}`);

            extractedImages.push({
              data: base64,
              width,
              height,
              x: 0, // Position info would require more complex extraction
              y: 0,
              isLikelyProfilePhoto,
            });
          }
        } catch (imgError) {
          console.warn('提取单个图片失败:', imgError);
        }
      }
    }

    console.log(`🖼️ 共提取 ${extractedImages.length} 张图片`);

    // Find the most likely profile photo
    const profilePhotos = extractedImages.filter(img => img.isLikelyProfilePhoto);

    if (profilePhotos.length > 0) {
      // Return the first likely profile photo
      console.log('✅ 找到头像');
      return profilePhotos[0].data;
    }

    // If no profile-like photo, return the first small-ish image (might be a logo or photo)
    const smallImages = extractedImages.filter(img => img.width <= 300 && img.height <= 300);
    if (smallImages.length > 0) {
      console.log('⚠️ 未找到典型头像，返回第一张小图');
      return smallImages[0].data;
    }

    console.log('⚠️ 未在 PDF 中找到头像');
    return null;

  } catch (error) {
    console.error('❌ PDF 图片提取失败:', error);
    return null;
  }
}

// Text item from PDF.js with position info
interface PDFTextItem {
  str: string;
  transform: number[]; // [scaleX, skewX, skewY, scaleY, x, y]
  width: number;
  height: number;
  hasEOL?: boolean;
}

// Extract text from PDF with improved structure preservation
export async function extractTextFromPDF(file: File): Promise<string> {
  console.log('📄 开始解析 PDF:', file.name, '大小:', (file.size / 1024).toFixed(1), 'KB');

  try {
    const pdfjs = await import('pdfjs-dist');

    // Use the worker from CDN matching installed version
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

    console.log('📄 PDF 页数:', pdf.numPages);

    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = textContent.items as PDFTextItem[];
      const viewport = page.getViewport({ scale: 1 });
      const pageWidth = viewport.width;

      if (items.length === 0) {
        console.warn(`⚠️ 第 ${pageNum} 页没有提取到文字（可能是扫描图片）`);
        continue;
      }

      // ============================================
      // 智能列分割检测
      // ============================================
      const columnSplit = detectColumnSplit(items, pageWidth);

      if (columnSplit) {
        console.log(`📊 检测到双栏布局，分割点: ${columnSplit.toFixed(0)}px (页宽: ${pageWidth.toFixed(0)}px)`);

        // 分别提取左右栏
        const leftItems = items.filter(i => i.transform[4] < columnSplit);
        const rightItems = items.filter(i => i.transform[4] >= columnSplit);

        const leftText = extractColumnText(leftItems);
        const rightText = extractColumnText(rightItems);

        // 智能判断哪个是侧边栏（通常侧边栏文字更少）
        if (leftText.length < rightText.length * 0.7) {
          // 左边是侧边栏
          fullText += '【侧边栏 - 个人信息/技能】\n' + leftText + '\n\n';
          fullText += '【主内容 - 经历/项目】\n' + rightText + '\n';
        } else if (rightText.length < leftText.length * 0.7) {
          // 右边是侧边栏（罕见）
          fullText += '【主内容 - 经历/项目】\n' + leftText + '\n\n';
          fullText += '【侧边栏 - 个人信息/技能】\n' + rightText + '\n';
        } else {
          // 两栏相近，都作为主内容
          fullText += '【左栏】\n' + leftText + '\n\n';
          fullText += '【右栏】\n' + rightText + '\n';
        }
      } else {
        console.log('📄 单栏布局，按正常顺序提取');
        fullText += extractColumnText(items) + '\n';
      }

      // Add page separator for multi-page documents
      if (pageNum < pdf.numPages) {
        fullText += '\n--- 第 ' + (pageNum + 1) + ' 页 ---\n\n';
      }
    }

    const result = fullText.trim();

    console.log('✅ PDF 提取完成, 文字长度:', result.length, '字符');
    console.log('📄 提取的文本预览:\n', result.substring(0, 1000));

    if (result.length < 50) {
      throw new Error('PDF 文字提取失败（内容过少，可能是扫描图片格式）');
    }

    return result;
  } catch (error) {
    console.error('❌ PDF 解析错误:', error);

    if (error instanceof Error) {
      if (error.message.includes('Invalid PDF')) {
        throw new Error('无效的 PDF 文件，请检查文件是否损坏');
      }
      if (error.message.includes('Password')) {
        throw new Error('PDF 文件已加密，请先解除密码保护');
      }
      throw error;
    }

    throw new Error('PDF 解析失败，请尝试其他文件');
  }
}

// ============================================
// 智能列分割相关函数
// ============================================

// 检测是否为双栏布局，返回分割点 X 坐标
function detectColumnSplit(items: PDFTextItem[], pageWidth: number): number | null {
  // 计算所有文本项的 X 位置分布
  const xPositions = items.map(i => i.transform[4]);

  // 查找页面中间区域（30%-70%）
  const midRangeStart = pageWidth * 0.3;
  const midRangeEnd = pageWidth * 0.7;

  // 在中间区域寻找"间隙"（没有或很少文本的区域）
  const bucketSize = 10; // 10px 一个桶
  const buckets: number[] = new Array(Math.ceil(pageWidth / bucketSize)).fill(0);

  for (const x of xPositions) {
    const bucketIndex = Math.floor(x / bucketSize);
    if (bucketIndex < buckets.length) {
      buckets[bucketIndex]++;
    }
  }

  // 在中间区域找最大间隙
  let maxGapStart = -1;
  let maxGapLength = 0;
  let currentGapStart = -1;
  let currentGapLength = 0;

  for (let i = Math.floor(midRangeStart / bucketSize); i < Math.floor(midRangeEnd / bucketSize); i++) {
    if (buckets[i] < 2) { // 桶里文本很少，视为间隙
      if (currentGapStart === -1) {
        currentGapStart = i;
        currentGapLength = 1;
      } else {
        currentGapLength++;
      }
    } else {
      if (currentGapLength > maxGapLength) {
        maxGapStart = currentGapStart;
        maxGapLength = currentGapLength;
      }
      currentGapStart = -1;
      currentGapLength = 0;
    }
  }

  // 检查最后一个间隙
  if (currentGapLength > maxGapLength) {
    maxGapStart = currentGapStart;
    maxGapLength = currentGapLength;
  }

  // 如果间隙足够大（至少 3 个桶 = 30px），认为是双栏布局
  if (maxGapLength >= 3 && maxGapStart !== -1) {
    const splitX = (maxGapStart + maxGapLength / 2) * bucketSize;
    return splitX;
  }

  return null;
}

// 从一栏的文本项中提取文本
function extractColumnText(items: PDFTextItem[]): string {
  if (items.length === 0) return '';

  // 按 Y 排序（从上到下），再按 X 排序（从左到右）
  const sortedItems = [...items].sort((a, b) => {
    const yDiff = b.transform[5] - a.transform[5];
    if (Math.abs(yDiff) > 5) return yDiff;
    return a.transform[4] - b.transform[4];
  });

  // 按行分组
  const lines: PDFTextItem[][] = [];
  let currentLine: PDFTextItem[] = [];
  let lastY = sortedItems[0].transform[5];

  for (const item of sortedItems) {
    const y = item.transform[5];

    if (Math.abs(y - lastY) > 8) {
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }
      currentLine = [];
      lastY = y;
    }

    currentLine.push(item);
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  // 转换为文本
  let text = '';
  for (const line of lines) {
    line.sort((a, b) => a.transform[4] - b.transform[4]);

    let lineText = '';
    let lastX = 0;

    for (const item of line) {
      const x = item.transform[4];
      const gap = x - lastX;

      if (lastX > 0 && gap > 15) {
        lineText += ' ';
      }

      lineText += item.str;
      lastX = x + (item.width || 0);
    }

    const trimmed = lineText.trim();
    if (trimmed) {
      text += trimmed + '\n';
    }
  }

  return text.trim();
}
