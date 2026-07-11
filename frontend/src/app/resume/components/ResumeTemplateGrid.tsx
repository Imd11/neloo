"use client";

import { FortySecondsCVTemplate } from "../templates/forty-seconds-cv/FortySecondsCVTemplate";
import { AltaCVTemplate } from "../templates/altacv/AltaCVTemplate";
import { MinimalCVTemplate } from "../templates/minimal-cv/MinimalCVTemplate";
import { SidebarCVTemplate } from "../templates/sidebar-cv/SidebarCVTemplate";
import { LuxSleekCVTemplate } from "../templates/luxsleek-cv/LuxSleekCVTemplate";
import { HipsterCVTemplate } from "../templates/hipster-cv/HipsterCVTemplate";
import { TimelineCVTemplate } from "../templates/timeline-cv/TimelineCVTemplate";
import { ModernCVTemplate } from "../templates/modern-cv/ModernCVTemplate";
import { ClassicCVTemplate } from "../templates/classic-cv/ClassicCVTemplate";
import type { ResumeData, StyleSettings } from "../types/resume";
import { defaultResumeData, defaultStyleSettings } from "../types/resume";
import { getPagePreset } from "../lib/pageSize";
import { cn } from "@/lib/utils";

export type TemplateId =
  | "forty-seconds-cv"
  | "altacv"
  | "minimal-cv"
  | "sidebar-cv"
  | "luxsleek-cv"
  | "hipster-cv"
  | "timeline-cv"
  | "modern-cv"
  | "classic-cv";

interface TemplateInfo {
  id: TemplateId;
  name: string;
  description: string;
  category: "professional" | "creative" | "academic" | "modern";
  Component: React.ComponentType<{ data: ResumeData; style: StyleSettings }>;
}

const templates: TemplateInfo[] = [
  {
    id: "forty-seconds-cv",
    name: "Forty Seconds CV",
    description: "双栏布局，适合技术人员",
    category: "professional",
    Component: FortySecondsCVTemplate,
  },
  {
    id: "altacv",
    name: "AltaCV",
    description: "创意风格，含人生哲学板块",
    category: "creative",
    Component: AltaCVTemplate,
  },
  {
    id: "minimal-cv",
    name: "Minimal CV",
    description: "学术风格，简洁优雅",
    category: "academic",
    Component: MinimalCVTemplate,
  },
  {
    id: "sidebar-cv",
    name: "Sidebar CV",
    description: "现代风格，技能展示突出",
    category: "modern",
    Component: SidebarCVTemplate,
  },
  {
    id: "luxsleek-cv",
    name: "LuxSleek CV",
    description: "奢华简约，复古优雅设计",
    category: "professional",
    Component: LuxSleekCVTemplate,
  },
  {
    id: "hipster-cv",
    name: "Hipster CV",
    description: "创意潮流，彩色气泡图",
    category: "creative",
    Component: HipsterCVTemplate,
  },
  {
    id: "timeline-cv",
    name: "Timeline CV",
    description: "可视化时间线，连线点设计",
    category: "professional",
    Component: TimelineCVTemplate,
  },
  {
    id: "modern-cv",
    name: "Modern CV",
    description: "橙色点缀，信息卡片",
    category: "modern",
    Component: ModernCVTemplate,
  },
  {
    id: "classic-cv",
    name: "Classic CV",
    description: "传统商务，深蓝侧栏",
    category: "professional",
    Component: ClassicCVTemplate,
  },
];

const categoryLabels: Record<string, string> = {
  professional: "专业",
  creative: "创意",
  academic: "学术",
  modern: "现代",
};

const categoryColors: Record<string, string> = {
  professional:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  creative:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  academic:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  modern:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

interface ResumeTemplateGridProps {
  activeTemplate: TemplateId;
  onSelectTemplate: (id: TemplateId) => void;
}

export function ResumeTemplateGrid({
  activeTemplate,
  onSelectTemplate,
}: ResumeTemplateGridProps) {
  const pagePreset = getPagePreset(defaultStyleSettings.pageSize);

  return (
    <div className="w-full">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">
        选择模板
      </h3>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {templates.map((template) => {
          const TemplateComponent = template.Component;
          const isActive = activeTemplate === template.id;

          return (
            <button
              key={template.id}
              onClick={() => onSelectTemplate(template.id)}
              className={cn(
                "group relative overflow-hidden rounded-xl border-2 bg-card transition-all",
                isActive
                  ? "border-primary shadow-lg ring-2 ring-primary/20"
                  : "hover:border-primary/50 border-border hover:shadow-md"
              )}
            >
              {/* Live Template Thumbnail */}
              <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                <div
                  className="absolute inset-0 origin-top-left"
                  style={{
                    transform: "scale(0.115)",
                    width: pagePreset.width,
                    height: pagePreset.height,
                    pointerEvents: "none",
                  }}
                >
                  <TemplateComponent
                    data={defaultResumeData}
                    style={defaultStyleSettings}
                  />
                </div>

                {/* Active Badge */}
                {isActive && (
                  <div className="text-primary-foreground absolute right-2 top-2 z-10 rounded-full bg-primary px-2 py-0.5 text-xs font-medium">
                    ✓
                  </div>
                )}

                {/* Category Badge */}
                <div className="absolute bottom-2 left-2 z-10">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      categoryColors[template.category]
                    )}
                  >
                    {categoryLabels[template.category]}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="bg-card p-2.5">
                <h4 className="truncate text-xs font-semibold text-foreground">
                  {template.name}
                </h4>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {template.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { templates };
