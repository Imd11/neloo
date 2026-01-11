import { cn } from "@/lib/utils";

interface TemplateCardProps {
  title: string;
  description: string;
  gradient: string;
  model?: string;
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
    <button
      onClick={onClick}
      className={cn(
        "group relative w-full aspect-[4/5] rounded-2xl overflow-hidden",
        "border border-border hover:border-ring",
        "transition-all duration-300",
        "hover:scale-[1.02] hover:shadow-subtle"
      )}
    >
      {/* Gradient Background */}
      <div
        className={cn(
          "absolute inset-0",
          gradient,
          "opacity-80 group-hover:opacity-100 transition-opacity"
        )}
      />

      {/* Model Badge */}
      {model && (
        <div className="absolute top-2 right-2">
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-background/80 backdrop-blur-sm rounded text-foreground/80">
            {model}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-4">
        <h3 className="text-sm font-medium text-foreground mb-1 text-left">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground text-left line-clamp-2">
          {description}
        </p>
      </div>

      {/* Hover Overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-foreground/5",
          "opacity-0 group-hover:opacity-100",
          "transition-opacity duration-200"
        )}
      />
    </button>
  );
}
