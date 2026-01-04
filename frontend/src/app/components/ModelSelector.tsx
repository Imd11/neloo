"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, Bot, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { getConfig } from "@/lib/config";
import { useAuth } from "@/providers/AuthProvider";

interface ModelInfo {
  id: string;
  display_name: string;
  available: boolean;
}

interface ModelSelectorProps {
  selectedModel: string | null;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
}

export function ModelSelector({
  selectedModel,
  onModelChange,
  disabled = false,
}: ModelSelectorProps) {
  const config = getConfig();
  const apiUrl = config?.deploymentUrl || "";
  const { session } = useAuth();

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [defaultModel, setDefaultModel] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch available models from backend
  const fetchModels = useCallback(async () => {
    if (!apiUrl) return;
    setIsLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${apiUrl}/api/models`, { headers });
      if (response.ok) {
        const data = await response.json();
        setModels(data.models || []);
        setDefaultModel(data.default_model);

        // Set initial selection to default if not already set
        if (!selectedModel && data.default_model) {
          onModelChange(data.default_model);
        }
      }
    } catch (error) {
      console.error("Failed to fetch models:", error);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, session, selectedModel, onModelChange]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Get display name for current selection
  const currentModel = models.find((m) => m.id === selectedModel);
  const displayName = currentModel?.display_name || selectedModel || "Select Model";

  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading...</span>
      </Button>
    );
  }

  if (models.length === 0) {
    return (
      <Button variant="ghost" size="sm" disabled className="gap-2">
        <Bot className="h-4 w-4" />
        <span className="text-sm text-muted-foreground">No models available</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="gap-2 hover:bg-accent"
        >
          <Bot className="h-4 w-4" />
          <span className="text-sm font-medium">{displayName}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>Select Model</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {models.map((model) => (
          <DropdownMenuItem
            key={model.id}
            onClick={() => onModelChange(model.id)}
            className={
              model.id === selectedModel
                ? "bg-accent font-medium"
                : ""
            }
          >
            <span className="flex-1">{model.display_name}</span>
            {model.id === defaultModel && (
              <span className="text-xs text-muted-foreground ml-2">default</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
