import { useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, Bell, User, Check, Search, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/app/context/SidebarContext";
import { cn } from "@/lib/utils";
import { CHAT_MODELS, IMAGE_MODELS, LIGHT_LOGOS } from "@/lib/models";

interface TopBarProps {
    hideUserActions?: boolean;
    currentModelId?: string;
    onModelSelect?: (modelId: string) => void;
    /** Override which model set to show (route-independent). */
    mode?: "chat" | "image" | "resume" | "slides";
}

export function TopBar({ hideUserActions = false, currentModelId, onModelSelect, mode }: TopBarProps) {
    const { toggle } = useSidebar();
    const [searchQuery, setSearchQuery] = useState("");
    const pathname = usePathname();

    const isImagePage = mode ? mode === "image" : pathname === "/image";

    // Select model list based on current page
    const models = isImagePage ? IMAGE_MODELS : CHAT_MODELS;

    // Derived state from props or default
    const currentModel = models.find(m => m.id === currentModelId) || models[0];

    const filteredModels = models.filter((model) =>
        model.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <header className="h-14 bg-background flex items-center justify-between px-4 border-b border-border/40 md:border-none">
            {/* Left Section - Mobile Menu + Model Selector */}
            <div className="flex items-center gap-2">
                {/* Mobile Sidebar Toggle */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden -ml-2 text-muted-foreground"
                    onClick={toggle}
                >
                    <Menu className="w-5 h-5" />
                </Button>

                {/* Model Selector */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            className="gap-2 text-foreground font-medium hover:bg-muted/50 px-2"
                        >
                            <span className={cn(
                                "w-5 h-5 rounded-full flex items-center justify-center overflow-hidden",
                                LIGHT_LOGOS.includes(currentModel.logo) && "bg-foreground dark:bg-transparent"
                            )}>
                                <img src={currentModel.logo} alt="" className="w-4 h-4 object-contain" />
                            </span>
                            {currentModel.name}
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="start"
                        className="w-72 bg-popover border-border p-2"
                    >
                        {/* Search Input */}
                        <div className="relative mb-2 px-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="搜索模型..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 text-sm bg-muted/50 border-none rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                        </div>

                        <div className="max-h-[300px] overflow-y-auto pr-1">
                            {filteredModels.map((model) => (
                                <DropdownMenuItem
                                    key={model.id}
                                    onClick={() => {
                                        if (onModelSelect) {
                                            onModelSelect(model.id);
                                        }
                                        setSearchQuery("");
                                    }}
                                    className={cn(
                                        "flex items-center gap-2 cursor-pointer rounded-md py-2.5",
                                        "text-foreground hover:bg-muted focus:bg-muted",
                                        currentModel.id === model.id && "bg-accent"
                                    )}
                                >
                                    <span className={cn(
                                        "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden",
                                        LIGHT_LOGOS.includes(model.logo) && "bg-foreground dark:bg-transparent"
                                    )}>
                                        <img src={model.logo} alt="" className="w-4 h-4 object-contain" />
                                    </span>
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <span className="text-sm font-medium leading-none">{model.name}</span>
                                        <span className="text-xs text-muted-foreground mt-0.5">{model.provider}</span>
                                    </div>
                                    {currentModel.id === model.id && (
                                        <Check className="w-4 h-4 text-foreground flex-shrink-0" />
                                    )}
                                </DropdownMenuItem>
                            ))}
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Right Section */}
            {!hideUserActions && (
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                        <Bell className="w-5 h-5" />
                    </Button>
                    <div className="hidden sm:flex items-center">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-foreground text-sm font-normal"
                        >
                            额度
                        </Button>
                    </div>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                        <User className="w-5 h-5" />
                    </Button>
                </div>
            )}
        </header>
    );
}
