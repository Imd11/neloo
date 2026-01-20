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
        logo: "/app-logos/notion.svg",
    },
    {
        id: "google-calendar",
        name: "Google Calendar",
        description: "日程管理和会议安排工具",
        category: "productivity",
        logo: "/app-logos/google-calendar.svg",
    },
    {
        id: "trello",
        name: "Trello",
        description: "可视化项目管理和协作工具",
        category: "productivity",
        logo: "/app-logos/trello.svg",
    },
    {
        id: "asana",
        name: "Asana",
        description: "团队项目和任务管理平台",
        category: "productivity",
        logo: "/app-logos/asana.svg",
    },

    // Communication
    {
        id: "slack",
        name: "Slack",
        description: "团队即时通讯和协作平台",
        category: "communication",
        logo: "/app-logos/slack.svg",
    },
    {
        id: "zoom",
        name: "Zoom",
        description: "视频会议和在线协作工具",
        category: "communication",
        logo: "/app-logos/zoom.svg",
    },
    {
        id: "discord",
        name: "Discord",
        description: "社区语音、视频和文字聊天平台",
        category: "communication",
        logo: "/app-logos/discord.svg",
    },
    {
        id: "teams",
        name: "Microsoft Teams",
        description: "企业协作和通讯平台",
        category: "communication",
        logo: "/app-logos/teams.svg",
    },

    // Development
    {
        id: "github",
        name: "GitHub",
        description: "代码托管和版本控制平台",
        category: "development",
        logo: "/app-logos/github.svg",
    },
    {
        id: "gitlab",
        name: "GitLab",
        description: "DevOps 平台，用于代码管理和 CI/CD",
        category: "development",
        logo: "/app-logos/gitlab.svg",
    },
    {
        id: "linear",
        name: "Linear",
        description: "现代化的问题跟踪和项目管理工具",
        category: "development",
        logo: "/app-logos/linear.svg",
    },
    {
        id: "jira",
        name: "Jira",
        description: "敏捷项目管理和问题跟踪工具",
        category: "development",
        logo: "/app-logos/jira.svg",
    },

    // CRM
    {
        id: "salesforce",
        name: "Salesforce",
        description: "领先的客户关系管理平台",
        category: "crm",
        logo: "/app-logos/salesforce.svg",
    },
    {
        id: "hubspot",
        name: "HubSpot",
        description: "营销、销售和客户服务平台",
        category: "crm",
        logo: "/app-logos/hubspot.svg",
    },

    // Social
    {
        id: "twitter",
        name: "Twitter / X",
        description: "社交媒体和实时信息平台",
        category: "social",
        logo: "/app-logos/twitter.svg",
    },
    {
        id: "linkedin",
        name: "LinkedIn",
        description: "职业社交网络平台",
        category: "social",
        logo: "/app-logos/linkedin.svg",
    },
    {
        id: "reddit",
        name: "Reddit",
        description: "社区内容分享和讨论平台",
        category: "social",
        logo: "/app-logos/reddit.svg",
    },

    // Storage
    {
        id: "google-drive",
        name: "Google Drive",
        description: "云端文件存储和共享服务",
        category: "storage",
        logo: "/app-logos/google-drive.svg",
    },
    {
        id: "dropbox",
        name: "Dropbox",
        description: "文件同步和云存储服务",
        category: "storage",
        logo: "/app-logos/dropbox.svg",
    },
    {
        id: "onedrive",
        name: "OneDrive",
        description: "微软云存储和文件共享服务",
        category: "storage",
        logo: "/app-logos/onedrive.svg",
    },

    // Payment
    {
        id: "stripe",
        name: "Stripe",
        description: "在线支付处理平台",
        category: "payment",
        logo: "/app-logos/stripe.svg",
    },
    {
        id: "paypal",
        name: "PayPal",
        description: "全球在线支付服务",
        category: "payment",
        logo: "/app-logos/paypal.svg",
    },

    // Other
    {
        id: "gmail",
        name: "Gmail",
        description: "Google 邮件服务",
        category: "other",
        logo: "/app-logos/gmail.svg",
    },
    {
        id: "zapier",
        name: "Zapier",
        description: "应用自动化和集成平台",
        category: "other",
        logo: "/app-logos/zapier.svg",
    },

    // Additional Composio Apps - Productivity
    {
        id: "airtable",
        name: "Airtable",
        description: "电子表格与数据库结合的协作平台",
        category: "productivity",
        logo: "/app-logos/airtable.svg",
    },
    {
        id: "clickup",
        name: "ClickUp",
        description: "一站式项目管理和生产力平台",
        category: "productivity",
        logo: "/app-logos/clickup.svg",
    },
    {
        id: "google-docs",
        name: "Google Docs",
        description: "云端文档编辑和协作工具",
        category: "productivity",
        logo: "/app-logos/google-docs.svg",
    },
    {
        id: "google-sheets",
        name: "Google Sheets",
        description: "云端电子表格和数据分析工具",
        category: "productivity",
        logo: "/app-logos/google-sheets.svg",
    },

    // Additional Composio Apps - Communication
    {
        id: "outlook",
        name: "Outlook",
        description: "微软邮件和日历服务",
        category: "communication",
        logo: "/app-logos/outlook.svg",
    },
    {
        id: "google-meet",
        name: "Google Meet",
        description: "Google 视频会议服务",
        category: "communication",
        logo: "/app-logos/google-meet.svg",
    },

    // Additional Composio Apps - Development
    {
        id: "bitbucket",
        name: "Bitbucket",
        description: "Atlassian 代码托管和协作平台",
        category: "development",
        logo: "/app-logos/bitbucket.svg",
    },
    {
        id: "supabase",
        name: "Supabase",
        description: "开源 Firebase 替代方案，后端即服务",
        category: "development",
        logo: "/app-logos/supabase.svg",
    },

    // Additional Composio Apps - CRM
    {
        id: "zendesk",
        name: "Zendesk",
        description: "客户服务和支持平台",
        category: "crm",
        logo: "/app-logos/zendesk.svg",
    },

    // Additional Composio Apps - Other
    {
        id: "figma",
        name: "Figma",
        description: "协作式界面设计工具",
        category: "other",
        logo: "/app-logos/figma.svg",
    },
    {
        id: "mailchimp",
        name: "Mailchimp",
        description: "邮件营销和自动化平台",
        category: "other",
        logo: "/app-logos/mailchimp.svg",
    },
    {
        id: "shopify",
        name: "Shopify",
        description: "电商平台和在线商店构建工具",
        category: "other",
        logo: "/app-logos/shopify.svg",
    },
];
