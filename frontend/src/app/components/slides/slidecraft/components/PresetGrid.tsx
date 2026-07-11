import React from "react";
import { Check } from "lucide-react";
import { PRESETS } from "../data/presets";

interface PresetGridProps {
  selectedPresetId: string | null;
  onSelectPreset: (presetId: string) => void;
}

const PresetGrid: React.FC<PresetGridProps> = ({
  selectedPresetId,
  onSelectPreset,
}) => {
  const selectedPreset = PRESETS.find(
    (preset) => preset.id === selectedPresetId
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <div className="mb-4 flex items-center gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          选择 Slide Craft 模板
        </h3>
        {selectedPreset && (
          <span className="bg-purple-500/10 text-purple-500 dark:text-purple-300 rounded-full px-2 py-0.5 text-[10px]">
            已选 {selectedPreset.nameZh || selectedPreset.name}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {PRESETS.map((preset) => {
          const isSelected = selectedPresetId === preset.id;

          return (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset.id)}
              className={`group relative overflow-hidden rounded-2xl border-2 text-left transition-all duration-200 ${
                isSelected
                  ? "border-purple-500 scale-[1.02] shadow-lg shadow-purple-500/20 ring-1 ring-purple-500/30"
                  : "border-border/60 hover:border-border"
              }`}
            >
              <div className="relative aspect-video overflow-hidden bg-zinc-900">
                <img
                  src={`/presets/${preset.id}.webp`}
                  alt={preset.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              </div>

              <div className="bg-zinc-900/95 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-zinc-100">
                    {preset.name}
                  </h4>
                  <span className="text-purple-400 text-[10px]">
                    {preset.nameZh}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-1 text-[9px] leading-tight text-zinc-500">
                  {preset.feel}
                </p>
              </div>

              {isSelected && (
                <>
                  <span className="bg-purple-500 absolute left-2 top-2 rounded-md px-2 py-0.5 text-[9px] font-bold text-white shadow-lg">
                    已选
                  </span>
                  <div className="bg-purple-500 absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full shadow-lg">
                    <Check
                      size={12}
                      className="text-white"
                    />
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PresetGrid;
