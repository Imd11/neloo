import { useEffect, useState } from "react";
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
import { getConfig } from "@/lib/config";
import { CHAT_MODEL_BY_ID, CHAT_MODELS, IMAGE_MODELS, LIGHT_LOGOS, type ModelInfo } from "@/lib/models";
import { useLanguage } from "@/providers/LanguageProvider";

interface TopBarProps {
    hideUserActions?: boolean;
    currentModelId?: string;
    onModelSelect?: (modelId: string) => void;
    /** Override which model set to show (route-independent). */
    mode?: "chat" | "image" | "resume" | "slides";
}

export function TopBar({ hideUserActions = false, currentModelId, onModelSelect, mode }: TopBarProps) {
    const { toggle } = useSidebar();
    const { t } = useLanguage();
    const [searchQuery, setSearchQuery] = useState("");
    const [backendModels, setBackendModels] = useState<ModelInfo[]>([]);
    const [imageModels, setImageModels] = useState<ModelInfo[]>(
        IMAGE_MODELS.map((model) => ({ ...model, available: false }))
    );
    const pathname = usePathname();

    const isImagePage = mode ? mode === "image" : pathname === "/image";

    useEffect(() => {
        if (isImagePage) return;

        const apiUrl = getConfig()?.deploymentUrl;
        if (!apiUrl) return;

        let cancelled = false;

        async function fetchModels() {
            try {
                const response = await fetch(`${apiUrl}/api/models`);
                if (!response.ok) return;

                const data = await response.json();
                const fetchedModels: ModelInfo[] = (data.models || []).map((model: {
                    id: string;
                    display_name: string;
                    model_name?: string | null;
                    available: boolean;
                }) => {
                    const localModel = CHAT_MODEL_BY_ID[model.id];
                    return {
                        id: model.id,
                        name: model.model_name || model.display_name || localModel?.name || model.id,
                        logo: localModel?.logo || "/logos/openai.png",
                        provider: localModel?.provider || "Model",
                        available: model.available,
                    };
                });

                if (!cancelled && fetchedModels.length > 0) {
                    setBackendModels(fetchedModels);
                }
            } catch (error) {
                console.error("Failed to fetch backend models:", error);
            }
        }

        void fetchModels();

        return () => {
            cancelled = true;
        };
    }, [isImagePage]);

    useEffect(() => {
        if (!isImagePage) return;

        let cancelled = false;

        async function fetchImageModels() {
            try {
                const response = await fetch("/api/image-providers");
                if (!response.ok) return;

                const data = await response.json();
                const availability = new Map<string, boolean>(
                    (data.models || []).map((model: { id: string; available: boolean }) => [model.id, model.available])
                );
                const modelNames = new Map<string, string>(
                    (data.models || []).map((model: { id: string; model_name?: string }) => [model.id, model.model_name || ""])
                );
                const fetchedModels = IMAGE_MODELS.map((model) => ({
                    ...model,
                    name: modelNames.get(model.id) || model.name,
                    available: availability.get(model.id) ?? false,
                }));

                if (!cancelled) {
                    setImageModels(fetchedModels);
                }
            } catch (error) {
                console.error("Failed to fetch image provider status:", error);
            }
        }

        void fetchImageModels();

        return () => {
            cancelled = true;
        };
    }, [isImagePage]);

    // Select model list based on current page
    const fallbackChatModels = CHAT_MODELS.map((model) => ({ ...model, available: false }));
    const models = isImagePage ? imageModels : (backendModels.length > 0 ? backendModels : fallbackChatModels);

    // Derived state from props or default
    const currentModel = models.find(m => m.id === currentModelId) || models[0];

    const filteredModels = models.filter((model) =>
        model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.provider.toLowerCase().includes(searchQuery.toLowerCase())
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
                            className="gap-2 text-foreground font-medium px-2 transition-none duration-0 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-none data-[state=open]:bg-muted/50"
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
                                placeholder={t("model_selector.search_placeholder")}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 text-sm bg-muted/50 border-none rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                        </div>

                        <div className="max-h-[300px] overflow-y-auto pr-1">
                            {filteredModels.map((model) => (
                                <DropdownMenuItem
                                    key={model.id}
                                    disabled={model.available === false}
                                    onClick={() => {
                                        if (model.available === false) return;
                                        if (onModelSelect) {
                                            onModelSelect(model.id);
                                        }
                                        setSearchQuery("");
                                    }}
                                    className={cn(
                                        "flex items-center gap-2 cursor-pointer rounded-md py-2.5",
                                        "text-foreground hover:bg-muted focus:bg-muted",
                                        model.available === false && "opacity-50 cursor-not-allowed",
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
                                    {model.available === false && (
                                        <span className="text-xs text-muted-foreground flex-shrink-0">{t("model_selector.not_configured")}</span>
                                    )}
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
                            {t("model_selector.quota")}
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
