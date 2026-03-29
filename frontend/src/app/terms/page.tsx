"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TermsPage() {
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
                <h1 className="text-3xl font-bold text-foreground mb-2">服务条款</h1>
                <p className="text-sm text-muted-foreground mb-8">最后更新：2026年1月18日</p>

                <div className="prose prose-neutral dark:prose-invert max-w-none">
                    <p className="text-muted-foreground leading-relaxed mb-8">
                        欢迎使用 Neloo（以下简称"本服务"）。请在使用本服务前仔细阅读以下服务条款。
                        使用本服务即表示您同意接受这些条款的约束。
                    </p>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-foreground mb-4">1. 服务说明</h2>
                        <p className="text-muted-foreground mb-4">
                            Neloo 是一款 AI 驱动的数据分析助手，提供以下功能：
                        </p>
                        <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                            <li>数据文件上传和分析</li>
                            <li>Google Drive 文件导入</li>
                            <li>AI 辅助的数据处理和可视化</li>
                            <li>Python 代码执行和数据操作</li>
                            <li>文档生成和报告创建</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-foreground mb-4">2. 账户注册</h2>
                        <p className="text-muted-foreground mb-4">
                            使用本服务需要注册账户。您在注册时需提供准确、完整的信息，并有责任：
                        </p>
                        <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                            <li>保护您的账户凭据安全</li>
                            <li>及时更新您的账户信息</li>
                            <li>对您账户下的所有活动负责</li>
                            <li>发现未授权使用时立即通知我们</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-foreground mb-4">3. 可接受的使用</h2>
                        <p className="text-muted-foreground mb-4">您同意不会将本服务用于：</p>
                        <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                            <li>任何非法或未经授权的目的</li>
                            <li>上传或处理违法、有害或侵权的内容</li>
                            <li>干扰或破坏服务的正常运行</li>
                            <li>尝试未经授权访问系统或其他用户数据</li>
                            <li>规避任何安全措施或访问限制</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-foreground mb-4">4. 知识产权</h2>
                        <p className="text-muted-foreground mb-4">
                            <strong>您的内容：</strong>您保留您上传到本服务的所有数据和文件的所有权。
                            您授予我们处理这些内容以提供服务所需的有限许可。
                        </p>
                        <p className="text-muted-foreground">
                            <strong>我们的内容：</strong>本服务的软件、设计、商标和其他内容归我们所有，
                            受知识产权法保护。未经授权不得复制、修改或分发。
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-foreground mb-4">5. AI 生成内容声明</h2>
                        <p className="text-muted-foreground mb-4">本服务使用人工智能技术，请注意：</p>
                        <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                            <li>AI 生成的分析结果仅供参考，不构成专业建议</li>
                            <li>AI 可能产生不准确或不完整的输出</li>
                            <li>重要决策前请自行验证 AI 分析结果</li>
                            <li>我们不对 AI 输出的准确性承担责任</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-foreground mb-4">6. 服务可用性</h2>
                        <p className="text-muted-foreground">
                            我们努力保持服务的稳定运行，但不保证服务不会中断。
                            我们可能会因维护、升级或其他原因暂停服务，并会尽量提前通知。
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-foreground mb-4">7. 免责声明</h2>
                        <p className="text-muted-foreground">
                            本服务按"现状"提供，不提供任何明示或暗示的保证。
                            在法律允许的最大范围内，我们不对任何间接、偶然、特殊或后果性损害负责。
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-foreground mb-4">8. 条款修改</h2>
                        <p className="text-muted-foreground">
                            我们保留随时修改本服务条款的权利。修改后的条款将在本页面发布。
                            继续使用本服务即表示您接受修改后的条款。
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-foreground mb-4">9. 终止</h2>
                        <p className="text-muted-foreground">
                            您可以随时停止使用本服务并删除您的账户。
                            如果您违反本条款，我们保留暂停或终止您访问权限的权利。
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-foreground mb-4">10. 联系我们</h2>
                        <p className="text-muted-foreground">
                            如果您对本服务条款有任何疑问，请通过以下方式联系我们：
                        </p>
                        <p className="text-muted-foreground mt-4">
                            <strong>邮箱：</strong>{" "}
                            <a href="mailto:jinhang.yang11@gmail.com" className="text-primary hover:underline">
                                jinhang.yang11@gmail.com
                            </a>
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
