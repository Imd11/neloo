import { useState, useRef, useEffect, useMemo } from "react";
import { LayoutTemplate, Plus, ArrowUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Feature, localizeFeature } from "@/data/featureTemplates";
import { useLanguage } from "@/providers/LanguageProvider";

interface PlaceholderSegment {
  type: "text" | "placeholder";
  content: string;
  value?: string;
}

type FortuneTemplateDefinition = {
  type: "text" | "placeholder";
  key: string;
};

interface TemplatePromptInputProps {
  placeholder?: string;
  onSubmit?: (value: string) => void;
  className?: string;
  selectedFeature?: Feature | null;
  onClearFeature?: () => void;
  selectedTemplateName?: string | null;
  onClearTemplate?: () => void;
  onPlusClick?: () => void;
}

const FORTUNE_TEMPLATE_DEFINITION: FortuneTemplateDefinition[] = [
  { type: "text", key: "features.fortune_form.solar_prefix" },
  { type: "placeholder", key: "features.fortune_form.year_placeholder" },
  { type: "text", key: "features.fortune_form.year_suffix" },
  { type: "placeholder", key: "features.fortune_form.month_placeholder" },
  { type: "text", key: "features.fortune_form.month_suffix" },
  { type: "placeholder", key: "features.fortune_form.day_placeholder" },
  { type: "text", key: "features.fortune_form.day_suffix" },
  { type: "placeholder", key: "features.fortune_form.hour_placeholder" },
  { type: "text", key: "features.fortune_form.hour_suffix" },
  { type: "placeholder", key: "features.fortune_form.minute_placeholder" },
  { type: "text", key: "features.fortune_form.gender_prefix" },
  { type: "placeholder", key: "features.fortune_form.gender_placeholder" },
  { type: "text", key: "features.fortune_form.birthplace_prefix" },
  { type: "placeholder", key: "features.fortune_form.birthplace_placeholder" },
  { type: "text", key: "features.fortune_form.validation_prefix" },
  { type: "placeholder", key: "features.fortune_form.validation_placeholder" },
];

