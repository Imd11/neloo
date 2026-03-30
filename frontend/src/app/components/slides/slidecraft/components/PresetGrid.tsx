import React from 'react';
import { Check } from 'lucide-react';
import { PRESETS } from '../data/presets';

interface PresetGridProps {
    selectedPresetId: string | null;
    onSelectPreset: (presetId: string) => void;
}

const PresetGrid: React.FC<PresetGridProps> = ({ selectedPresetId, onSelectPreset }) => {
    return (
        <div className="w-full max-w-5xl mx-auto px-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">
                选择 Slide Craft 模板
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {PRESETS.map((preset) => {
                    const isSelected = selectedPresetId === preset.id;

                    return (
                        <button
                            key={preset.id}
                            onClick={() => onSelectPreset(preset.id)}
                            className={`group relative overflow-hidden rounded-2xl border-2 text-left transition-all duration-200 ${
                                isSelected
                                    ? 'scale-[1.02] border-purple-500 shadow-lg shadow-purple-500/20 ring-1 ring-purple-500/30'
                                    : 'border-border/60 hover:border-border'
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
                                    <h4 className="text-xs font-semibold text-zinc-100">{preset.name}</h4>
                                    <span className="text-[10px] text-purple-400">{preset.nameZh}</span>
                                </div>
                                <p className="mt-0.5 line-clamp-1 text-[9px] leading-tight text-zinc-500">{preset.feel}</p>
                            </div>

                            {isSelected && (
                                <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 shadow-lg">
                                    <Check size={12} className="text-white" />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default PresetGrid;
