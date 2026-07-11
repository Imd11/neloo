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
  selectedTemplateId?: number | null;
}

export function TabbedTemplateGrid({
  type = "image",
  onSelectTemplate,
  selectedTemplateId,
}: TabbedTemplateGridProps) {
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

  const filteredTemplates =
    activeCategory === "all"
      ? templates
      : templates.filter((t) => t.category === activeCategory);

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Category Tabs */}
      <div className="scrollbar-hide mb-6 flex items-center gap-1 overflow-x-auto pb-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={cn(
              "whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition-all",
              activeCategory === category.id
                ? "bg-foreground font-medium text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {filteredTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            title={template.title}
            description={template.description}
            gradient={template.gradient}
            previewImage={template.previewImage}
            model={(template as any).model || "AI"}
            selected={selectedTemplateId === template.id}
            onClick={() => onSelectTemplate?.(template)}
          />
        ))}
      </div>
    </div>
  );
}