export function TemplatePromptInput({
  placeholder,
  onSubmit,
  className,
  selectedFeature,
  onClearFeature,
  selectedTemplateName,
  onClearTemplate,
  onPlusClick,
}: TemplatePromptInputProps) {
  const { t } = useLanguage();
  const resolvedPlaceholder = placeholder ?? t("chat.default_placeholder");
  const localizedFeature = useMemo(
    () => (selectedFeature ? localizeFeature(selectedFeature, t) : null),
    [selectedFeature, t]
  );
  const fortuneTemplate = useMemo<PlaceholderSegment[]>(
    () =>
      FORTUNE_TEMPLATE_DEFINITION.map((segment) => ({
        type: segment.type,
        content: t(segment.key),
        value: "",
      })),
    [t]
  );
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [segments, setSegments] = useState<PlaceholderSegment[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Initialize the structured fortune form when the mode is selected.
  useEffect(() => {
    if (selectedFeature?.id === "fortune") {
      setSegments((previous) =>
        fortuneTemplate.map((segment, index) => ({
          ...segment,
          value: previous[index]?.value ?? "",
        }))
      );
      setValue("");
    } else {
      setSegments([]);
    }
  }, [selectedFeature?.id, fortuneTemplate]);

  // Focus the active placeholder editor.
  useEffect(() => {
    if (editingIndex !== null && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingIndex]);

  const handleSubmit = () => {
    if (selectedFeature?.id === "fortune") {
      const requiredPlaceholders = segments.filter(
        (seg) =>
          seg.type === "placeholder" &&
          seg.content !== t("features.fortune_form.validation_placeholder")
      );
      const missingRequiredValue = requiredPlaceholders.some(
        (seg) => !seg.value?.trim()
      );
      if (missingRequiredValue) {
        setValidationError(t("features.fortune_form.required_error"));
        return;
      }

      const fullText = segments
        .map((seg) =>
          seg.type === "placeholder" ? seg.value || seg.content : seg.content
        )
        .join("");
      if (onSubmit) {
        setValidationError(null);
        onSubmit(fullText);
      }
    } else if (value.trim() && onSubmit) {
      onSubmit(value.trim());
      setValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePlaceholderClick = (index: number) => {
    setEditingIndex(index);
  };

  const handlePlaceholderChange = (index: number, newValue: string) => {
    setSegments((prev) =>
      prev.map((seg, i) => (i === index ? { ...seg, value: newValue } : seg))
    );
    setValidationError(null);
  };

  const handlePlaceholderBlur = () => {
    setEditingIndex(null);
  };

  const handlePlaceholderKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setEditingIndex(null);
    } else if (e.key === "Tab") {
      e.preventDefault();
      const placeholderIndices = segments
        .map((seg, i) => (seg.type === "placeholder" ? i : -1))
        .filter((i) => i !== -1);
      const currentPos = placeholderIndices.indexOf(index);
      if (currentPos < placeholderIndices.length - 1) {
        setEditingIndex(placeholderIndices[currentPos + 1]);
      } else {
        setEditingIndex(null);
      }
    }
  };

  const isFortuneMode = selectedFeature?.id === "fortune";

  return (
    <div
      className={cn(
        "relative w-full",
        "rounded-3xl bg-input-bg",
        "border border-border",
        "shadow-xs transition-all duration-200",
        isFocused && "border-ring shadow-[0_0_14px_hsl(var(--glow)/0.2)]",
        className
      )}
    >
      <div
        className={cn(
          "flex gap-2 px-4 py-3",
          isFortuneMode ? "items-start" : "items-center"
        )}
      >
        {/* Plus Button */}
        <Button
          variant="icon"
          size="icon-sm"
          className={cn(
            "shrink-0 text-muted-foreground hover:text-foreground",
            isFortuneMode && "mt-0.5"
          )}
          onClick={onPlusClick}
        >
          <Plus className="h-5 w-5" />
        </Button>

        {/* Selected feature tag */}
        {localizedFeature && !isFortuneMode && (
          <div
            className={cn(
              "group relative flex shrink-0 cursor-default items-center gap-1.5 overflow-hidden rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-150",
              "hover:ring-current/25 hover:shadow-xs hover:ring-1",
              "before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-full before:bg-foreground/10 before:opacity-0 before:transition-opacity before:duration-150 before:content-['']",
              "hover:before:opacity-100",
              localizedFeature.id === "image" &&
                "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
              localizedFeature.id === "web-dev" &&
                "bg-blue-500/15 text-blue-600 dark:text-blue-400",
              localizedFeature.id === "slides" &&
                "bg-orange-500/15 text-orange-600 dark:text-orange-400",
              localizedFeature.id === "resume" &&
                "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
              localizedFeature.id === "prompt-optimize" &&
                "bg-violet-500/15 text-violet-600 dark:text-violet-400",
              localizedFeature.id === "deai" &&
                "bg-rose-500/15 text-rose-600 dark:text-rose-400"
            )}
          >
            <span className="relative z-10">{localizedFeature.title}</span>
            <button
              onClick={onClearFeature}
              type="button"
              className="hover:bg-current/45 relative z-10 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full transition-all duration-150 hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95"
              aria-label={t("chat.clear_selected_feature")}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        )}

        {/* Input content */}
        <div className="min-w-0 flex-1">
          {isFortuneMode ? (
            <div className="relative">
              {/* Fortune Feature Tag */}
              <div className="mb-2 flex items-center gap-1.5">
                <div className="hover:ring-current/25 group relative flex cursor-default items-center gap-1.5 overflow-hidden rounded-full bg-amber-500/15 px-3 py-1.5 text-sm font-medium text-amber-600 transition-all duration-150 hover:shadow-xs hover:ring-1 dark:text-amber-400">
                  <span className="relative z-10">
                    {localizedFeature?.title ?? selectedFeature.title}
                  </span>
                  <button
                    onClick={onClearFeature}
                    type="button"
                    className="hover:bg-current/45 relative z-10 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full transition-all duration-150 hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95"
                    aria-label={t("chat.clear_selected_feature")}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
                {selectedTemplateName && (
                  <div className="flex items-center gap-1.5 rounded-full bg-muted/40 px-3 py-1.5 text-sm text-foreground">
                    <LayoutTemplate className="h-3.5 w-3.5 opacity-60" />
                    <span className="max-w-[140px] truncate">
                      {selectedTemplateName}
                    </span>
                    {onClearTemplate && (
                      <button
                        onClick={onClearTemplate}
                        type="button"
                        className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full transition-all duration-150 hover:scale-110 hover:bg-foreground/10"
                        aria-label={t("chat.clear_selected_template")}
                      >
                        <X className="h-2.5 w-2.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Structured template text */}
              <div
                className="text-base leading-relaxed text-foreground"
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              >
                {segments.map((segment, index) => {
                  if (segment.type === "text") {
                    const parts = segment.content.split("\n");
                    return (
                      <span
                        key={index}
                        className="text-foreground"
                      >
                        {parts.map((part, partIndex) => (
                          <span key={partIndex}>
                            {partIndex > 0 && <br />}
                            {part}
                          </span>
                        ))}
                      </span>
                    );
                  }

                  const hasValue = segment.value && segment.value.trim() !== "";
                  const isEditing = editingIndex === index;

                  const displayText = hasValue
                    ? segment.value
                    : segment.content;

                  return (
                    <span
                      key={index}
                      onClick={() =>
                        !isEditing && handlePlaceholderClick(index)
                      }
                      className="relative mx-0.5 inline-block cursor-pointer rounded bg-placeholder-accent/15 text-placeholder-accent"
                    >
                      {/* Keeps dimensions stable while the inline editor is active. */}
                      <span
                        className={cn(
                          "inline-block whitespace-pre px-1.5 py-0.5 text-base leading-relaxed",
                          isEditing && "invisible"
                        )}
                      >
                        {displayText}
                      </span>

                      {/* Overlay editor uses matching spacing to avoid layout jumps. */}
                      {isEditing && (
                        <input
                          ref={editInputRef}
                          type="text"
                          value={segment.value || ""}
                          onChange={(e) =>
                            handlePlaceholderChange(index, e.target.value)
                          }
                          onBlur={handlePlaceholderBlur}
                          onKeyDown={(e) => handlePlaceholderKeyDown(e, index)}
                          placeholder={segment.content}
                          className="absolute inset-0 m-0 h-full w-full appearance-none border-none bg-transparent px-1.5 py-0.5 text-base leading-relaxed text-placeholder-accent outline-none placeholder:text-placeholder-accent"
                          style={{
                            caretColor: "currentColor",
                            font: "inherit",
                          }}
                        />
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder={localizedFeature?.placeholder || resolvedPlaceholder}
              className="w-full bg-transparent text-base leading-5 text-foreground outline-none placeholder:text-muted-foreground"
            />
          )}
        </div>

        {/* Send Button */}
        <Button
          variant="send"
          size="icon-sm"
          onClick={handleSubmit}
          className={cn("shrink-0", isFortuneMode && "mt-0.5")}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
      {validationError && (
        <div className="px-4 pb-3 text-sm text-destructive">
          {validationError}
        </div>
      )}
    </div>
  );
}
