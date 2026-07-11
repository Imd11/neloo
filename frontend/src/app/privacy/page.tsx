"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/providers/LanguageProvider";

const englishSections = [
    ["Self-hosted software", "Neloo is open-source software. The person or organization that deploys an instance is responsible for its privacy notice, data retention, access control, and legal compliance."],
    ["Where data goes", "Prompts, files, conversations, images, and slides are processed by the services configured by the instance operator. This can include the selected AI provider, Supabase, E2B, Composio, and hosting platforms. Neloo does not operate a shared Neloo cloud service."],
    ["Guest sessions", "Neloo does not require an account login. Each browser receives a signed guest session so its local history, files, and presentations are separated from other browsers. Clearing browser storage or losing that session can make locally stored guest data inaccessible."],
    ["Operator responsibilities", "Before inviting other people to a deployed instance, configure a strong guest-session secret, explicit CORS origins, storage access controls, provider restrictions, rate limits, and an operator-specific privacy notice with a real contact method."],
    ["Your choices", "Do not submit sensitive data unless you understand the configured providers and storage. You can delete local browser data, and an instance operator can remove server-side data according to its own retention policy."],
];

const chineseSections = [
    ["自托管软件", "Neloo 是开源软件。部署实例的个人或组织负责其隐私说明、数据保留、访问控制和法律合规。"],
    ["数据去向", "提示词、文件、对话、图片和幻灯片会由实例运营者配置的服务处理，可能包括所选 AI 服务商、Supabase、E2B、Composio 和托管平台。Neloo 不运营共享的 Neloo 云服务。"],
    ["访客会话", "Neloo 不要求账户登录。每个浏览器会获得一个签名访客会话，使其本地历史、文件和演示文稿与其他浏览器隔离。清除浏览器存储或丢失会话后，本地访客数据可能无法再访问。"],
    ["运营者责任", "在邀请他人使用部署实例前，请配置强访客会话密钥、明确的 CORS 来源、存储访问控制、服务商限制、频率限制，以及包含真实联系方式的实例隐私说明。"],
    ["你的选择", "在了解已配置的服务商和存储方式前，请不要提交敏感数据。你可以删除本地浏览器数据；服务器端数据由实例运营者按照其保留政策处理。"],
];

export default function PrivacyPage() {
    const { locale } = useLanguage();
    const chinese = locale.startsWith("zh");
    const sections = chinese ? chineseSections : englishSections;

    return (
        <div className="min-h-screen bg-background">
            <div className="border-b border-border">
                <div className="mx-auto max-w-4xl px-6 py-4">
                    <Link href="/">
                        <Button variant="ghost" size="sm" className="gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            {chinese ? "返回" : "Back"}
                        </Button>
                    </Link>
                </div>
            </div>
            <main className="mx-auto max-w-4xl px-6 py-12">
                <h1 className="mb-2 text-3xl font-bold text-foreground">
                    {chinese ? "自托管隐私说明" : "Self-hosted Privacy Notice"}
                </h1>
                <p className="mb-8 text-sm text-muted-foreground">
                    {chinese ? "最后更新：2026年7月11日" : "Last updated: July 11, 2026"}
                </p>
                <div className="space-y-8">
                    {sections.map(([title, content], index) => (
                        <section key={title}>
                            <h2 className="mb-3 text-xl font-semibold text-foreground">{index + 1}. {title}</h2>
                            <p className="leading-relaxed text-muted-foreground">{content}</p>
                        </section>
                    ))}
                </div>
            </main>
        </div>
    );
}
