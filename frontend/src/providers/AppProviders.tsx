"use client";

import { ReactNode, useEffect, useState } from "react";
import { SidebarProvider } from "@/app/context/SidebarContext";
import { ClientProvider } from "@/providers/ClientProvider";
import { useAuth } from "@/providers/AuthProvider";
import { getConfig, StandaloneConfig } from "@/lib/config";

export function AppProviders({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [config, setConfig] = useState<StandaloneConfig | null>(null);

  useEffect(() => {
    setConfig(getConfig());
  }, []);

  // We render children even if not mounted to allow initial render?
  // No, config is needed for ClientProvider.
  // However, hiding everything until mount might cause flicker.
  // But getConfig is fast (env vars).

  // Fallback values
  const deploymentUrl =
    config?.deploymentUrl || process.env.NEXT_PUBLIC_API_URL || "";

  return (
    <SidebarProvider>
      <ClientProvider
        deploymentUrl={deploymentUrl}
        apiKey={config?.langsmithApiKey || ""}
        accessToken={session?.access_token}
      >
        {children}
      </ClientProvider>
    </SidebarProvider>
  );
}
