"use client";

import { useState, useEffect, useCallback } from "react";
import { getConfig } from "@/lib/config";
import { getSupabaseClient } from "@/lib/supabase/client";

// =============================================================================
// Types
// =============================================================================

export interface Agent {
    id: string;
    user_id: string;
    name: string;
    icon: string;
    description: string;
    system_prompt: string;
    tools: string[];
    is_public: boolean;
    usage_count: number;
    favorite_count?: number;  // Number of times added to user collections
    creator_name?: string;    // Display name of the creator
    created_at: string;
    updated_at: string;
}

export interface AgentCreateInput {
    name: string;
    icon: string;
    description: string;
    system_prompt: string;
    tools: string[];
    is_public: boolean;
}

export interface AgentUpdateInput {
    name?: string;
    icon?: string;
    description?: string;
    system_prompt?: string;
    tools?: string[];
    is_public?: boolean;
}

export interface UseAgentsResult {
    // My agents
    myAgents: Agent[];
    myAgentsLoading: boolean;
    myAgentsError: string | null;
    refreshMyAgents: () => Promise<void>;

    // Store agents
    storeAgents: Agent[];
    storeAgentsLoading: boolean;
    storeAgentsError: string | null;
    refreshStoreAgents: (search?: string, sortBy?: "popular" | "newest") => Promise<void>;

    // CRUD operations
    createAgent: (data: AgentCreateInput) => Promise<Agent | null>;
    updateAgent: (id: string, data: AgentUpdateInput) => Promise<Agent | null>;
    deleteAgent: (id: string) => Promise<boolean>;
    copyAgent: (id: string) => Promise<Agent | null>;
    useAgent: (id: string) => Promise<{ system_prompt: string; tools: string[] } | null>;
    generatePrompt: (name: string, description: string, tools: string[]) => Promise<string | null>;

    // Loading states for mutations
    isCreating: boolean;
    isUpdating: boolean;
    isDeleting: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

async function getAuthHeaders(): Promise<Record<string, string>> {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
    }
    return headers;
}

