import { cn } from "@/lib/utils";
import { ArrowRight, Sparkles } from "lucide-react";

interface TemplateCardProps {
    title: string;
    description: string;
    gradient: string;
    model: string;
    onClick?: () => void;
}

export function TemplateCard({
    title,
    description,
    gradient,
    model,
    onClick,
}: TemplateCardProps) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "group relative flex flex-col p-4 rounded-xl cursor-pointer overflow-hidden",
                "border border-border/50 bg-card hover:border-primary/20",
                "transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
            )}
        >
            {/* Background Gradient */}
            <div
                className={cn(
                    "absolute inset-0 opacity-5 transition-opacity duration-300 group-hover:opacity-10",
                    gradient
                )}
            />

            {/* Content */}
            <div className="relative z-10 flex flex-col h-full">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted/80 text-muted-foreground uppercase tracking-wider">
                        {model || "AI"}
                    </span>
                </div>

                {/* Title & Desc */}
                <h4 className="font-semibold text-sm mb-1 line-clamp-1 group-hover:text-primary transition-colors">
                    {title}
                </h4>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-4 flex-1">
                    {description}
                </p>

                {/* Footer Action */}
                <div className="flex items-center text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors mt-auto">
                    <span>使用模板</span>
                    <ArrowRight className="w-3 h-3 ml-1 transition-transform group-hover:translate-x-1" />
                </div>
            </div>
        </div>
    );
}
