import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface TemplateCardProps {
  title: string;
  description: string;
  gradient: string;
  previewImage?: string;
  model?: string;
  selected?: boolean;
  onClick?: () => void;
}

export function TemplateCard({
  title,
  description,
  gradient,
  previewImage,
  model,
  selected,
  onClick,
}: TemplateCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative w-full aspect-[4/5] rounded-2xl overflow-hidden",
        "border border-border hover:border-ring",
        "transition-all duration-300",
        "hover:scale-[1.02] hover:shadow-subtle",
        selected && "border-ring ring-2 ring-ring/30"
      )}
    >
      {previewImage ? (
        <>
          <img
            src={previewImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/5" />
        </>
      ) : (
        <div
          className={cn(
            "absolute inset-0",
            gradient,
            "opacity-80 group-hover:opacity-100 transition-opacity"
          )}
        />
      )}

      {/* Model Badge */}
      {model && (
        <div className="absolute top-2 left-2">
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-background/80 backdrop-blur-sm rounded text-foreground/80">
            {model}
          </span>
        </div>
      )}

      {selected && (
        <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background">
          <Check className="h-3 w-3" />
        </div>
      )}

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-4">
        <h3 className={cn("text-sm font-medium mb-1 text-left", previewImage ? "text-white" : "text-foreground")}>
          {title}
        </h3>
        <p className={cn("text-xs text-left line-clamp-2", previewImage ? "text-white/75" : "text-muted-foreground")}>
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
