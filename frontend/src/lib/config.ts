export interface StandaloneConfig {
  deploymentUrl: string;
  assistantId: string;
  langsmithApiKey?: string;
}

// 从环境变量获取配置 (不再使用 localStorage)
export function getConfig(): StandaloneConfig | null {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  const assistantId = (
    process.env.NEXT_PUBLIC_ASSISTANT_ID || "data_analyst"
  ).trim();
  const langsmithApiKey = process.env.NEXT_PUBLIC_LANGSMITH_API_KEY?.trim();

  if (apiUrl) {
    return {
      deploymentUrl: apiUrl,
      assistantId: assistantId,
      langsmithApiKey: langsmithApiKey,
    };
  }
  return null;
}

// 保留函数签名以保持兼容性，但不再实际保存
export function saveConfig(_config: StandaloneConfig): void {
  // 配置现在完全由环境变量控制，不再保存到 localStorage
  console.warn(
    "saveConfig is deprecated. Configuration is now managed via environment variables."
  );
}
