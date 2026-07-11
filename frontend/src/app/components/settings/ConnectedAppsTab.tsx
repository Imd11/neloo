import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Grid, Package, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppCard } from "./AppCard";
import { apps, appCategories, type AppCategory } from "./appsData";
import { toast } from "sonner";
import { useAuth } from "@/providers/AuthProvider";
import { getConfig } from "@/lib/config";
import { useLanguage } from "@/providers/LanguageProvider";

interface ConnectionInfo {
  app_name: string;
  status: string;
  composio_connection_id?: string;
  connected_at?: string;
}

export function ConnectedAppsTab() {
  const { session } = useAuth();
  const config = getConfig();
  const apiUrl = config?.deploymentUrl || "";
  const { t } = useLanguage();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<AppCategory | "all">(
    "all"
  );
  const [connectedAppIds, setConnectedAppIds] = useState<Set<string>>(
    new Set()
  );
  const [pendingAppIds, setPendingAppIds] = useState<Set<string>>(new Set());
  const [configuredAppIds, setConfiguredAppIds] = useState<Set<string> | null>(
    null
  );

  const localizedApps = useMemo(() => {
    return apps.map((app) => {
      const description = t(app.descriptionKey);
      return {
        ...app,
        description:
          description === app.descriptionKey ? app.description : description,
      };
    });
  }, [t]);

  // Auth headers helper
  const getAuthHeaders = (token: string) => ({
    Authorization: `Bearer ${token}`,
  });

  // Fetch connected apps on mount
  const fetchConnections = useCallback(async () => {
    if (!session?.access_token || !apiUrl) return;

    try {
      const response = await fetch(`${apiUrl}/api/integrations/connections`, {
        headers: getAuthHeaders(session.access_token),
      });

      if (response.ok) {
        const data = await response.json();
        const connections: ConnectionInfo[] = data.connections || [];

        const connected = new Set(
          connections
            .filter((c) => c.status === "connected")
            .map((c) => c.app_name)
        );
        const pending = new Set(
          connections
            .filter((c) => c.status === "pending")
            .map((c) => c.app_name)
        );

        setConnectedAppIds(connected);
        setPendingAppIds(pending);
      }
    } catch (error) {
      console.error("[ConnectedApps] Failed to fetch connections:", error);
    }
  }, [session?.access_token, apiUrl]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  useEffect(() => {
    if (!apiUrl) return;
    const loadConfiguredApps = async () => {
      try {
        const response = await fetch(
          `${apiUrl}/api/integrations/configured-apps`
        );
        if (!response.ok) return;
        const data = await response.json();
        setConfiguredAppIds(new Set(data.apps || []));
      } catch (error) {
        console.error("[ConnectedApps] Failed to load configured apps:", error);
      }
    };
    void loadConfiguredApps();
  }, [apiUrl]);

  // Poll for pending connections
  useEffect(() => {
    if (pendingAppIds.size === 0 || !session?.access_token) return;

    const interval = setInterval(async () => {
      for (const appId of pendingAppIds) {
        try {
          const response = await fetch(
            `${apiUrl}/api/integrations/status/${appId}`,
            { headers: getAuthHeaders(session.access_token) }
          );

          if (response.ok) {
            const data = await response.json();
            if (data.connected) {
              // Refresh connections
              await fetchConnections();
              const appName =
                localizedApps.find((a) => a.id === appId)?.name || appId;
              toast.success(t("settings.connect_success", { name: appName }));
              break;
            }
          }
        } catch (error) {
          console.error(
            `[ConnectedApps] Failed to check status for ${appId}:`,
            error
          );
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [
    pendingAppIds,
    session?.access_token,
    fetchConnections,
    apiUrl,
    localizedApps,
    t,
  ]);

  // Filter apps based on search and category
  const filteredApps = useMemo(() => {
    return localizedApps.filter((app) => {
      const matchesSearch =
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || app.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory, localizedApps]);

  // Separate connected and marketplace apps
  const connectedApps = useMemo(() => {
    return filteredApps.filter(
      (app) => connectedAppIds.has(app.id) || pendingAppIds.has(app.id)
    );
  }, [filteredApps, connectedAppIds, pendingAppIds]);

  const marketplaceApps = useMemo(() => {
    return filteredApps.filter(
      (app) => !connectedAppIds.has(app.id) && !pendingAppIds.has(app.id)
    );
  }, [filteredApps, connectedAppIds, pendingAppIds]);

  // Group marketplace apps by category
  const groupedMarketplaceApps = useMemo(() => {
    const groups: Partial<Record<AppCategory, typeof localizedApps>> = {};
    marketplaceApps.forEach((app) => {
      if (!groups[app.category]) {
        groups[app.category] = [];
      }
      groups[app.category]!.push(app);
    });
    return groups;
  }, [marketplaceApps]);

  // Connect handler - calls real API
  const handleConnect = async (appId: string) => {
    if (!session?.access_token) {
      toast.error(t("common.login_required"));
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/integrations/connect`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(session.access_token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ app_name: appId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to connect");
      }

      const data = await response.json();

      // Redirect to OAuth URL
      if (data.redirect_url) {
        window.location.href = data.redirect_url;
      }
    } catch (error) {
      console.error("[ConnectedApps] Failed to connect:", error);
      toast.error(
        t("settings.connect_failed", {
          message: error instanceof Error ? error.message : String(error),
        })
      );
    }
  };

  // Disconnect handler - calls real API
  const handleDisconnect = async (appId: string) => {
    if (!session?.access_token) return;

    const app = localizedApps.find((a) => a.id === appId);

    try {
      const response = await fetch(`${apiUrl}/api/integrations/disconnect`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(session.access_token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ app_name: appId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to disconnect");
      }

      // Update local state
      setConnectedAppIds((prev) => {
        const next = new Set(prev);
        next.delete(appId);
        return next;
      });

      toast.success(
        t("settings.disconnect_success", { name: app?.name ?? "" })
      );
    } catch (error) {
      console.error("[ConnectedApps] Failed to disconnect:", error);
      toast.error(
        t("settings.disconnect_failed", {
          message: error instanceof Error ? error.message : String(error),
        })
      );
    }
  };

  const handleManage = (appId: string) => {
    const app = localizedApps.find((a) => a.id === appId);
    toast.info(t("settings.manage_app", { name: app?.name ?? "" }));
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4">
        <h3 className="mb-1 text-lg font-medium text-foreground">
          {t("settings.connected_apps")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("settings.connected_apps_desc")}
        </p>
      </div>

      {/* Search and Filter */}
      <div className="mb-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("settings.search_apps")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-border bg-input pl-9"
          />
        </div>
        <Select
          value={selectedCategory}
          onValueChange={(val) =>
            setSelectedCategory(val as AppCategory | "all")
          }
        >
          <SelectTrigger className="w-32 border-border bg-input">
            <Grid className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder={t("settings.category")} />
          </SelectTrigger>
          <SelectContent className="border-border bg-popover">
            <SelectItem value="all">{t("settings.all_categories")}</SelectItem>
            {appCategories.map((category) => (
              <SelectItem
                key={category}
                value={category}
              >
                {t(`settings.category_${category}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="-mx-6 flex-1 px-6">
        <div className="space-y-6 pb-4">
          {/* My Apps Section */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-medium text-foreground">
                {t("settings.my_apps")}
              </h4>
              <span className="text-xs text-muted-foreground">
                (
                {t("settings.connected_count", { count: connectedApps.length })}
                )
              </span>
            </div>
            {connectedApps.length > 0 ? (
              <div className="space-y-2">
                {connectedApps.map((app) => (
                  <AppCard
                    key={app.id}
                    app={app}
                    isConnected={true}
                    onConnect={handleConnect}
                    onDisconnect={handleDisconnect}
                    onManage={handleManage}
                    isConfigured={
                      configuredAppIds === null || configuredAppIds.has(app.id)
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                {searchQuery || selectedCategory !== "all"
                  ? t("settings.no_matching_connected_apps")
                  : t("settings.no_connected_apps")}
              </div>
            )}
          </section>

          {/* Marketplace Section */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Store className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium text-foreground">
                {t("settings.marketplace")}
              </h4>
              <span className="text-xs text-muted-foreground">
                (
                {t("settings.available_count", {
                  count: marketplaceApps.length,
                })}
                )
              </span>
            </div>
            {marketplaceApps.length > 0 ? (
              <div className="space-y-6">
                {Object.entries(groupedMarketplaceApps).map(
                  ([category, categoryApps]) => (
                    <div key={category}>
                      <h5 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <span className="bg-primary/60 h-1.5 w-1.5 rounded-full" />
                        {t(`settings.category_${category}`)}
                        <span className="text-muted-foreground/60">
                          ({categoryApps!.length})
                        </span>
                      </h5>
                      <div className="space-y-2">
                        {categoryApps!.map((app) => (
                          <AppCard
                            key={app.id}
                            app={app}
                            isConnected={false}
                            onConnect={handleConnect}
                            onDisconnect={handleDisconnect}
                            onManage={handleManage}
                            isConfigured={
                              configuredAppIds === null ||
                              configuredAppIds.has(app.id)
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                {t("settings.no_matching_apps")}
              </div>
            )}
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
