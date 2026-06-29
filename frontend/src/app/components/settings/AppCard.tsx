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
}

export function AppCard({
    app,
    isConnected,
    onConnect,
    onDisconnect,
    onManage,
}: AppCardProps) {
    const [imgError, setImgError] = useState(false);
    const { t } = useLanguage();

    return (
        <div
            className={cn(
                "flex items-center gap-4 p-4 rounded-lg border transition-colors",
                "hover:bg-accent/50",
                isConnected ? "border-primary/30 bg-accent/30" : "border-border bg-card"
            )}
        >
            {/* App Logo */}
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                {imgError ? (
                    <span className="text-lg font-semibold text-muted-foreground">
                        {app.name.charAt(0)}
                    </span>
                ) : (
                    <img
                        src={app.logo}
                        alt={app.name}
                        className="w-8 h-8 object-contain"
                        onError={() => setImgError(true)}
                    />
                )}
            </div>

            {/* App Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-foreground truncate">
                        {app.name}
                    </h4>
                    {isConnected && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                            <Check className="w-3 h-3" />
                            {t("settings.connected_badge")}
                        </span>
                    )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {app.description}
                </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
                {isConnected ? (
                    <>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => onManage(app.id)}
                        >
                            <Settings className="w-3.5 h-3.5 mr-1" />
                            {t("settings.manage")}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => onDisconnect(app.id)}
                        >
                            <X className="w-3.5 h-3.5 mr-1" />
                            {t("settings.disconnect")}
                        </Button>
                    </>
                ) : (
                    <Button
                        variant="default"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => onConnect(app.id)}
                    >
                        {t("settings.connect")}
                    </Button>
                )}
            </div>
        </div>
    );
}
