import { useState } from "react";
import { ChevronDown, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const ratios = [
    { label: "1:1", value: "1:1" },
    { label: "16:9", value: "16:9" },
    { label: "9:16", value: "9:16" },
    { label: "4:3", value: "4:3" },
    { label: "3:4", value: "3:4" },
    { label: "自定义", value: "custom" },
];

// Resolution options matching backend MODEL_MAP
const resolutions = [
    { label: "1K", value: "1k", desc: "标准质量" },
    { label: "2K", value: "2k", desc: "高清质量" },
    { label: "4K", value: "4k", desc: "超高清质量" },
];
export type Resolution = "1k" | "2k" | "4k";

interface ImageConfigBarProps {
    resolution?: Resolution;
    onResolutionChange?: (resolution: Resolution) => void;
}

export function ImageConfigBar({ resolution = "1k", onResolutionChange }: ImageConfigBarProps) {
    const [selectedRatio, setSelectedRatio] = useState("1:1");
    const selectedResolution = resolutions.find(r => r.value === resolution) || resolutions[0];
    const [customWidth, setCustomWidth] = useState("");
    const [customHeight, setCustomHeight] = useState("");

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
                        比例: {selectedRatio}
                        <ChevronDown className="w-4 h-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="start"
                    className="bg-popover border-border min-w-32"
                >
                    {ratios.map((ratio) => (
                        <DropdownMenuItem
                            key={ratio.value}
                            onClick={() => setSelectedRatio(ratio.value)}
                            className={cn(
                                "flex items-center justify-between cursor-pointer",
                                "text-foreground hover:bg-hover-bg focus:bg-hover-bg",
                                selectedRatio === ratio.value && "bg-accent"
                            )}
                        >
                            {ratio.label}
                            {selectedRatio === ratio.value && (
                                <Check className="w-4 h-4" />
                            )}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Custom Size Input (shown when custom is selected) */}
            {selectedRatio === "custom" && (
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        placeholder="宽"
                        value={customWidth}
                        onChange={(e) => setCustomWidth(e.target.value)}
                        className="w-16 px-2 py-1.5 text-sm bg-input-bg border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <span className="text-muted-foreground">×</span>
                    <input
                        type="number"
                        placeholder="高"
                        value={customHeight}
                        onChange={(e) => setCustomHeight(e.target.value)}
                        className="w-16 px-2 py-1.5 text-sm bg-input-bg border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                </div>
            )}

            {/* Resolution Selector (model is now in TopBar) */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 bg-input-bg border-border hover:bg-hover-bg"
                    >
                        <Sparkles className="w-4 h-4 text-primary" />
                        清晰度: {selectedResolution.label}
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
                            <div className="flex flex-col">
                                <span>{res.label}</span>
                                <span className="text-xs text-muted-foreground">{res.desc}</span>
                            </div>
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
