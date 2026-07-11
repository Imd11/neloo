"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Settings, ExternalLink, Sun, Moon, Monitor, Plug } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  useLanguage,
  LOCALE_NAMES,
  type Locale,
  SUPPORTED_LOCALES,
} from "@/providers/LanguageProvider";
import { ConnectedAppsTab } from "@/app/components/settings/ConnectedAppsTab";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ThemeOption = "light" | "dark" | "system";

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState("general");
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useLanguage();
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    updates: true,
  });

  const settingsTabs = [
    { id: "general", label: t("settings.general"), icon: Settings },
    { id: "connected-apps", label: t("settings.connected_apps"), icon: Plug },
  ];

  const themeOptions: {
    value: ThemeOption;
    label: string;
    icon: typeof Sun;
  }[] = [
    { value: "light", label: t("settings.theme_light"), icon: Sun },
    { value: "dark", label: t("settings.theme_dark"), icon: Moon },
    { value: "system", label: t("settings.theme_system"), icon: Monitor },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case "general":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="mb-4 text-lg font-medium text-foreground">
                {t("settings.general")}
              </h3>

              {/* Theme Selector */}
              <div className="space-y-4">
                <div>
                  <label className="mb-3 block text-sm text-foreground">
                    {t("settings.appearance")}
                  </label>
                  <div className="flex gap-3">
                    {themeOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setTheme(option.value)}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all",
                          "hover:border-muted-foreground/50",
                          theme === option.value
                            ? "border-primary bg-accent"
                            : "border-border bg-card"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-12 w-16 items-center justify-center rounded-lg",
                            option.value === "light"
                              ? "border border-gray-200 bg-white"
                              : "",
                            option.value === "dark"
                              ? "border border-zinc-700 bg-zinc-800"
                              : "",
                            option.value === "system"
                              ? "border border-gray-300 bg-gradient-to-r from-white to-zinc-800"
                              : ""
                          )}
                        >
                          <option.icon
                            className={cn(
                              "h-5 w-5",
                              option.value === "light" ? "text-gray-700" : "",
                              option.value === "dark" ? "text-gray-300" : "",
                              option.value === "system" ? "text-gray-500" : ""
                            )}
                          />
                        </div>
                        <span className="text-xs text-foreground">
                          {option.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Language Selector */}
                <div className="flex items-center justify-between border-t border-border py-3">
                  <div>
                    <label className="text-sm text-foreground">
                      {t("settings.language")}
                    </label>
                  </div>
                  <Select
                    value={locale}
                    onValueChange={(value) => setLocale(value as Locale)}
                  >
                    <SelectTrigger className="w-40 bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-popover">
                      {SUPPORTED_LOCALES.map((loc) => (
                        <SelectItem
                          key={loc}
                          value={loc}
                        >
                          {LOCALE_NAMES[loc]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        );

      case "notifications":
        return (
          <div className="space-y-6">
            <h3 className="mb-4 text-lg font-medium text-foreground">
              {t("settings.notifications")}
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border py-3">
                <div>
                  <p className="text-sm text-foreground">
                    {t("settings.email_notifications")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.email_notifications_desc")}
                  </p>
                </div>
                <Switch
                  checked={notifications.email}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, email: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between border-b border-border py-3">
                <div>
                  <p className="text-sm text-foreground">
                    {t("settings.push_notifications")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.push_notifications_desc")}
                  </p>
                </div>
                <Switch
                  checked={notifications.push}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, push: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between border-b border-border py-3">
                <div>
                  <p className="text-sm text-foreground">
                    {t("settings.product_updates")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.product_updates_desc")}
                  </p>
                </div>
                <Switch
                  checked={notifications.updates}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, updates: checked })
                  }
                />
              </div>
            </div>
          </div>
        );

      case "connected-apps":
        return <ConnectedAppsTab />;

      case "personalization":
        return (
          <div className="space-y-6">
            <h3 className="mb-4 text-lg font-medium text-foreground">
              {t("settings.personalization")}
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border py-3">
                <div>
                  <p className="text-sm text-foreground">
                    {t("settings.exclusive_content")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.exclusive_content_desc")}
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between border-b border-border py-3">
                <div>
                  <p className="text-sm text-foreground">
                    {t("settings.task_notifications")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.task_notifications_desc")}
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between border-b border-border py-3">
                <div>
                  <p className="text-sm text-foreground">
                    {t("settings.show_all_models")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.show_all_models_desc")}
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>
        );

      case "privacy":
        return (
          <div className="space-y-6">
            <h3 className="mb-4 text-lg font-medium text-foreground">
              {t("settings.privacy")}
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border py-3">
                <div>
                  <p className="text-sm text-foreground">
                    {t("settings.data_collection")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.data_collection_desc")}
                  </p>
                </div>
                <Switch />
              </div>

              <div className="flex items-center justify-between border-b border-border py-3">
                <div>
                  <p className="text-sm text-foreground">
                    {t("settings.conversation_history")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.conversation_history_desc")}
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between border-b border-border py-3">
                <div>
                  <p className="text-sm text-foreground">
                    {t("settings.manage_cookies")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                >
                  {t("settings.manage")}
                </Button>
              </div>
            </div>

            {/* Legal Info Section */}
            <div className="pt-4">
              <h4 className="mb-3 text-sm font-medium text-muted-foreground">
                {t("settings.legal_info")}
              </h4>
              <div className="space-y-1">
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg px-4 py-3 transition-colors hover:bg-accent"
                >
                  <span className="text-sm text-foreground">
                    {t("settings.privacy_policy")}
                  </span>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </a>
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg px-4 py-3 transition-colors hover:bg-accent"
                >
                  <span className="text-sm text-foreground">
                    {t("settings.terms_of_service")}
                  </span>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </a>
              </div>
            </div>
          </div>
        );

      case "data":
        return (
          <div className="space-y-6">
            <h3 className="mb-4 text-lg font-medium text-foreground">
              {t("settings.data")}
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border py-3">
                <div>
                  <p className="text-sm text-foreground">
                    {t("settings.export_data")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.export_data_desc")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                >
                  {t("settings.export")}
                </Button>
              </div>

              <div className="flex items-center justify-between border-b border-border py-3">
                <div>
                  <p className="text-sm text-foreground">
                    {t("settings.clear_history")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.clear_history_desc")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  {t("settings.clear")}
                </Button>
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-foreground">
                    {t("settings.delete_account")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.delete_account_desc")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  {t("common.delete")}
                </Button>
              </div>
            </div>
          </div>
        );

      case "help":
        return (
          <div className="space-y-6">
            <h3 className="mb-4 text-lg font-medium text-foreground">
              {t("settings.help")}
            </h3>

            <div className="space-y-2">
              <a
                href="#"
                className="flex items-center justify-between rounded-lg px-4 py-3 transition-colors hover:bg-accent"
              >
                <span className="text-sm text-foreground">
                  {t("settings.help_center")}
                </span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>

              <a
                href="#"
                className="flex items-center justify-between rounded-lg px-4 py-3 transition-colors hover:bg-accent"
              >
                <span className="text-sm text-foreground">
                  {t("settings.faq")}
                </span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>

              <a
                href="#"
                className="flex items-center justify-between rounded-lg px-4 py-3 transition-colors hover:bg-accent"
              >
                <span className="text-sm text-foreground">
                  {t("settings.contact_support")}
                </span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>

              <a
                href="#"
                className="flex items-center justify-between rounded-lg px-4 py-3 transition-colors hover:bg-accent"
              >
                <span className="text-sm text-foreground">
                  {t("settings.service_status")}
                </span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-w-4xl gap-0 overflow-hidden border-border bg-card p-0">
        <div className="flex h-[500px]">
          {/* Sidebar */}
          <div className="w-52 border-r border-border bg-sidebar p-4">
            <DialogHeader className="mb-4">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground">
                  <span className="text-xs font-bold text-background">M</span>
                </div>
                <span className="text-foreground">{t("settings.title")}</span>
              </DialogTitle>
            </DialogHeader>

            <nav className="space-y-1">
              {settingsTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    activeTab === tab.id
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">{renderTabContent()}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
