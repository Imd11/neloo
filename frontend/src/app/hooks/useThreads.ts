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

export type ThreadHistoryStatus =
  | "loading"
  | "ready"
  | "empty"
  | "backend_unavailable"
  | "history_disabled"
  | "access_denied"
  | "error";

export interface ThreadHistoryProblem {
  code: Exclude<ThreadHistoryStatus, "loading" | "ready" | "empty">;
  message: string;
  status?: number;
}

class ThreadHistoryRequestError extends Error {
  readonly problem: ThreadHistoryProblem;

  constructor(problem: ThreadHistoryProblem) {
    super(problem.message);
    this.name = "ThreadHistoryRequestError";
    this.problem = problem;
  }
}

const DEFAULT_PAGE_SIZE = 20;
const THREADS_FETCH_TIMEOUT_MS = 10000;
const THREADS_CACHE_PREFIX = "neloo:threads-cache";

async function readErrorDetail(resp: Response): Promise<string> {
  const body = await resp.json().catch(() => null);
  if (typeof body?.detail === "string") return body.detail;
  return resp.statusText || "Request failed";
}

function makeThreadHistoryProblem(error: unknown): ThreadHistoryProblem {
  if (error instanceof ThreadHistoryRequestError) {
    return error.problem;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      code: "backend_unavailable",
      message: "History could not connect to the backend.",
    };
  }

  if (error instanceof TypeError) {
    return {
      code: "backend_unavailable",
      message: "History could not connect to the backend.",
    };
  }

  return {
    code: "error",
    message: error instanceof Error ? error.message : "History failed to load.",
  };
}

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
          const detail = await readErrorDetail(resp);

          if (resp.status === 503 && detail.toLowerCase().includes("database")) {
            throw new ThreadHistoryRequestError({
              code: "history_disabled",
              status: resp.status,
              message: "Conversation history requires database persistence.",
            });
          }

          if (resp.status === 401 || resp.status === 403) {
            throw new ThreadHistoryRequestError({
              code: "access_denied",
              status: resp.status,
              message: "This conversation history is not available to the current user.",
            });
          }

          throw new ThreadHistoryRequestError({
            code: "error",
            status: resp.status,
            message: detail,
          });
        }

        const data = await resp.json();
        if (data?.history_enabled === false) {
          throw new ThreadHistoryRequestError({
            code: "history_disabled",
            status: 200,
            message: "Conversation history requires database persistence.",
          });
        }

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
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    {
      fallbackData: cachedThreads.length > 0 ? [cachedThreads.slice(0, pageSize)] : undefined,
      revalidateFirstPage: true,
      revalidateOnFocus: true,
      shouldRetryOnError: false,
    }
  );

  useEffect(() => {
    const flattened = swr.data?.flat() ?? [];
    if (flattened.length === 0) return;
    writeThreadsCache(cacheKey, flattened);
  }, [cacheKey, swr.data]);

  const flattened = swr.data?.flat() ?? [];
  const historyProblem = swr.error ? makeThreadHistoryProblem(swr.error) : null;
  const historyStatus: ThreadHistoryStatus = historyProblem
    ? (flattened.length > 0 ? "ready" : historyProblem.code)
    : swr.isLoading && !swr.data
      ? "loading"
      : flattened.length > 0
        ? "ready"
        : "empty";

  return {
    ...swr,
    historyStatus,
    historyProblem,
    hasCachedHistory: cachedThreads.length > 0,
    retryHistory: () => swr.mutate(),
  };
}
