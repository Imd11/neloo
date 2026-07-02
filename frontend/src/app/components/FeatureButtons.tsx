import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { features, Feature, localizeFeature } from "@/data/featureTemplates";
import { useLanguage } from "@/providers/LanguageProvider";

// Use emoji as icons for a more lively look
const featureEmojis: Record<string, string> = {
    "image": "🖼️",
    "web-dev": "🌐",
    "slides": "📊",
    "resume": "📄",
    "prompt-optimize": "✨",
    "fortune": "🔮",
    "deai": "✏️",
    "translate": "🌍",
};

interface FeatureButtonsProps {
    selectedFeature: Feature | null;
    onSelectFeature: (feature: Feature | null) => void;
}

export function FeatureButtons({
    selectedFeature,
    onSelectFeature,
}: FeatureButtonsProps) {
    const { t } = useLanguage();

    const visibleFeatures = useMemo(
        () => features
            .filter((feature) => !["web-dev", "resume"].includes(feature.id))
            .map((feature) => localizeFeature(feature, t)),
        [t]
    );

    // If a feature is already selected, render nothing
    if (selectedFeature) {
        return null;
    }

    const rows: Feature[][] = [];
    for (let index = 0; index < visibleFeatures.length; index += 6) {
        rows.push(visibleFeatures.slice(index, index + 6));
    }

    return (
        <div className="flex flex-col items-center gap-2">
            {rows.map((row, rowIndex) => (
                <div
                    key={rowIndex}
                    className="flex justify-center gap-2 flex-wrap lg:flex-nowrap"
                >
                    {row.map((feature) => {
                        const emoji = featureEmojis[feature.id] || "📌";

                        return (
                            <button
                                key={feature.id}
                                onClick={() => onSelectFeature(feature)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full",
                                    "text-xs font-medium",
                                    "bg-transparent hover:bg-muted/60",
                                    "border border-border/50 hover:border-border",
                                    "text-muted-foreground hover:text-foreground",
                                    "transition-all duration-150",
                                    "cursor-pointer"
                                )}
                            >
                                <span className="text-sm leading-none">{emoji}</span>
                                <span>{feature.title}</span>
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
