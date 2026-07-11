import { useState } from "react";
import { Check, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AppInfo } from "./appsData";
import { useLanguage } from "@/providers/LanguageProvider";

interface AppCardProps {
  app: AppInfo;
  isConnected: boolean;
  onConnect: (appId: string) => void;
  onDisconnect: (appId: string) => void;
  onManage: (appId: string) => void;
  isConfigured?: boolean;
}

export function AppCard({
  app,
  isConnected,
  onConnect,
  onDisconnect,
  onManage,
  isConfigured = true,
}: AppCardProps) {
  const [imgError, setImgError] = useState(false);
  const { t } = useLanguage();

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-lg border p-4 transition-colors",
        "hover:bg-accent/50",
        isConnected ? "border-primary/30 bg-accent/30" : "border-border bg-card"
      )}
    >
      {/* App Logo */}
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
        {imgError ? (
          <span className="text-lg font-semibold text-muted-foreground">
            {app.name.charAt(0)}
          </span>
        ) : (
          <img
            src={app.logo}
            alt={app.name}
            className="h-8 w-8 object-contain"
            onError={() => setImgError(true)}
          />
        )}
      </div>

      {/* App Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="truncate text-sm font-medium text-foreground">
            {app.name}
          </h4>
          {isConnected && (
            <span className="bg-primary/10 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-primary">
              <Check className="h-3 w-3" />
              {t("settings.connected_badge")}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {app.description}
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-shrink-0 items-center gap-2">
        {isConnected ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => onManage(app.id)}
            >
              <Settings className="mr-1 h-3.5 w-3.5" />
              {t("settings.manage")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onDisconnect(app.id)}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              {t("settings.disconnect")}
            </Button>
          </>
        ) : (
          <Button
            variant="default"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onConnect(app.id)}
            disabled={!isConfigured}
            title={
              isConfigured
                ? undefined
                : "This integration has not been configured by this Neloo instance."
            }
          >
            {t("settings.connect")}
          </Button>
        )}
      </div>
    </div>
  );
}
