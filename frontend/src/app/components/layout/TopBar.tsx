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

// Model interface
interface ModelInfo {
    id: string;
    name: string;
    logo: string;
    provider: string;
}

// Hardcoded Meloo Models (mapped to available logos)
// Hardcoded Meloo Models (mapped to available logos)
const CHAT_MODELS: ModelInfo[] = [
    // DeepSeek
    { id: "deepseek-chat", name: "DeepSeek V3.2", logo: "/logos/deepseek.png", provider: "DeepSeek" },
    { id: "deepseek-reasoner", name: "DeepSeek V3.2 (思考)", logo: "/logos/deepseek.png", provider: "DeepSeek" },

    // Qwen
    { id: "qwen-plus", name: "Qwen Plus", logo: "/logos/qwen.png", provider: "Alibaba Cloud" },
    { id: "qwen3-max", name: "Qwen3 Max", logo: "/logos/qwen.png", provider: "Alibaba Cloud" },

    // MiniMax
    { id: "minimax-m2", name: "MiniMax M2.1", logo: "/logos/minimax.png", provider: "MiniMax" },

    // Claude (OpenRouter/NewAPI)
    { id: "claude-opus-or", name: "Claude Opus 4.5 (OR)", logo: "/logos/claude.png", provider: "Anthropic" },
    { id: "claude-opus-right", name: "Claude Opus 4.5", logo: "/logos/claude.png", provider: "Anthropic" },
    { id: "claude-opus-right-thinking", name: "Claude Opus 4.5 thinking", logo: "/logos/claude.png", provider: "Anthropic" },
    { id: "claude-sonnet-right", name: "Claude Sonnet 4.5", logo: "/logos/claude.png", provider: "Anthropic" },
    { id: "claude-sonnet-right-thinking", name: "Claude Sonnet 4.5 thinking", logo: "/logos/claude.png", provider: "Anthropic" },
    { id: "claude-opus-tuzi", name: "Claude Opus 4.5 thinking(tuzi)", logo: "/logos/claude.png", provider: "Anthropic" },

    // GLM
    { id: "glm-4.7", name: "GLM-4.7", logo: "/logos/glm.png", provider: "Zhipu AI" },

    // Gemini (Tu-zi)
    { id: "gemini-3-pro", name: "Gemini-3 pro", logo: "/logos/gemini.png", provider: "Google" },

    // GPT (Tu-zi)
    { id: "gpt-5", name: "GPT-5", logo: "/logos/openai.png", provider: "OpenAI" },
    { id: "gpt-5-thinking", name: "GPT-5 thinking", logo: "/logos/openai.png", provider: "OpenAI" },

    // Llama (OpenRouter)
    { id: "llama-4-maverick", name: "Llama 4 Maverick", logo: "/logos/llama.png", provider: "Meta" },
    { id: "llama-3.3-70b", name: "Llama 3.3", logo: "/logos/llama.png", provider: "Meta" },
];

// Logos that need dark background/inversion in light mode
const LIGHT_LOGOS = ["/logos/openai.png", "/logos/grok.png", "/logos/kimi.png", "/logos/midjourney.png", "/logos/sora.png", "/logos/runway.png", "/logos/pika.png", "/logos/luma.png", "/logos/hailuo.png", "/logos/vidu.png"];

// Image generation models
const IMAGE_MODELS: ModelInfo[] = [
    { id: "nano-banana", name: "Nano Banana", logo: "/logos/nano-banana.png", provider: "Tu-zi" },
    { id: "kling-image", name: "可灵 AI", logo: "/logos/kling.png", provider: "Kuaishou" },
    { id: "jimeng-image", name: "即梦", logo: "/logos/jimeng.png", provider: "ByteDance" },
    { id: "midjourney", name: "Midjourney", logo: "/logos/midjourney.png", provider: "Midjourney" },
    { id: "dall-e-3", name: "DALL·E 3", logo: "/logos/openai.png", provider: "OpenAI" },
    { id: "stable-diffusion", name: "Stable Diffusion", logo: "/logos/stability.png", provider: "Stability AI" },
    { id: "minimax-image", name: "MiniMax", logo: "/logos/minimax.png", provider: "MiniMax" },
    { id: "tongyi-wanxiang", name: "通义万相", logo: "/logos/qwen.png", provider: "Alibaba Cloud" },
];



interface TopBarProps {
    hideUserActions?: boolean;
    currentModelId?: string;
    onModelSelect?: (modelId: string) => void;
}

export function TopBar({ hideUserActions = false, currentModelId, onModelSelect }: TopBarProps) {
    const { toggle, collapsed, isMobile } = useSidebar();
    const [searchQuery, setSearchQuery] = useState("");
    const pathname = usePathname();

    const isImagePage = pathname === "/image";

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
