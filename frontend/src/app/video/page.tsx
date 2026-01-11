'use client';

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { RotatingHeadline } from "@/app/components/RotatingHeadline";
import { PromptInput } from "@/app/components/PromptInput";
import { TabbedTemplateGrid } from "@/app/components/TabbedTemplateGrid";
import { Template, videoTemplates } from "@/data/featureTemplates";
import { toast } from "sonner";

import { Suspense } from "react";

function VideoPageContent() {
    const searchParams = useSearchParams();
    const templateId = searchParams.get("template");
    const [initialPrompt, setInitialPrompt] = useState("");

    // Handle template from URL
    useEffect(() => {
        if (templateId) {
            const template = videoTemplates.find(t => t.id === Number(templateId));
            if (template) {
                setInitialPrompt(template.description);
                toast.info(`已加载视频模板: ${template.title}`, {
                    description: "你可以基于此模板修改提示词"
                });
            }
        }
    }, [templateId]);
    const handleSubmit = (value: string) => {
        console.log("Video prompt:", value);
        toast.success("开始生成视频...");
    };

    const handleSelectTemplate = (template: Template) => {
        toast.info(`已选择模板: ${template.title}`);
    };

    return (
        <div className="h-full flex flex-col overflow-y-auto">
            {/* Top Section - Centered Content */}
            <div className="flex-1 flex flex-col items-center px-6">
                <div className="w-full max-w-4xl flex flex-col items-center gap-8 pt-[20vh]">
                    {/* Headline */}
                    <h1 className="text-3xl font-semibold">AI 视频生成</h1>

                    {/* Prompt Input */}
                    <div className="w-full max-w-3xl mx-auto">
                        <PromptInput
                            placeholder="描述你要生成的视频..."
                            initialValue={initialPrompt}
                            onSubmit={handleSubmit}
                            selectedFeature={{
                                id: 'video',
                                title: 'Video',
                                description: '',
                                icon: '',
                                templates: [],
                                placeholder: ''
                            }} // Mock
                        />
                    </div>
                </div>
            </div>

            {/* Template Section */}
            <div className="flex-shrink-0 px-6 py-12">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-lg font-medium text-foreground mb-4">
                        视频模板
                    </h2>
                    <TabbedTemplateGrid type="video" onSelectTemplate={handleSelectTemplate} />
                </div>
            </div>
        </div>
    );
}

export default function VideoPage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen items-center justify-center">
                <p className="text-muted-foreground">Loading...</p>
            </div>
        }>
            <VideoPageContent />
        </Suspense>
    );
}
