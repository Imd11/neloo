import { cn } from "@/lib/utils";
import { features, Feature } from "@/data/featureTemplates";

// 使用emoji作为图标，更生动有趣
const featureEmojis: Record<string, string> = {
    "web-dev": "🌐",
    "slides": "📊",
    "resume": "📄",
    "prompt-optimize": "✨",
    "fortune": "🔮",
    "deai": "✏️",
};

interface FeatureButtonsProps {
    selectedFeature: Feature | null;
    onSelectFeature: (feature: Feature | null) => void;
}

export function FeatureButtons({
    selectedFeature,
    onSelectFeature,
}: FeatureButtonsProps) {
    // 如果已选中功能，不渲染任何内容
    if (selectedFeature) {
        return null;
    }

    return (
        <div className="flex flex-wrap justify-center gap-3">
            {features.map((feature) => {
                const emoji = featureEmojis[feature.id] || "📌";

                return (
                    <button
                        key={feature.id}
                        onClick={() => onSelectFeature(feature)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2.5 rounded-full",
                            "text-sm font-medium",
                            "bg-muted/50 hover:bg-muted",
                            "border border-border hover:border-border/80",
                            "text-foreground",
                            "transition-all duration-200",
                            "hover:shadow-sm"
                        )}
                    >
                        <span className="text-base">{emoji}</span>
                        <span>{feature.title}</span>
                    </button>
                );
            })}
        </div>
    );
}
