import { useEffect, useMemo } from "react";
import useSWRInfinite from "swr/infinite";
import type { Thread } from "@langchain/langgraph-sdk";
import { getConfig } from "@/lib/config";
import { useAuth } from "@/providers/AuthProvider";

export interface ThreadItem {
  id: string;
  updatedAt: Date;
  status: Thread["status"];
  title: string;
  description: string;
  assistantId?: string;
  type?: "chat" | "image" | "slides";  // 对话类型
}

const DEFAULT_PAGE_SIZE = 20;
const THREADS_FETCH_TIMEOUT_MS = 10000;
const THREADS_CACHE_PREFIX = "neloo:threads-cache";

function buildThreadsCacheKey(
  userId: string | undefined,
  status: Thread["status"] | undefined,
  pageSize: number
) {
  if (!userId) return null;
  return `${THREADS_CACHE_PREFIX}:${userId}:${status ?? "all"}:${pageSize}`;
}

function readThreadsCache(cacheKey: string | null): ThreadItem[] {
  if (!cacheKey || typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item: any): ThreadItem => ({
      ...item,
      updatedAt: new Date(item.updatedAt),
    }));
  } catch (error) {
    console.warn("[useThreads] Failed to read local cache:", error);
    return [];
  }
}

function writeThreadsCache(cacheKey: string | null, items: ThreadItem[]) {
  if (!cacheKey || typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      cacheKey,
      JSON.stringify(
        items.map((item) => ({
          ...item,
          updatedAt: item.updatedAt.toISOString(),
        }))
      )
    );
  } catch (error) {
    console.warn("[useThreads] Failed to write local cache:", error);
  }
}

export function useThreads(props: {
  status?: Thread["status"];
  limit?: number;
}) {
  const pageSize = props.limit || DEFAULT_PAGE_SIZE;
  const { session, user } = useAuth();
  const cacheKey = useMemo(
    () => buildThreadsCacheKey(user?.id, props?.status, pageSize),
    [user?.id, props?.status, pageSize]
  );
  const cachedThreads = useMemo(() => readThreadsCache(cacheKey), [cacheKey]);

  const swr = useSWRInfinite(
    (pageIndex: number, previousPageData: ThreadItem[] | null) => {
      const config = getConfig();

      if (!config) {
        return null;
      }

      // If the previous page returned no items, we've reached the end
      if (previousPageData && previousPageData.length === 0) {
        return null;
      }

      return {
        kind: "threads" as const,
        pageIndex,
        pageSize,
        deploymentUrl: config.deploymentUrl,
        status: props?.status,
        accessToken: session?.access_token ?? null,
      };
    },
    async ({
      deploymentUrl,
      status,
      pageIndex,
      pageSize,
      accessToken,
    }: {
      kind: "threads";
      pageIndex: number;
      pageSize: number;
      deploymentUrl: string;
      status?: Thread["status"];
      accessToken: string | null;
    }) => {
      const fallbackPage = cachedThreads.slice(
        pageIndex * pageSize,
        (pageIndex + 1) * pageSize
      );

      if (!accessToken) {
        // Not authenticated: do not show any history.
        return [];
      }

      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(pageIndex * pageSize),
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), THREADS_FETCH_TIMEOUT_MS);

      try {
        const resp = await fetch(`${deploymentUrl}/api/threads?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          signal: controller.signal,
        });

        if (!resp.ok) {
          return fallbackPage;
        }

        const data = await resp.json();
        const threads = Array.isArray(data?.threads) ? data.threads : [];

        // DB threads do not contain LangGraph status or message previews; keep UI stable with defaults.
        return threads.map((t: any): ThreadItem => ({
          id: t.langgraph_thread_id,
          updatedAt: new Date(t.updated_at || t.created_at || Date.now()),
          status: "idle" as Thread["status"],
          title: t.title || "Untitled Thread",
          description: "",
          assistantId: undefined,
          type: t.type || "chat",  // 默认为 chat
        }));
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.warn(`[useThreads] Request timeout after ${THREADS_FETCH_TIMEOUT_MS}ms`);
        } else {
          console.error("[useThreads] Failed to fetch threads:", error);
        }
        return fallbackPage;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    {
      fallbackData: cachedThreads.length > 0 ? [cachedThreads.slice(0, pageSize)] : undefined,
      revalidateFirstPage: true,
      revalidateOnFocus: true,
    }
  );

  useEffect(() => {
    const flattened = swr.data?.flat() ?? [];
    if (flattened.length === 0) return;
    writeThreadsCache(cacheKey, flattened);
  }, [cacheKey, swr.data]);

  return swr;
}
