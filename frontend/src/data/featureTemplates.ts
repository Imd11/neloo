export type TemplateCategory = "all" | "portrait" | "product" | "landscape" | "art" | "anime" | "design";

export interface Template {
    id: number;
    title: string;
    description: string;
    gradient: string;
    model?: string;
    category?: TemplateCategory;
}

export interface Feature {
    id: string;
    title: string;
    icon: string;
    placeholder: string;
    templates: Template[];
    description?: string;
}

export const imageCategories: { id: TemplateCategory; label: string }[] = [
    { id: "all", label: "全部" },
    { id: "portrait", label: "人像" },
    { id: "product", label: "产品" },
    { id: "landscape", label: "风景" },
    { id: "art", label: "艺术" },
    { id: "anime", label: "动漫" },
    { id: "design", label: "设计" },
];

export const videoCategories: { id: TemplateCategory; label: string }[] = [
    { id: "all", label: "全部" },
    { id: "portrait", label: "人物" },
    { id: "landscape", label: "场景" },
    { id: "art", label: "特效" },
    { id: "product", label: "产品" },
    { id: "anime", label: "动漫" },
    { id: "design", label: "电影" },
];

// 图片生成模板
export const imageTemplates: Template[] = [
    {
        id: 1,
        title: "电影海报",
        description: "生成专业的电影海报风格图片",
        gradient: "bg-gradient-to-br from-rose-900 via-pink-800 to-purple-900",
        category: "design",
    },
    {
        id: 2,
        title: "产品展示",
        description: "简洁的产品展示背景与光效",
        gradient: "bg-gradient-to-br from-blue-900 via-indigo-800 to-violet-900",
        category: "product",
    },
    {
        id: 3,
        title: "自然风光",
        description: "壮观的自然景观与风景照片",
        gradient: "bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900",
        category: "landscape",
    },
    {
        id: 4,
        title: "抽象艺术",
        description: "创意抽象艺术与几何图案",
        gradient: "bg-gradient-to-br from-amber-900 via-orange-800 to-red-900",
        category: "art",
    },
    {
        id: 5,
        title: "人物肖像",
        description: "专业的人物肖像与头像生成",
        gradient: "bg-gradient-to-br from-slate-800 via-zinc-700 to-neutral-800",
        category: "portrait",
    },
    {
        id: 6,
        title: "动漫风格",
        description: "日式动漫与插画风格",
        gradient: "bg-gradient-to-br from-pink-800 via-fuchsia-700 to-purple-800",
        category: "anime",
    },
    {
        id: 7,
        title: "建筑设计",
        description: "现代建筑与室内设计渲染",
        gradient: "bg-gradient-to-br from-gray-800 via-stone-700 to-neutral-800",
        category: "design",
    },
    {
        id: 8,
        title: "科幻场景",
        description: "未来科技与太空主题",
        gradient: "bg-gradient-to-br from-cyan-900 via-blue-800 to-indigo-900",
        category: "landscape",
    },
    {
        id: 9,
        title: "复古怀旧",
        description: "经典复古与胶片风格",
        gradient: "bg-gradient-to-br from-yellow-900 via-amber-800 to-orange-900",
        category: "art",
    },
    {
        id: 10,
        title: "水彩画",
        description: "柔和的水彩艺术风格",
        gradient: "bg-gradient-to-br from-sky-800 via-cyan-700 to-teal-800",
        category: "art",
    },
    {
        id: 11,
        title: "黑白摄影",
        description: "高对比度黑白艺术照片",
        gradient: "bg-gradient-to-br from-zinc-900 via-neutral-800 to-gray-900",
        category: "portrait",
    },
    {
        id: 12,
        title: "3D 渲染",
        description: "逼真的 3D 模型与场景",
        gradient: "bg-gradient-to-br from-violet-900 via-purple-800 to-indigo-900",
        category: "design",
    },
];

