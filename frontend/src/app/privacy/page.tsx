"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b border-border">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <Link href="/">
                        <Button variant="ghost" size="sm" className="gap-2">
                            <ArrowLeft className="w-4 h-4" />
                            返回
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-6 py-12">
                <h1 className="text-3xl font-bold text-foreground mb-2">隐私政策</h1>
                <p className="text-sm text-muted-foreground mb-8">最后更新：2026年1月18日</p>

                <div className="prose prose-neutral dark:prose-invert max-w-none">
                    <p className="text-muted-foreground leading-relaxed mb-8">
                        感谢您使用 Neloo（以下简称"我们"或"本服务"）。我们非常重视您的隐私和数据安全。
                        本隐私政策旨在帮助您了解我们如何收集、使用、存储和保护您的信息。
                    </p>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-foreground mb-4">1. 我们收集的信息</h2>
                        <p className="text-muted-foreground mb-4">当您使用 Neloo 时，我们可能会收集以下类型的信息：</p>
                        <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                            <li><strong>账户信息：</strong>您的邮箱地址、用户名和个人资料信息</li>
                            <li><strong>上传的文件：</strong>您通过本地上传或 Google Drive 导入的数据文件（如 CSV、Excel、PDF 等）</li>
                            <li><strong>对话记录：</strong>您与 AI 助手的对话内容和分析结果</li>
                            <li><strong>使用数据：</strong>您使用本服务的方式、功能偏好和交互记录</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-foreground mb-4">2. Google Drive 访问</h2>
                        <p className="text-muted-foreground mb-4">
                            当您选择从 Google Drive 导入文件时，我们会请求对您 Google Drive 的只读访问权限。
                            我们仅会访问您明确选择的文件，不会访问您 Google Drive 中的其他内容。
                        </p>
                        <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                            <li><strong>访问范围：</strong>仅限您选择的特定文件</li>
                            <li><strong>权限类型：</strong>只读权限（我们不会修改或删除您的文件）</li>
                            <li><strong>数据用途：</strong>仅用于您请求的 AI 数据分析任务</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-foreground mb-4">3. 信息使用方式</h2>
                        <p className="text-muted-foreground mb-4">我们收集的信息将用于：</p>
                        <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                            <li>提供、维护和改进我们的 AI 数据分析服务</li>
                            <li>处理和存储您的数据分析结果</li>
                            <li>响应您的客户服务请求</li>
                            <li>发送服务相关的通知和更新</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-foreground mb-4">4. 数据存储与安全</h2>
                        <p className="text-muted-foreground mb-4">
                            您上传的文件和分析结果将安全地存储在您的个人账户中，方便您后续访问和使用。
                        </p>
                        <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                            <li><strong>存储位置：</strong>数据存储在安全的云服务器上</li>
                            <li><strong>加密保护：</strong>传输和存储过程中采用行业标准加密</li>
                            <li><strong>访问控制：</strong>只有您本人可以访问您的数据</li>
                            <li><strong>数据删除：</strong>您可以随时删除您的数据和账户</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-foreground mb-4">5. 数据共享</h2>
                        <p className="text-muted-foreground mb-4">
                            我们不会出售、出租或以其他方式与第三方共享您的个人数据，除非：
                        </p>
                        <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                            <li>获得您的明确同意</li>
                            <li>法律法规要求</li>
                            <li>保护我们的合法权益</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-foreground mb-4">6. 第三方服务</h2>
                        <p className="text-muted-foreground mb-4">
                            我们使用以下第三方服务来提供更好的用户体验：
                        </p>
                        <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                            <li><strong>Google Drive API：</strong>用于文件导入功能</li>
                            <li><strong>身份验证服务：</strong>用于安全登录</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-foreground mb-4">7. 您的权利</h2>
                        <p className="text-muted-foreground mb-4">您对您的个人数据拥有以下权利：</p>
                        <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                            <li><strong>访问权：</strong>查看我们收集的关于您的信息</li>
                            <li><strong>更正权：</strong>更新或更正您的个人信息</li>
                            <li><strong>删除权：</strong>请求删除您的数据和账户</li>
                            <li><strong>撤销权：</strong>随时撤销 Google Drive 的访问授权</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-foreground mb-4">8. 隐私政策更新</h2>
                        <p className="text-muted-foreground">
                            我们可能会不时更新本隐私政策。更新后的政策将在本页面发布，并更新"最后更新"日期。
                            建议您定期查看本页面以了解最新的隐私保护措施。
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-foreground mb-4">9. 联系我们</h2>
                        <p className="text-muted-foreground">
                            如果您对本隐私政策有任何疑问或需要行使您的数据权利，请通过以下方式联系我们：
                        </p>
                        <p className="text-muted-foreground mt-4">
                            <strong>邮箱：</strong>{" "}
                            <a href="mailto:support@example.com" className="text-primary hover:underline">
                                support@example.com
                            </a>
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
