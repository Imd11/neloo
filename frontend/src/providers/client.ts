import { Client } from "@langchain/langgraph-sdk";

export function createClient(apiUrl: string, apiKey: string | undefined) {
  return new Client({
    apiKey,
    apiUrl,
    timeoutMs: 600000, // 10 分钟，支持复杂数据分析任务
  });
}
