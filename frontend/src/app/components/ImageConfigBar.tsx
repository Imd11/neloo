import { ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/providers/LanguageProvider";

// Ratio options matching the server-side image API size parameter.
const ratios = [
    { label: "自动", value: "auto" },
    { label: "1:1", value: "1x1" },
    { label: "16:9", value: "16x9" },
    { label: "9:16", value: "9x16" },
    { label: "4:3", value: "4x3" },
    { label: "3:4", value: "3x4" },
];
export type ImageRatio = "auto" | "1x1" | "16x9" | "9x16" | "4x3" | "3x4";

// Resolution options matching backend MODEL_MAP
const resolutions = [
    { label: "1K", value: "1k" },
    { label: "2K", value: "2k" },
    { label: "4K", value: "4k" },
];
export type Resolution = "1k" | "2k" | "4k";

interface ImageConfigBarProps {
    ratio?: ImageRatio;
    onRatioChange?: (ratio: ImageRatio) => void;
    resolution?: Resolution;
    onResolutionChange?: (resolution: Resolution) => void;
}

export function ImageConfigBar({
    ratio = "auto",
    onRatioChange,
    resolution = "1k",
    onResolutionChange
}: ImageConfigBarProps) {
    const { t } = useLanguage();
    const selectedRatio = ratios.find(r => r.value === ratio) || ratios[0];
    const selectedResolution = resolutions.find(r => r.value === resolution) || resolutions[0];
    const ratioLabel = selectedRatio.value === "auto" ? t("image.auto") : selectedRatio.label;

    return (
        <div className="flex flex-wrap items-center gap-3 justify-center">
            {/* Ratio Selector */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 bg-input-bg border-border hover:bg-hover-bg"
                    >
                        {t("image.ratio")}: {ratioLabel}
                        <ChevronDown className="w-4 h-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="start"
                    className="bg-popover border-border min-w-32"
                >
                    {ratios.map((r) => (
                        <DropdownMenuItem
                            key={r.value}
                            onClick={() => onRatioChange?.(r.value as ImageRatio)}
                            className={cn(
                                "flex items-center justify-between cursor-pointer",
                                "text-foreground hover:bg-hover-bg focus:bg-hover-bg",
                                selectedRatio.value === r.value && "bg-accent"
                            )}
                        >
                            {r.value === "auto" ? t("image.auto") : r.label}
                            {selectedRatio.value === r.value && (
                                <Check className="w-4 h-4" />
                            )}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Resolution Selector (model is now in TopBar) */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 bg-input-bg border-border hover:bg-hover-bg"
                    >
                        {t("image.resolution")}: {selectedResolution.label}
                        <ChevronDown className="w-4 h-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="start"
                    className="bg-popover border-border min-w-40"
                >
                    {resolutions.map((res) => (
                        <DropdownMenuItem
                            key={res.value}
                            onClick={() => onResolutionChange?.(res.value as Resolution)}
                            className={cn(
                                "flex items-center justify-between cursor-pointer",
                                "text-foreground hover:bg-hover-bg focus:bg-hover-bg",
                                selectedResolution.value === res.value && "bg-accent"
                            )}
                        >
                            {res.label}
                            {selectedResolution.value === res.value && (
                                <Check className="w-4 h-4" />
                            )}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
