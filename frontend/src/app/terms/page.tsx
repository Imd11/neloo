"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/providers/LanguageProvider";

const englishSections = [
    ["Software, not a hosted service", "Neloo is provided as open-source software. There is no required Neloo account, subscription, quota plan, or operator-managed support service in this release."],
    ["Your deployment", "The instance operator chooses the hosting provider, model providers, storage, sandbox, integrations, and access controls. The operator is responsible for the costs, credentials, policies, and permissions of those services."],
    ["Acceptable use", "Do not use an instance to violate laws, infringe rights, abuse provider APIs, bypass security controls, or process data you are not authorized to handle."],
    ["AI output", "AI output can be incomplete or inaccurate. Verify important information before relying on it for legal, financial, medical, safety, or other consequential decisions."],
    ["Code execution", "Local sandbox mode runs code on the host machine and is only appropriate for trusted local development. Use E2B or another isolated sandbox for shared deployments."],
    ["Operator notice", "If you make an instance available to others, replace or supplement this notice with terms, privacy information, and contact details appropriate to your deployment and jurisdiction."],
];

const chineseSections = [
    ["软件，而非托管服务", "Neloo 以开源软件形式提供。本版本没有必需的 Neloo 账户、订阅、额度套餐或由项目运营方提供的支持服务。"],
    ["你的部署", "实例运营者自行选择托管商、模型服务商、存储、沙箱、集成和访问控制，并负责这些服务的费用、凭据、政策和权限。"],
    ["可接受使用", "不得利用实例违法、侵犯他人权利、滥用服务商 API、绕过安全控制，或处理无权处理的数据。"],
    ["AI 输出", "AI 输出可能不完整或不准确。在法律、财务、医疗、安全或其他重要决策中使用前，请自行核验。"],
    ["代码执行", "本地沙箱会在主机上运行代码，仅适合可信的本地开发。共享部署请使用 E2B 或其他隔离沙箱。"],
    ["运营者说明", "如果你向他人开放实例，应根据自身部署和所在司法辖区补充或替换为适当的服务条款、隐私说明和联系方式。"],
];

export default function TermsPage() {
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
                    {chinese ? "自托管使用说明" : "Self-hosted Terms of Use"}
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
