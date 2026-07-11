"use client";

import { useState, useCallback, useEffect } from "react";
import { buildBearerHeaders } from "@/lib/authHeaders";
import { getConfig } from "@/lib/config";
import { useAuth } from "@/providers/AuthProvider";

export interface Trigger {
    id: string;
    agent_id: string;
    user_id: string;
    cron_expression: string;
    timezone: string;
    default_prompt: string | null;
    notification_method: "email" | "in_app" | "none";
    enabled: boolean;
    status: "idle" | "dispatching" | "running";
    last_run: string | null;
    next_run: string | null;
    created_at: string;
    agent_name?: string;
    agent_icon?: string;
}

export interface ExecutionLog {
    id: string;
    trigger_id: string;
    run_id: string;
    thread_id: string | null;
    started_at: string;
    completed_at: string | null;
    status: "pending" | "running" | "success" | "failed";
    error_message: string | null;
}

export interface CreateTriggerData {
    agent_id: string;
    cron_expression: string;
    timezone?: string;
    default_prompt?: string;
    notification_method?: "email" | "in_app" | "none";
    enabled?: boolean;
}

export interface UpdateTriggerData {
    cron_expression?: string;
    timezone?: string;
    default_prompt?: string;
    notification_method?: "email" | "in_app" | "none";
    enabled?: boolean;
}

function getBaseUrl(): string {
    const config = getConfig();
    return config?.deploymentUrl || "";
}

export function useTriggers(agentId?: string) {
    const { session, loading: authLoading } = useAuth();
    const accessToken = session.access_token;
    const [triggers, setTriggers] = useState<Trigger[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch triggers for an agent
    const fetchTriggers = useCallback(async () => {
        if (authLoading || !accessToken) return;
        setLoading(true);
        setError(null);
        try {
            const baseUrl = getBaseUrl();
            const headers = buildBearerHeaders(accessToken);

            const response = await fetch(`${baseUrl}/api/triggers`, { headers });

            if (!response.ok) {
                throw new Error("Failed to fetch triggers");
            }

            const data = await response.json();

            // Filter by agentId if provided
            const filtered = agentId
                ? data.filter((t: Trigger) => t.agent_id === agentId)
                : data;

            setTriggers(filtered);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    }, [agentId, authLoading, accessToken]);

    // Create a new trigger
    const createTrigger = useCallback(async (data: CreateTriggerData): Promise<Trigger | null> => {
        if (authLoading || !accessToken) return null;
        try {
            const baseUrl = getBaseUrl();
            const headers = buildBearerHeaders(accessToken);

            const response = await fetch(`${baseUrl}/api/triggers`, {
                method: "POST",
                headers,
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || "Failed to create trigger");
            }

            const trigger = await response.json();
            setTriggers(prev => [trigger, ...prev]);
            return trigger;
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
            return null;
        }
    }, [authLoading, accessToken]);

    // Update a trigger
    const updateTrigger = useCallback(async (triggerId: string, data: UpdateTriggerData): Promise<Trigger | null> => {
        if (authLoading || !accessToken) return null;
        try {
            const baseUrl = getBaseUrl();
            const headers = buildBearerHeaders(accessToken);

            const response = await fetch(`${baseUrl}/api/triggers/${triggerId}`, {
                method: "PUT",
                headers,
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                throw new Error("Failed to update trigger");
            }

            const updated = await response.json();
            setTriggers(prev => prev.map(t => t.id === triggerId ? updated : t));
            return updated;
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
            return null;
        }
    }, [authLoading, accessToken]);

    // Delete a trigger
    const deleteTrigger = useCallback(async (triggerId: string): Promise<boolean> => {
        if (authLoading || !accessToken) return false;
        try {
            const baseUrl = getBaseUrl();
            const headers = buildBearerHeaders(accessToken);

            const response = await fetch(`${baseUrl}/api/triggers/${triggerId}`, {
                method: "DELETE",
                headers,
            });

            if (!response.ok) {
                throw new Error("Failed to delete trigger");
            }

            setTriggers(prev => prev.filter(t => t.id !== triggerId));
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
            return false;
        }
    }, [authLoading, accessToken]);

    // Toggle trigger enabled/disabled
    const toggleTrigger = useCallback(async (triggerId: string, enabled: boolean): Promise<boolean> => {
        const result = await updateTrigger(triggerId, { enabled });
        return result !== null;
    }, [updateTrigger]);

    // Get execution logs for a trigger
    const getExecutionLogs = useCallback(async (triggerId: string): Promise<ExecutionLog[]> => {
        if (authLoading || !accessToken) return [];
        try {
            const baseUrl = getBaseUrl();
            const headers = buildBearerHeaders(accessToken);

            const response = await fetch(`${baseUrl}/api/triggers/${triggerId}/logs`, { headers });

            if (!response.ok) {
                throw new Error("Failed to fetch logs");
            }

            return await response.json();
        } catch (err) {
            console.error("Failed to fetch execution logs:", err);
            return [];
        }
    }, [authLoading, accessToken]);

    // Manually run a trigger
    const runTrigger = useCallback(async (triggerId: string): Promise<{ success: boolean; run_id?: string }> => {
        if (authLoading || !accessToken) return { success: false };
        try {
            const baseUrl = getBaseUrl();
            const headers = buildBearerHeaders(accessToken);

            const response = await fetch(`${baseUrl}/api/triggers/${triggerId}/run`, {
                method: "POST",
                headers,
            });

            if (!response.ok) {
                throw new Error("Failed to run trigger");
            }

            const result = await response.json();
            // Refresh triggers to get updated status
            await fetchTriggers();
            return { success: true, run_id: result.run_id };
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
            return { success: false };
        }
    }, [authLoading, accessToken, fetchTriggers]);

    // Auto-fetch on mount if agentId provided
    useEffect(() => {
        if (agentId) {
            fetchTriggers();
        }
    }, [agentId, fetchTriggers]);

    return {
        triggers,
        loading,
        error,
        fetchTriggers,
        createTrigger,
        updateTrigger,
        deleteTrigger,
        toggleTrigger,
        getExecutionLogs,
        runTrigger,
    };
}

// Common cron presets for UI
export const CRON_PRESETS = [
    { label: "每小时", value: "0 * * * *", description: "每小时的整点执行" },
    { label: "每天早上9点", value: "0 9 * * *", description: "每天上午9:00执行" },
    { label: "每天晚上8点", value: "0 20 * * *", description: "每天晚上8:00执行" },
    { label: "工作日早上9点", value: "0 9 * * 1-5", description: "周一至周五上午9:00执行" },
    { label: "每周一早上9点", value: "0 9 * * 1", description: "每周一上午9:00执行" },
    { label: "每月1号", value: "0 9 1 * *", description: "每月1号上午9:00执行" },
];
