// Resume Parser - Extract structured data from resume text using Qwen (faster parsing)

import type { ResumeData } from "../types/resume";
import { defaultResumeData } from "../types/resume";

// Schema description for the AI
const RESUME_SCHEMA = `
{
  "personal": {
    "name": "Full name",
    "title": "Professional title",
    "email": "Email address",
    "phone": "Phone number",
    "address": "Location or address",
    "website": "Personal website",
    "summary": "Professional summary"
  },
  "experience": [{
    "id": "Unique ID",
    "company": "Company or organization name",
    "position": "Position",
    "location": "Location",
    "startDate": "Start date",
    "endDate": "End date, empty if current",
    "description": "Work description",
    "highlights": ["Work highlights or achievements"]
  }],
  "education": [{
    "id": "Unique ID",
    "institution": "School or university name",
    "degree": "Degree, such as bachelor or master",
    "field": "Field of study",
    "startDate": "Start date",
    "endDate": "Graduation date",
    "description": "Description"
  }],
  "skills": [{
    "id": "Unique ID",
    "name": "Skill name",
    "level": 3,
    "category": "technical or soft",
    "icon": "Emoji"
  }],
  "languages": [{
    "id": "Unique ID",
    "name": "Language name",
    "level": "native/fluent/advanced/intermediate/basic",
    "levelNumber": 5,
    "flag": "Flag emoji"
  }],
  "projects": [{
    "id": "Unique ID",
    "name": "Project name",
    "role": "Role",
    "organization": "Organization",
    "startDate": "Start date",
    "endDate": "End date",
    "description": "Description",
    "technologies": ["Technology stack"]
  }],
  "awards": [{
    "id": "Unique ID",
    "title": "Award name",
    "issuer": "Issuer",
    "date": "Award date",
    "description": "Description"
  }],
  "certificates": [{
    "id": "Unique ID",
    "name": "Certificate name",
    "issuer": "Issuer",
    "date": "Issue date"
  }]
}`;

