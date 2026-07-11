import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, Check, Search, Menu } from "lucide-react";
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
import {
  CHAT_MODEL_BY_ID,
  CHAT_MODELS,
  IMAGE_MODELS,
  LIGHT_LOGOS,
  type ModelInfo,
} from "@/lib/models";
import { useLanguage } from "@/providers/LanguageProvider";

interface TopBarProps {
  currentModelId?: string;
  onModelSelect?: (modelId: string) => void;
  /** Override which model set to show (route-independent). */
  mode?: "chat" | "image" | "resume" | "slides";
}

export function TopBar({ currentModelId, onModelSelect, mode }: TopBarProps) {
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
        const fetchedModels: ModelInfo[] = (data.models || []).map(
          (model: {
            id: string;
            display_name: string;
            model_name?: string | null;
            available: boolean;
          }) => {
            const localModel = CHAT_MODEL_BY_ID[model.id];
            return {
              id: model.id,
              name:
                model.model_name ||
                model.display_name ||
                localModel?.name ||
                model.id,
              logo: localModel?.logo || "/logos/openai.png",
              provider: localModel?.provider || "Model",
              available: model.available,
            };
          }
        );

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
          (data.models || []).map(
            (model: { id: string; available: boolean }) => [
              model.id,
              model.available,
            ]
          )
        );
        const modelNames = new Map<string, string>(
          (data.models || []).map(
            (model: { id: string; model_name?: string }) => [
              model.id,
              model.model_name || "",
            ]
          )
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
  const fallbackChatModels = CHAT_MODELS.map((model) => ({
    ...model,
    available: false,
  }));
  const models = isImagePage
    ? imageModels
    : backendModels.length > 0
    ? backendModels
    : fallbackChatModels;

  // Derived state from props or default
  const currentModel = models.find((m) => m.id === currentModelId) || models[0];

  const filteredModels = models.filter(
    (model) =>
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.provider.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <header className="flex h-14 items-center justify-between border-b border-border/40 bg-background px-4 md:border-none">
      {/* Left Section - Mobile Menu + Model Selector */}
      <div className="flex items-center gap-2">
        {/* Mobile Sidebar Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 text-muted-foreground md:hidden"
          onClick={toggle}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Model Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="gap-2 px-2 font-medium text-foreground transition-none duration-0 hover:bg-muted/50 focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:bg-muted/50"
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center overflow-hidden rounded-full",
                  LIGHT_LOGOS.includes(currentModel.logo) &&
                    "bg-foreground dark:bg-transparent"
                )}
              >
                <img
                  src={currentModel.logo}
                  alt=""
                  className="h-4 w-4 object-contain"
                />
              </span>
              {currentModel.name}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-72 border-border bg-popover p-2"
          >
            {/* Search Input */}
            <div className="relative mb-2 px-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder={t("model_selector.search_placeholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border-none bg-muted/50 py-1.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
                    "flex cursor-pointer items-center gap-2 rounded-md py-2.5",
                    "text-foreground hover:bg-muted focus:bg-muted",
                    model.available === false &&
                      "cursor-not-allowed opacity-50",
                    currentModel.id === model.id && "bg-accent"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-full",
                      LIGHT_LOGOS.includes(model.logo) &&
                        "bg-foreground dark:bg-transparent"
                    )}
                  >
                    <img
                      src={model.logo}
                      alt=""
                      className="h-4 w-4 object-contain"
                    />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium leading-none">
                      {model.name}
                    </span>
                    <span className="mt-0.5 text-xs text-muted-foreground">
                      {model.provider}
                    </span>
                  </div>
                  {model.available === false && (
                    <span className="flex-shrink-0 text-xs text-muted-foreground">
                      {t("model_selector.not_configured")}
                    </span>
                  )}
                  {currentModel.id === model.id && (
                    <Check className="h-4 w-4 flex-shrink-0 text-foreground" />
                  )}
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right Section */}
    </header>
  );
}