// 视频生成模板 - 按热门分类
export const videoTemplates: Template[] = [
    // 人物动画
    {
        id: 1,
        title: "人物说话",
        description: "让静态人物开口说话，口型同步",
        gradient: "bg-gradient-to-br from-rose-900 via-pink-800 to-red-900",
        model: "Kling",
        category: "portrait",
    },
    {
        id: 2,
        title: "舞蹈动作",
        description: "生成流畅的人物舞蹈视频",
        gradient: "bg-gradient-to-br from-fuchsia-900 via-purple-800 to-pink-900",
        model: "Pika",
        category: "portrait",
    },
    // 自然场景
    {
        id: 3,
        title: "风景延时",
        description: "云卷云舒、日出日落延时摄影",
        gradient: "bg-gradient-to-br from-sky-900 via-blue-800 to-cyan-900",
        model: "Runway Gen-3",
        category: "landscape",
    },
    {
        id: 4,
        title: "水流动画",
        description: "河流、瀑布、海浪等水体动态",
        gradient: "bg-gradient-to-br from-cyan-900 via-teal-800 to-emerald-900",
        model: "Sora",
        category: "landscape",
    },
    // 创意特效
    {
        id: 5,
        title: "变形过渡",
        description: "物体间的丝滑变形转换效果",
        gradient: "bg-gradient-to-br from-violet-900 via-purple-800 to-indigo-900",
        model: "Runway Gen-3",
        category: "art",
    },
    {
        id: 6,
        title: "粒子特效",
        description: "烟雾、火焰、星尘等粒子效果",
        gradient: "bg-gradient-to-br from-orange-900 via-amber-800 to-yellow-900",
        model: "Kling",
        category: "art",
    },
    // 产品展示
    {
        id: 7,
        title: "产品360°",
        description: "产品360度旋转展示动画",
        gradient: "bg-gradient-to-br from-slate-800 via-zinc-700 to-neutral-800",
        model: "Pika",
        category: "product",
    },
    {
        id: 8,
        title: "开箱动画",
        description: "产品开箱与展示动态效果",
        gradient: "bg-gradient-to-br from-emerald-900 via-green-800 to-teal-900",
        model: "Minimax",
        category: "product",
    },
    // 动漫风格
    {
        id: 9,
        title: "动漫角色",
        description: "二次元角色动态动画生成",
        gradient: "bg-gradient-to-br from-pink-800 via-rose-700 to-red-800",
        model: "AnimateDiff",
        category: "anime",
    },
    {
        id: 10,
        title: "漫画分镜",
        description: "静态漫画转动态分镜视频",
        gradient: "bg-gradient-to-br from-indigo-900 via-blue-800 to-purple-900",
        model: "Kling",
        category: "anime",
    },
    // 电影质感
    {
        id: 11,
        title: "电影镜头",
        description: "专业电影级运镜与画面感",
        gradient: "bg-gradient-to-br from-gray-900 via-neutral-800 to-zinc-900",
        model: "Sora",
        category: "design",
    },
    {
        id: 12,
        title: "慢动作",
        description: "高帧率丝滑慢动作特效",
        gradient: "bg-gradient-to-br from-blue-900 via-indigo-800 to-violet-900",
        model: "Runway Gen-3",
        category: "design",
    },
];