const PARSE_SYSTEM_PROMPT = `You are a professional resume parsing expert. Your task is to accurately extract structured information from the resume text provided by the user.

Output format:
Return strictly in the following JSON structure. Return JSON only, with no extra text:
${RESUME_SCHEMA}

Field recognition rules:

1. **personal**
   - name: usually appears at the top of the resume. If the format is "name / other info", extract only the name.
   - title: if no explicit title is present, infer a reasonable title from the resume content.
   - email: text containing an @ symbol.
   - phone: phone numbers containing digits, including international formats.
   - address: location or address information.
   - website: links containing github, linkedin, http, or similar domains.
   - summary: paragraphs introduced by profile, summary, self evaluation, about me, or equivalent headings.

2. **experience** - very important.
   - Recognize work experience, internships, social practice, research assistant work, RA roles, and similar sections.
   - company: company, institution, lab, university, or organization name.
   - position: role title, such as assistant general manager, researcher, or research assistant.
   - startDate/endDate: extract dates and normalize them to "YYYY-MM" or "YYYY".
   - description: duties and responsibilities.
   - highlights: bullets or numbered achievements.

3. **education** - very important.
   - Recognize education background, degrees, schools, universities, colleges, and similar sections.
   - institution: school or university name.
   - degree: infer bachelor or master if not explicitly stated.
   - field: major or field of study, often near the institution name.
   - description: coursework, grades, academic achievements, or related details.

4. **skills**
   - Recognize skills such as Stata, R, Python, SPSS, Excel, SQL, and other technical or soft skills.
   - If a visual skill bar is present, infer level from its length, where full equals 5.
   - category: programming, analytics, and data skills should be technical.

5. **languages**
   - Recognize language proficiency certificates and level indicators.
   - For CET4/CET6, infer English proficiency and map stronger scores to higher levelNumber values.

6. **publications**
   - Recognize publications, papers, journal articles, and similar sections.
   - Common format: authors, paper title, publication type, journal or venue.

7. **projects**
   - Recognize projects, papers, competitions, research projects, and similar sections.
   - Paper titles and competition names may be treated as projects when appropriate.

8. **awards**
   - Recognize prizes, honors, scholarships, rankings, and awards.
   - Extract award information from competition and research sections when relevant.

Important notes:
1. Read the entire resume carefully and do not omit any section.
2. Social work, internships, research assistant work, and practice experience should be extracted into the experience array when appropriate.
3. School names and majors often appear on the same line; split them into institution and field.
4. Normalize dates as "YYYY-MM" or "YYYY".
5. Generate a unique id for every array item, such as "exp_xxx" or "edu_xxx".
6. Ensure the JSON is valid.

Important: two-column layout handling.
If the text contains sidebar or main-content markers, it means the resume was extracted from a two-column layout:
- Sidebar personal/skills content: name, contact information, skills, languages, and similar data.
- Main content experience/projects content: work experience, education, projects, and similar data.

Notes:
- University names in the sidebar usually belong to education, not experience.company.
- Company and organization names in the main content are more likely to be experience.company.
- Do not misclassify schools in the education section as employers.`;

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
  const phoneMatch = text.match(
    /(\+86|86)?[\s-]?1[3-9]\d{9}|\(\+86\)\s*\d{11}/
  );
  const phone = phoneMatch ? phoneMatch[0].replace(/\s/g, "") : null;

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
  const dateMatches =
    text.match(
      /\d{4}\s*[年.-]\s*\d{1,2}(?:\s*[月.-]\s*\d{1,2})?|\d{4}(?:\s*-\s*\d{4})?/g
    ) || [];
  const dates = [...new Set(dateMatches)];

  // 识别章节（通过常见章节标题）
  const sectionKeywords = [
    "教育背景",
    "教育经历",
    "学历",
    "工作经历",
    "工作经验",
    "社会工作与实习",
    "实习经历",
    "社会实践",
    "项目经验",
    "项目经历",
    "技能",
    "专业技能",
    "期刊论文",
    "会议论文",
    "发表论文",
    "竞赛与科研",
    "荣誉奖项",
    "获奖经历",
    "自我评价",
    "个人简介",
  ];

  const sections: { [key: string]: string } = {};
  for (const keyword of sectionKeywords) {
    const regex = new RegExp(
      `${keyword}[：:.]?\\s*([\\s\\S]*?)(?=${sectionKeywords
        .map((k) => k)
        .join("|")}|$)`,
      "i"
    );
    const match = text.match(regex);
    if (match && match[1] && match[1].trim().length > 10) {
      sections[keyword] = match[1].trim();
    }
  }

  console.log("🔍 预处理提取结果:", {
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
    name: parsed.personal?.name || preExtracted.name || "",
    email: parsed.personal?.email || preExtracted.email || "",
    phone: parsed.personal?.phone || preExtracted.phone || "",
  };

  // 清理姓名中的额外信息（如 "杨锦航/CET6:451" → "杨锦航"）
  if (result.personal.name && result.personal.name.includes("/")) {
    result.personal.name = result.personal.name.split("/")[0].trim();
  }

  // 2. 修复 education（如果 AI 没提取到学校名，用预处理的）
  const education = parsed.education || [];
  if (education.length === 0 && preExtracted.universities.length > 0) {
    // AI 没解析到教育背景，但预处理找到了大学名
    for (const uni of preExtracted.universities) {
      education.push({
        id: `edu_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        institution: uni,
        degree: "",
        field: "",
        location: "",
        startDate: "",
        endDate: "",
        gpa: "",
        courses: [],
        description: "",
      });
    }
    console.log("🔧 后处理: 补充了教育背景", preExtracted.universities);
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
  if (experience.length === 0 && preExtracted.sections["社会工作与实习"]) {
    // 尝试从章节内容中提取
    const sectionText = preExtracted.sections["社会工作与实习"];
    for (const company of preExtracted.companies) {
      if (sectionText.includes(company)) {
        experience.push({
          id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          company: company,
          position: "",
          location: "",
          startDate: "",
          endDate: "",
          current: false,
          description: sectionText
            .substring(
              sectionText.indexOf(company),
              sectionText.indexOf(company) + 200
            )
            .trim(),
          highlights: [],
        });
      }
    }
    console.log("🔧 后处理: 补充了工作经历", preExtracted.companies);
  }
  result.experience = experience;

  // 4. 确保所有数组项都有 id
  const ensureIds = <T extends { id?: string }>(
    arr: T[],
    prefix: string
  ): T[] => {
    return arr.map((item, index) => ({
      ...item,
      id: item.id || `${prefix}_${Date.now()}_${index}`,
    }));
  };

  result.education = ensureIds(result.education, "edu");
  result.experience = ensureIds(result.experience, "exp");
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

  console.log("✅ 后处理完成:", {
    name: result.personal.name,
    email: result.personal.email,
    educationCount: result.education.length,
    experienceCount: result.experience.length,
    skillsCount: result.skills.length,
  });

  return result;
}

export async function parseResumeText(text: string): Promise<ResumeData> {
  // Step 1: Preprocess and extract key information with regexes.
  console.log("📄 [Step 1] Preprocessing text...");
  const preExtracted = preExtractInfo(text);

  // Step 2: AI parsing.
  console.log("📄 [Step 2] Sending text to Qwen AI for parsing...");
  console.log("📄 Text length:", text.length, "characters");
  console.log("📄 Text preview:\n", text.substring(0, 800));

  // Build an enhanced prompt with preprocessing hints.
  const enhancedPrompt = `Carefully parse the following resume content and extract all information.

Preprocessing hints:
- Detected email: ${preExtracted.email || "not detected"}
- Detected phone: ${preExtracted.phone || "not detected"}
- Detected name: ${preExtracted.name || "not detected"}
- Detected universities: ${
    preExtracted.universities.join(", ") || "not detected"
  }
- Detected companies/organizations: ${
    preExtracted.companies.join(", ") || "not detected"
  }
- Detected sections: ${
    Object.keys(preExtracted.sections).join(", ") || "not detected"
  }

Based on the hints above and the original resume text below, extract complete structured data:

${text}`;

  const response = await fetch("/api/resume/parse-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system: PARSE_SYSTEM_PROMPT,
      prompt: enhancedPrompt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`解析失败: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  console.log("🤖 AI 返回内容:", content.substring(0, 500));

  // 提取 JSON
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI 返回的内容不是有效的 JSON");
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    // 步骤 3: 后处理 - 验证和修复
    console.log("📄 [步骤3] 后处理验证...");
    const result = postProcessData(parsed, preExtracted);

    return result;
  } catch (e) {
    console.error("❌ JSON 解析错误:", e);
    throw new Error("JSON 解析失败，请重试");
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
  console.log("🖼️ 开始提取 PDF 图片...");

  try {
    const pdfjs = await import("pdfjs-dist");
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
              resolve(
                data as {
                  width: number;
                  height: number;
                  data?: Uint8ClampedArray;
                  src?: string;
                } | null
              );
            });
          });

          if (!imgData) continue;

          // Convert image data to base64
          let base64 = "";

          if (imgData.src) {
            // Already has a source URL (JPEG)
            base64 = imgData.src;
          } else if (imgData.data) {
            // Raw image data - convert to canvas then to base64
            const canvas = document.createElement("canvas");
            canvas.width = imgData.width;
            canvas.height = imgData.height;
            const ctx = canvas.getContext("2d");

            if (ctx) {
              const imageData = ctx.createImageData(
                imgData.width,
                imgData.height
              );
              imageData.data.set(imgData.data);
              ctx.putImageData(imageData, 0, 0);
              base64 = canvas.toDataURL("image/png");
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
            const isReasonableSize =
              width >= 50 && width <= 600 && height >= 50 && height <= 600;
            const isLikelyProfilePhoto = isSquarish && isReasonableSize;

            console.log(
              `🖼️ 发现图片: ${width}x${height}, 比例: ${aspectRatio.toFixed(
                2
              )}, 可能是头像: ${isLikelyProfilePhoto}`
            );

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
          console.warn("提取单个图片失败:", imgError);
        }
      }
    }

    console.log(`🖼️ 共提取 ${extractedImages.length} 张图片`);

    // Find the most likely profile photo
    const profilePhotos = extractedImages.filter(
      (img) => img.isLikelyProfilePhoto
    );

    if (profilePhotos.length > 0) {
      // Return the first likely profile photo
      console.log("✅ 找到头像");
      return profilePhotos[0].data;
    }

    // If no profile-like photo, return the first small-ish image (might be a logo or photo)
    const smallImages = extractedImages.filter(
      (img) => img.width <= 300 && img.height <= 300
    );
    if (smallImages.length > 0) {
      console.log("⚠️ 未找到典型头像，返回第一张小图");
      return smallImages[0].data;
    }

    console.log("⚠️ 未在 PDF 中找到头像");
    return null;
  } catch (error) {
    console.error("❌ PDF 图片提取失败:", error);
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
  console.log(
    "📄 开始解析 PDF:",
    file.name,
    "大小:",
    (file.size / 1024).toFixed(1),
    "KB"
  );

  try {
    const pdfjs = await import("pdfjs-dist");

    // Use the worker from CDN matching installed version
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

    console.log("📄 PDF 页数:", pdf.numPages);

    let fullText = "";

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
        console.log(
          `📊 检测到双栏布局，分割点: ${columnSplit.toFixed(
            0
          )}px (页宽: ${pageWidth.toFixed(0)}px)`
        );

        // 分别提取左右栏
        const leftItems = items.filter((i) => i.transform[4] < columnSplit);
        const rightItems = items.filter((i) => i.transform[4] >= columnSplit);

        const leftText = extractColumnText(leftItems);
        const rightText = extractColumnText(rightItems);

        // 智能判断哪个是侧边栏（通常侧边栏文字更少）
        if (leftText.length < rightText.length * 0.7) {
          // 左边是侧边栏
          fullText +=
            "[Sidebar - personal information / skills]\n" + leftText + "\n\n";
          fullText +=
            "[Main content - experience / projects]\n" + rightText + "\n";
        } else if (rightText.length < leftText.length * 0.7) {
          // 右边是侧边栏（罕见）
          fullText +=
            "[Main content - experience / projects]\n" + leftText + "\n\n";
          fullText +=
            "[Sidebar - personal information / skills]\n" + rightText + "\n";
        } else {
          // 两栏相近，都作为主内容
          fullText += "[Left column]\n" + leftText + "\n\n";
          fullText += "[Right column]\n" + rightText + "\n";
        }
      } else {
        console.log("📄 单栏布局，按正常顺序提取");
        fullText += extractColumnText(items) + "\n";
      }

      // Add page separator for multi-page documents
      if (pageNum < pdf.numPages) {
        fullText += "\n--- 第 " + (pageNum + 1) + " 页 ---\n\n";
      }
    }

    const result = fullText.trim();

    console.log("✅ PDF 提取完成, 文字长度:", result.length, "字符");
    console.log("📄 提取的文本预览:\n", result.substring(0, 1000));

    if (result.length < 50) {
      throw new Error("PDF 文字提取失败（内容过少，可能是扫描图片格式）");
    }

    return result;
  } catch (error) {
    console.error("❌ PDF 解析错误:", error);

    if (error instanceof Error) {
      if (error.message.includes("Invalid PDF")) {
        throw new Error("无效的 PDF 文件，请检查文件是否损坏");
      }
      if (error.message.includes("Password")) {
        throw new Error("PDF 文件已加密，请先解除密码保护");
      }
      throw error;
    }

    throw new Error("PDF 解析失败，请尝试其他文件");
  }
}

