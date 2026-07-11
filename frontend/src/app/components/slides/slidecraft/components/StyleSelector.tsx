import React, { useState, useMemo } from "react";
import { ArrowLeft, ArrowRight, Check, Palette, Sliders } from "lucide-react";
import { StyleDimensions } from "../types";
import { PRESETS, recommendPreset } from "../data/presets";

interface StyleSelectorProps {
  topic: string;
  onSelect: (dims: StyleDimensions, presetId?: string) => void;
  onBack: () => void;
}

const TEXTURE_OPTIONS = ["clean", "grid", "organic", "pixel", "paper"] as const;
const MOOD_OPTIONS = [
  "professional",
  "warm",
  "cool",
  "vibrant",
  "dark",
  "neutral",
] as const;
const TYPO_OPTIONS = [
  "geometric",
  "humanist",
  "handwritten",
  "editorial",
  "technical",
] as const;
const DENSITY_OPTIONS = ["minimal", "balanced", "dense"] as const;

const LABELS: Record<string, string> = {
  clean: "干净",
  grid: "网格",
  organic: "有机",
  pixel: "像素",
  paper: "纸质",
  professional: "专业",
  warm: "温暖",
  cool: "冷色",
  vibrant: "活力",
  dark: "暗色",
  neutral: "中性",
  geometric: "几何",
  humanist: "人文",
  handwritten: "手写",
  editorial: "编辑",
  technical: "技术",
  minimal: "极简",
  balanced: "均衡",
  dense: "密集",
};

const StyleSelector: React.FC<StyleSelectorProps> = ({
  topic,
  onSelect,
  onBack,
}) => {
  const recommendedId = useMemo(() => recommendPreset(topic), [topic]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(
    recommendedId
  );
  const [showCustom, setShowCustom] = useState(false);
  const [custom, setCustom] = useState<StyleDimensions>({
    texture: "clean",
    mood: "dark",
    typography: "geometric",
    density: "balanced",
  });

  const handleConfirm = () => {
    if (showCustom) {
      onSelect(custom);
    } else if (selectedPresetId) {
      const preset = PRESETS.find((p) => p.id === selectedPresetId);
      if (preset) onSelect(preset.dimensions, preset.id);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-800 p-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-zinc-400 transition hover:text-white"
        >
          <ArrowLeft size={18} /> 返回
        </button>
        <h2 className="text-lg font-semibold text-zinc-200">选择风格</h2>
        <button
          onClick={handleConfirm}
          disabled={!showCustom && !selectedPresetId}
          className="bg-purple-600 hover:bg-purple-500 flex items-center gap-2 rounded-xl px-5 py-2 font-medium text-white shadow-lg shadow-purple-900/30 transition disabled:bg-zinc-800 disabled:text-zinc-600 disabled:shadow-none"
        >
          确认 <ArrowRight size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pb-20">
        {/* Topic badge */}
        <div className="mb-6 text-center">
          <span className="text-sm text-zinc-500">主题：</span>
          <span className="ml-1 font-medium text-zinc-200">{topic}</span>
        </div>

        {/* Toggle */}
        <div className="mb-8 flex justify-center gap-2">
          <button
            onClick={() => setShowCustom(false)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              !showCustom
                ? "bg-purple-600 text-white"
                : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Palette size={16} /> 预设模板
          </button>
          <button
            onClick={() => setShowCustom(true)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              showCustom
                ? "bg-purple-600 text-white"
                : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Sliders size={16} /> 自定义维度
          </button>
        </div>

        {!showCustom ? (
          /* Presets Grid — with preview images */
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
            {PRESETS.map((preset) => {
              const isSelected = selectedPresetId === preset.id;
              const isRecommended = recommendedId === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => setSelectedPresetId(preset.id)}
                  className={`group relative overflow-hidden rounded-2xl border-2 text-left transition-all duration-200 ${
                    isSelected
                      ? "border-purple-500 shadow-lg shadow-purple-500/20 ring-1 ring-purple-500/30"
                      : "border-zinc-800 hover:border-zinc-600"
                  }`}
                >
                  {/* Preview Image */}
                  <div className="relative aspect-video overflow-hidden bg-zinc-900">
                    <img
                      src={`/presets/${preset.id}.webp`}
                      alt={preset.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    {/* Gradient overlay at bottom */}
                    <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/80 to-transparent" />
                  </div>

                  {/* Label bar */}
                  <div className="bg-zinc-900 px-3.5 py-3">
                    <div className="mb-0.5 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-zinc-100">
                        {preset.name}
                      </h3>
                      <span className="text-purple-400 text-xs">
                        {preset.nameZh}
                      </span>
                    </div>
                    <p className="line-clamp-1 text-[11px] leading-relaxed text-zinc-500">
                      {preset.feel}
                    </p>
                    {/* Mini palette */}
                    <div className="mt-2 flex gap-1">
                      {[
                        preset.colorPalette.background,
                        preset.colorPalette.accent1,
                        preset.colorPalette.accent2,
                        preset.colorPalette.primaryText,
                      ].map((c, i) => (
                        <div
                          key={i}
                          className="h-4 w-4 rounded-full border border-white/10"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Recommended badge */}
                  {isRecommended && (
                    <span className="absolute left-2.5 top-2.5 rounded-lg bg-amber-500/90 px-2.5 py-1 text-[10px] font-bold text-black shadow-lg">
                      ✨ 推荐
                    </span>
                  )}
                  {/* Selected check */}
                  {isSelected && (
                    <div className="bg-purple-500 absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full shadow-lg">
                      <Check
                        size={14}
                        className="text-white"
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          /* Custom Dimensions */
          <div className="mx-auto max-w-2xl space-y-8">
            {(
              [
                ["纹理 Texture", TEXTURE_OPTIONS, "texture"],
                ["氛围 Mood", MOOD_OPTIONS, "mood"],
                ["字体 Typography", TYPO_OPTIONS, "typography"],
                ["密度 Density", DENSITY_OPTIONS, "density"],
              ] as const
            ).map(([label, options, key]) => (
              <div key={key}>
                <h3 className="mb-3 text-sm font-medium text-zinc-300">
                  {label}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() =>
                        setCustom((prev) => ({ ...prev, [key]: opt }))
                      }
                      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                        custom[key] === opt
                          ? "bg-purple-600 text-white"
                          : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      {opt}{" "}
                      <span className="ml-1 text-zinc-500">{LABELS[opt]}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StyleSelector;
