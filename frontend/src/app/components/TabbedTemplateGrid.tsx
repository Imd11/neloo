import { useMemo, useState } from "react";
import { TemplateCard } from "./TemplateCard";
import {
    Template,
    TemplateCategory,
    imageTemplates,
    imageCategories,
    localizeCategory,
    localizeTemplate,
} from "@/data/featureTemplates";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/providers/LanguageProvider";

interface TabbedTemplateGridProps {
    type?: "image";
    onSelectTemplate?: (template: Template) => void;
}

export function TabbedTemplateGrid({ type = "image", onSelectTemplate }: TabbedTemplateGridProps) {
    const { t } = useLanguage();
    const [activeCategory, setActiveCategory] = useState<TemplateCategory>("all");

    const templates = useMemo(
        () => imageTemplates.map((template) => localizeTemplate(template, t)),
        [t]
    );
    const categories = useMemo(
        () => imageCategories.map((category) => localizeCategory(category, t)),
        [t]
    );

    const filteredTemplates = activeCategory === "all"
        ? templates
        : templates.filter(t => t.category === activeCategory);

    return (
        <div className="w-full max-w-4xl mx-auto">
            {/* Category Tabs */}
            <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                {categories.map((category) => (
                    <button
                        key={category.id}
                        onClick={() => setActiveCategory(category.id)}
                        className={cn(
                            "px-4 py-1.5 text-sm rounded-full whitespace-nowrap transition-all",
                            activeCategory === category.id
                                ? "bg-foreground text-background font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                    >
                        {category.label}
                    </button>
                ))}
            </div>

            {/* Template Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredTemplates.map((template) => (
                    <TemplateCard
                        key={template.id}
                        title={template.title}
                        description={template.description}
                        gradient={template.gradient}
                        model={(template as any).model || "AI"}
                        onClick={() => onSelectTemplate?.(template)}
                    />
                ))}
            </div>
        </div>
    );
}