// ============================================
// 智能列分割相关函数
// ============================================

// 检测是否为双栏布局，返回分割点 X 坐标
function detectColumnSplit(
  items: PDFTextItem[],
  pageWidth: number
): number | null {
  // 计算所有文本项的 X 位置分布
  const xPositions = items.map((i) => i.transform[4]);

  // 查找页面中间区域（30%-70%）
  const midRangeStart = pageWidth * 0.3;
  const midRangeEnd = pageWidth * 0.7;

  // 在中间区域寻找"间隙"（没有或很少文本的区域）
  const bucketSize = 10; // 10px 一个桶
  const buckets: number[] = new Array(Math.ceil(pageWidth / bucketSize)).fill(
    0
  );

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

  for (
    let i = Math.floor(midRangeStart / bucketSize);
    i < Math.floor(midRangeEnd / bucketSize);
    i++
  ) {
    if (buckets[i] < 2) {
      // 桶里文本很少，视为间隙
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
  if (items.length === 0) return "";

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
  let text = "";
  for (const line of lines) {
    line.sort((a, b) => a.transform[4] - b.transform[4]);

    let lineText = "";
    let lastX = 0;

    for (const item of line) {
      const x = item.transform[4];
      const gap = x - lastX;

      if (lastX > 0 && gap > 15) {
        lineText += " ";
      }

      lineText += item.str;
      lastX = x + (item.width || 0);
    }

    const trimmed = lineText.trim();
    if (trimmed) {
      text += trimmed + "\n";
    }
  }

  return text.trim();
}
