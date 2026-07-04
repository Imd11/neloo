import { useMemo } from "react";
import { TemplateCard } from "./TemplateCard";
import { Feature, Template, localizeFeature } from "@/data/featureTemplates";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/providers/LanguageProvider";

interface FeatureTemplateGridProps {
    feature: Feature | null;
    onSelectTemplate?: (template: Template) => void;
}

export function FeatureTemplateGrid({
    feature,
    onSelectTemplate,
}: FeatureTemplateGridProps) {
    const { t } = useLanguage();
    const localizedFeature = useMemo(
        () => feature ? localizeFeature(feature, t) : null,
        [feature, t]
    );
    if (!localizedFeature) return null;

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={localizedFeature.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-4xl mx-auto px-4"
            >
                <h3 className="text-sm font-medium text-muted-foreground mb-4">
                    {t("chat.select_template")}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {localizedFeature.templates.map((template) => (
                        <TemplateCard
                            key={template.id}
                            title={template.title}
                            description={template.description}
                            gradient={template.gradient}
                            previewImage={template.previewImage}
                            model={(template as any).model || "AI"}
                            onClick={() => onSelectTemplate?.(template)}
                        />
                    ))}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
