// App connection data and categories

export type AppCategory =
    | "productivity"
    | "communication"
    | "development"
    | "crm"
    | "social"
    | "storage"
    | "payment"
    | "other";

export interface AppInfo {
    id: string;
    name: string;
    description: string;
    category: AppCategory;
    logo: string;
}

export const categoryLabels: Record<AppCategory, string> = {
    productivity: "生产力",
    communication: "通讯",
    development: "开发",
    crm: "CRM",
    social: "社交",
    storage: "存储",
    payment: "支付",
    other: "其他",
};

export const apps: AppInfo[] = [
    // Productivity
    {
        id: "notion",
        name: "Notion",
        description: "一体化工作空间，用于笔记、文档、知识库和项目管理",
        category: "productivity",
        logo: "/app-logos/notion.png",
    },
    {
        id: "google-calendar",
        name: "Google Calendar",
        description: "日程管理和会议安排工具",
        category: "productivity",
        logo: "/app-logos/google-calendar.png",
    },
    {
        id: "trello",
        name: "Trello",
        description: "可视化项目管理和协作工具",
        category: "productivity",
        logo: "/app-logos/trello.png",
    },
    {
        id: "asana",
        name: "Asana",
        description: "团队项目和任务管理平台",
        category: "productivity",
        logo: "/app-logos/asana.png",
    },

    // Communication
    {
        id: "slack",
        name: "Slack",
        description: "团队即时通讯和协作平台",
        category: "communication",
        logo: "/app-logos/slack.png",
    },
    {
        id: "zoom",
        name: "Zoom",
        description: "视频会议和在线协作工具",
        category: "communication",
        logo: "/app-logos/zoom.png",
    },
    {
        id: "discord",
        name: "Discord",
        description: "社区语音、视频和文字聊天平台",
        category: "communication",
        logo: "/app-logos/discord.png",
    },
    {
        id: "teams",
        name: "Microsoft Teams",
        description: "企业协作和通讯平台",
        category: "communication",
        logo: "/app-logos/teams.png",
    },

    // Development
    {
        id: "github",
        name: "GitHub",
        description: "代码托管和版本控制平台",
        category: "development",
        logo: "/app-logos/github.png",
    },
    {
        id: "gitlab",
        name: "GitLab",
        description: "DevOps 平台，用于代码管理和 CI/CD",
        category: "development",
        logo: "/app-logos/gitlab.png",
    },
    {
        id: "linear",
        name: "Linear",
        description: "现代化的问题跟踪和项目管理工具",
        category: "development",
        logo: "/app-logos/linear.png",
    },
    {
        id: "jira",
        name: "Jira",
        description: "敏捷项目管理和问题跟踪工具",
        category: "development",
        logo: "/app-logos/jira.png",
    },

    // CRM
    {
        id: "salesforce",
        name: "Salesforce",
        description: "领先的客户关系管理平台",
        category: "crm",
        logo: "/app-logos/salesforce.png",
    },
    {
        id: "hubspot",
        name: "HubSpot",
        description: "营销、销售和客户服务平台",
        category: "crm",
        logo: "/app-logos/hubspot.png",
    },

    // Social
    {
        id: "twitter",
        name: "Twitter / X",
        description: "社交媒体和实时信息平台",
        category: "social",
        logo: "/app-logos/twitter.png",
    },
    {
        id: "linkedin",
        name: "LinkedIn",
        description: "职业社交网络平台",
        category: "social",
        logo: "/app-logos/linkedin.png",
    },
    {
        id: "reddit",
        name: "Reddit",
        description: "社区内容分享和讨论平台",
        category: "social",
        logo: "/app-logos/reddit.png",
    },

    // Storage
    {
        id: "google-drive",
        name: "Google Drive",
        description: "云端文件存储和共享服务",
        category: "storage",
        logo: "/app-logos/google-drive.png",
    },
    {
        id: "dropbox",
        name: "Dropbox",
        description: "文件同步和云存储服务",
        category: "storage",
        logo: "/app-logos/dropbox.png",
    },
    {
        id: "onedrive",
        name: "OneDrive",
        description: "微软云存储和文件共享服务",
        category: "storage",
        logo: "/app-logos/onedrive.png",
    },

    // Payment
    {
        id: "stripe",
        name: "Stripe",
        description: "在线支付处理平台",
        category: "payment",
        logo: "/app-logos/stripe.png",
    },
    {
        id: "paypal",
        name: "PayPal",
        description: "全球在线支付服务",
        category: "payment",
        logo: "/app-logos/paypal.png",
    },

    // Other
    {
        id: "gmail",
        name: "Gmail",
        description: "Google 邮件服务",
        category: "other",
        logo: "/app-logos/gmail.png",
    },
    {
        id: "zapier",
        name: "Zapier",
        description: "应用自动化和集成平台",
        category: "other",
        logo: "/app-logos/zapier.png",
    },
];