export const features: Feature[] = [
    {
        id: "web-dev",
        title: "网页开发",
        icon: "Globe",
        placeholder: "描述你想要开发的网页...",
        templates: [
            {
                id: 1,
                title: "企业官网",
                description: "专业的企业形象展示网站",
                gradient: "bg-gradient-to-br from-blue-900 via-indigo-800 to-violet-900",
            },
            {
                id: 2,
                title: "电商平台",
                description: "商品展示与购物车功能",
                gradient: "bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900",
            },
            {
                id: 3,
                title: "个人博客",
                description: "简洁优雅的博客模板",
                gradient: "bg-gradient-to-br from-slate-800 via-zinc-700 to-neutral-800",
            },
            {
                id: 4,
                title: "落地页",
                description: "高转化率的营销落地页",
                gradient: "bg-gradient-to-br from-rose-900 via-pink-800 to-purple-900",
            },
            {
                id: 5,
                title: "后台管理",
                description: "数据看板与管理系统",
                gradient: "bg-gradient-to-br from-gray-900 via-neutral-800 to-zinc-900",
            },
            {
                id: 6,
                title: "SaaS产品",
                description: "软件即服务产品界面",
                gradient: "bg-gradient-to-br from-cyan-900 via-blue-800 to-indigo-900",
            },
        ],
    },
    {
        id: "slides",
        title: "制作幻灯片",
        icon: "Presentation",
        placeholder: "描述你的演示文稿主题...",
        templates: [
            {
                id: 1,
                title: "商业提案",
                description: "专业的商业计划书模板",
                gradient: "bg-gradient-to-br from-blue-900 via-indigo-800 to-violet-900",
            },
            {
                id: 2,
                title: "产品发布",
                description: "新产品发布会演示稿",
                gradient: "bg-gradient-to-br from-rose-900 via-pink-800 to-red-900",
            },
            {
                id: 3,
                title: "教育培训",
                description: "课程与培训演示材料",
                gradient: "bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900",
            },
            {
                id: 4,
                title: "年度报告",
                description: "企业年度总结报告",
                gradient: "bg-gradient-to-br from-amber-900 via-orange-800 to-red-900",
            },
            {
                id: 5,
                title: "创意展示",
                description: "视觉冲击力的创意演示",
                gradient: "bg-gradient-to-br from-fuchsia-900 via-purple-800 to-pink-900",
            },
            {
                id: 6,
                title: "极简风格",
                description: "简约大气的演示模板",
                gradient: "bg-gradient-to-br from-slate-800 via-zinc-700 to-neutral-800",
            },
        ],
    },
    {
        id: "resume",
        title: "制作简历",
        icon: "FileUser",
        placeholder: "描述你的职业背景和目标岗位...",
        templates: [
            {
                id: 1,
                title: "专业简约",
                description: "适合职场人士的经典模板",
                gradient: "bg-gradient-to-br from-slate-800 via-zinc-700 to-neutral-800",
            },
            {
                id: 2,
                title: "创意设计",
                description: "适合设计师的创意简历",
                gradient: "bg-gradient-to-br from-pink-800 via-fuchsia-700 to-purple-800",
            },
            {
                id: 3,
                title: "技术极客",
                description: "程序员与工程师专属",
                gradient: "bg-gradient-to-br from-cyan-900 via-blue-800 to-indigo-900",
            },
            {
                id: 4,
                title: "商务精英",
                description: "高管与商务人士模板",
                gradient: "bg-gradient-to-br from-blue-900 via-indigo-800 to-violet-900",
            },
            {
                id: 5,
                title: "学术研究",
                description: "学者与研究人员简历",
                gradient: "bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900",
            },
            {
                id: 6,
                title: "应届生版",
                description: "清新活力的毕业生简历",
                gradient: "bg-gradient-to-br from-sky-800 via-cyan-700 to-teal-800",
            },
        ],
    },
    {
        id: "prompt-optimize",
        title: "提示词优化",
        icon: "Sparkles",
        placeholder: "输入你想要优化的提示词...",
        templates: [
            {
                id: 1,
                title: "图像生成",
                description: "优化AI绘图提示词",
                gradient: "bg-gradient-to-br from-violet-900 via-purple-800 to-indigo-900",
            },
            {
                id: 2,
                title: "文案写作",
                description: "优化营销文案提示词",
                gradient: "bg-gradient-to-br from-amber-900 via-orange-800 to-red-900",
            },
            {
                id: 3,
                title: "代码生成",
                description: "优化编程相关提示词",
                gradient: "bg-gradient-to-br from-cyan-900 via-blue-800 to-indigo-900",
            },
            {
                id: 4,
                title: "角色扮演",
                description: "优化AI角色设定词",
                gradient: "bg-gradient-to-br from-rose-900 via-pink-800 to-purple-900",
            },
            {
                id: 5,
                title: "数据分析",
                description: "优化数据处理提示词",
                gradient: "bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900",
            },
            {
                id: 6,
                title: "通用优化",
                description: "全面提升提示词质量",
                gradient: "bg-gradient-to-br from-slate-800 via-zinc-700 to-neutral-800",
            },
        ],
    },
    {
        id: "fortune",
        title: "五行算命",
        icon: "Moon",
        placeholder: "输入你的出生年月日时...",
        templates: [
            {
                id: 1,
                title: "八字全解",
                description: "综合排盘、格局、用神、喜忌分析",
                gradient: "bg-gradient-to-br from-amber-900 via-yellow-800 to-orange-900",
            },
            {
                id: 2,
                title: "流年运势",
                description: "今年运势、近年走向预测",
                gradient: "bg-gradient-to-br from-purple-900 via-violet-800 to-indigo-900",
            },
            {
                id: 3,
                title: "姻缘桃花",
                description: "感情婚姻、配偶特征分析",
                gradient: "bg-gradient-to-br from-rose-900 via-pink-800 to-red-900",
            },
            {
                id: 4,
                title: "事业发展",
                description: "职业方向、升迁、适合行业",
                gradient: "bg-gradient-to-br from-blue-900 via-indigo-800 to-violet-900",
            },
            {
                id: 5,
                title: "财运分析",
                description: "正财偏财、投资理财指引",
                gradient: "bg-gradient-to-br from-yellow-900 via-amber-800 to-orange-900",
            },
            {
                id: 6,
                title: "健康指引",
                description: "身体注意事项、养生建议",
                gradient: "bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900",
            },
            {
                id: 7,
                title: "性格天赋",
                description: "性格特征、天赋优势分析",
                gradient: "bg-gradient-to-br from-sky-900 via-blue-800 to-cyan-900",
            },
            {
                id: 8,
                title: "子女亲缘",
                description: "与家人的缘分、子女运势",
                gradient: "bg-gradient-to-br from-slate-800 via-zinc-700 to-neutral-800",
            },
        ],
    },
    {
        id: "deai",
        title: "去AI化",
        icon: "Eraser",
        placeholder: "粘贴需要去AI化的文本...",
        templates: [
            {
                id: 1,
                title: "学术论文",
                description: "论文降重与人性化改写",
                gradient: "bg-gradient-to-br from-blue-900 via-indigo-800 to-violet-900",
            },
            {
                id: 2,
                title: "商业文案",
                description: "营销文案自然化处理",
                gradient: "bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900",
            },
            {
                id: 3,
                title: "新闻稿件",
                description: "新闻报道风格转换",
                gradient: "bg-gradient-to-br from-slate-800 via-zinc-700 to-neutral-800",
            },
            {
                id: 4,
                title: "社交媒体",
                description: "让帖子更像真人撰写",
                gradient: "bg-gradient-to-br from-pink-800 via-fuchsia-700 to-purple-800",
            },
            {
                id: 5,
                title: "邮件往来",
                description: "商务邮件人性化改写",
                gradient: "bg-gradient-to-br from-amber-900 via-orange-800 to-red-900",
            },
            {
                id: 6,
                title: "创意写作",
                description: "文学作品风格润色",
                gradient: "bg-gradient-to-br from-violet-900 via-purple-800 to-indigo-900",
            },
        ],
    },
];