function getBaseUrl(): string {
    const config = getConfig();
    return config?.deploymentUrl || "";
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useAgents(): UseAgentsResult {
    // State for my agents
    const [myAgents, setMyAgents] = useState<Agent[]>([]);
    const [myAgentsLoading, setMyAgentsLoading] = useState(false);
    const [myAgentsError, setMyAgentsError] = useState<string | null>(null);

    // State for store agents
    const [storeAgents, setStoreAgents] = useState<Agent[]>([]);
    const [storeAgentsLoading, setStoreAgentsLoading] = useState(false);
    const [storeAgentsError, setStoreAgentsError] = useState<string | null>(null);

    // Mutation loading states
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Fetch my agents
    const refreshMyAgents = useCallback(async () => {
        setMyAgentsLoading(true);
        setMyAgentsError(null);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${getBaseUrl()}/api/agents`, {
                method: "GET",
                headers,
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch agents: ${response.status}`);
            }
            const data = await response.json();
            setMyAgents(data.agents || []);
        } catch (error) {
            console.error("Error fetching my agents:", error);
            setMyAgentsError(error instanceof Error ? error.message : "Unknown error");
        } finally {
            setMyAgentsLoading(false);
        }
    }, []);

    // Fetch store agents
    const refreshStoreAgents = useCallback(async (
        search?: string,
        sortBy: "popular" | "newest" = "popular"
    ) => {
        setStoreAgentsLoading(true);
        setStoreAgentsError(null);
        try {
            const headers = await getAuthHeaders();
            const params = new URLSearchParams({ sort_by: sortBy });
            if (search) {
                params.set("search", search);
            }
            const response = await fetch(`${getBaseUrl()}/api/agents/store?${params}`, {
                method: "GET",
                headers,
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch store agents: ${response.status}`);
            }
            const data = await response.json();
            setStoreAgents(data.agents || []);
        } catch (error) {
            console.error("Error fetching store agents:", error);
            setStoreAgentsError(error instanceof Error ? error.message : "Unknown error");
        } finally {
            setStoreAgentsLoading(false);
        }
    }, []);

    // Create agent
    const createAgent = useCallback(async (data: AgentCreateInput): Promise<Agent | null> => {
        setIsCreating(true);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${getBaseUrl()}/api/agents`, {
                method: "POST",
                headers,
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Failed to create agent: ${response.status}`);
            }
            const agent = await response.json();
            // Refresh my agents list
            await refreshMyAgents();
            return agent;
        } catch (error) {
            console.error("Error creating agent:", error);
            throw error;
        } finally {
            setIsCreating(false);
        }
    }, [refreshMyAgents]);

    // Update agent
    const updateAgent = useCallback(async (id: string, data: AgentUpdateInput): Promise<Agent | null> => {
        setIsUpdating(true);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${getBaseUrl()}/api/agents/${id}`, {
                method: "PUT",
                headers,
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Failed to update agent: ${response.status}`);
            }
            const agent = await response.json();
            // Refresh my agents list
            await refreshMyAgents();
            return agent;
        } catch (error) {
            console.error("Error updating agent:", error);
            throw error;
        } finally {
            setIsUpdating(false);
        }
    }, [refreshMyAgents]);

    // Delete agent
    const deleteAgent = useCallback(async (id: string): Promise<boolean> => {
        setIsDeleting(true);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${getBaseUrl()}/api/agents/${id}`, {
                method: "DELETE",
                headers,
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Failed to delete agent: ${response.status}`);
            }
            // Refresh my agents list
            await refreshMyAgents();
            return true;
        } catch (error) {
            console.error("Error deleting agent:", error);
            throw error;
        } finally {
            setIsDeleting(false);
        }
    }, [refreshMyAgents]);

    // Copy agent from store
    const copyAgent = useCallback(async (id: string): Promise<Agent | null> => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${getBaseUrl()}/api/agents/${id}/copy`, {
                method: "POST",
                headers,
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Failed to copy agent: ${response.status}`);
            }
            const agent = await response.json();
            // Refresh my agents list
            await refreshMyAgents();
            return agent;
        } catch (error) {
            console.error("Error copying agent:", error);
            throw error;
        }
    }, [refreshMyAgents]);

    // Use agent (get system prompt for conversation)
    const useAgent = useCallback(async (id: string): Promise<{ system_prompt: string; tools: string[] } | null> => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${getBaseUrl()}/api/agents/${id}/use`, {
                method: "POST",
                headers,
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Failed to use agent: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error("Error using agent:", error);
            throw error;
        }
    }, []);

    // Generate prompt from description
    const generatePrompt = useCallback(async (
        name: string,
        description: string,
        tools: string[]
    ): Promise<string | null> => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${getBaseUrl()}/api/agents/generate-prompt`, {
                method: "POST",
                headers,
                body: JSON.stringify({ name, description, tools }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Failed to generate prompt: ${response.status}`);
            }
            const data = await response.json();
            return data.system_prompt;
        } catch (error) {
            console.error("Error generating prompt:", error);
            throw error;
        }
    }, []);

    // Initial data fetch
    useEffect(() => {
        refreshMyAgents();
        refreshStoreAgents();
    }, [refreshMyAgents, refreshStoreAgents]);

    return {
        // My agents
        myAgents,
        myAgentsLoading,
        myAgentsError,
        refreshMyAgents,

        // Store agents
        storeAgents,
        storeAgentsLoading,
        storeAgentsError,
        refreshStoreAgents,

        // CRUD operations
        createAgent,
        updateAgent,
        deleteAgent,
        copyAgent,
        useAgent,
        generatePrompt,

        // Loading states
        isCreating,
        isUpdating,
        isDeleting,
    };
}
