import { cn } from "@/lib/utils";
import { features, Feature } from "@/data/featureTemplates";

// 使用emoji作为图标，更生动有趣
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
    // 如果已选中功能，不渲染任何内容
    if (selectedFeature) {
        return null;
    }

    const rows: Feature[][] = [];
    for (let index = 0; index < features.length; index += 6) {
        rows.push(features.slice(index, index + 6));
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
