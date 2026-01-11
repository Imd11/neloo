import { TemplateCard } from "./TemplateCard";
import { Feature } from "@/data/featureTemplates";
import { Template } from "@/data/featureTemplates"; // Fixed import path
import { motion, AnimatePresence } from "framer-motion";

interface FeatureTemplateGridProps {
    feature: Feature | null;
    onSelectTemplate?: (template: Template) => void;
}

export function FeatureTemplateGrid({
    feature,
    onSelectTemplate,
}: FeatureTemplateGridProps) {
    if (!feature) return null;

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-4xl mx-auto px-4"
            >
                <h3 className="text-sm font-medium text-muted-foreground mb-4">
                    选择模板
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {feature.templates.map((template) => (
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
            </motion.div>
        </AnimatePresence>
    );
}
