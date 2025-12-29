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
}

const DEFAULT_PAGE_SIZE = 20;

export function useThreads(props: {
  status?: Thread["status"];
  limit?: number;
}) {
  const pageSize = props.limit || DEFAULT_PAGE_SIZE;
  const { session } = useAuth();

  return useSWRInfinite(
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

      const resp = await fetch(`${deploymentUrl}/api/threads?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!resp.ok) {
        // If auth fails or backend is unavailable, return empty list rather than leaking global history.
        return [];
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
      }));
    },
    {
      revalidateFirstPage: true,
      revalidateOnFocus: true,
    }
  );
}
