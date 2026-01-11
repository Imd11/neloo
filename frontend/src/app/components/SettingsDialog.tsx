"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import {
  Settings,
  Bell,
  Globe,
  Palette,
  Shield,
  Database,
  HelpCircle,
  ExternalLink,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
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

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const settingsTabs = [
  { id: "general", label: "常规", icon: Settings },
  { id: "notifications", label: "通知", icon: Bell },
  { id: "personalization", label: "个性化", icon: Palette },
  { id: "privacy", label: "隐私与安全", icon: Shield },
  { id: "data", label: "数据管理", icon: Database },
  { id: "help", label: "获取帮助", icon: HelpCircle },
];

type ThemeOption = "light" | "dark" | "system";

const themeOptions: { value: ThemeOption; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
  { value: "system", label: "跟随系统", icon: Monitor },
];

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState("general");
  const { theme, setTheme } = useTheme();
  const [language, setLanguage] = useState("zh-CN");
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    updates: true,
  });

  const renderTabContent = () => {
    switch (activeTab) {
      case "general":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-foreground mb-4">常规</h3>

              {/* Theme Selector */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-foreground mb-3 block">外观</label>
                  <div className="flex gap-3">
                    {themeOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setTheme(option.value)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                          "hover:border-muted-foreground/50",
                          theme === option.value
                            ? "border-primary bg-accent"
                            : "border-border bg-card",
                        )}
                      >
                        <div
                          className={cn(
                            "w-16 h-12 rounded-lg flex items-center justify-center",
                            option.value === "light"
                              ? "bg-white border border-gray-200"
                              : "",
                            option.value === "dark"
                              ? "bg-zinc-800 border border-zinc-700"
                              : "",
                            option.value === "system"
                              ? "bg-gradient-to-r from-white to-zinc-800 border border-gray-300"
                              : "",
                          )}
                        >
                          <option.icon
                            className={cn(
                              "w-5 h-5",
                              option.value === "light" ? "text-gray-700" : "",
                              option.value === "dark" ? "text-gray-300" : "",
                              option.value === "system" ? "text-gray-500" : "",
                            )}
                          />
                        </div>
                        <span className="text-xs text-foreground">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Language Selector */}
                <div className="flex items-center justify-between py-3 border-t border-border">
                  <div>
                    <label className="text-sm text-foreground">语言</label>
                  </div>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="w-40 bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="zh-CN">简体中文</SelectItem>
                      <SelectItem value="zh-TW">繁體中文</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ja">日本語</SelectItem>
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
            <h3 className="text-lg font-medium text-foreground mb-4">通知</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-border">
                <div>
                  <p className="text-sm text-foreground">邮件通知</p>
                  <p className="text-xs text-muted-foreground">
                    接收重要更新的邮件通知
                  </p>
                </div>
                <Switch
                  checked={notifications.email}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, email: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between py-3 border-b border-border">
                <div>
                  <p className="text-sm text-foreground">推送通知</p>
                  <p className="text-xs text-muted-foreground">
                    在浏览器中接收推送通知
                  </p>
                </div>
                <Switch
                  checked={notifications.push}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, push: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between py-3 border-b border-border">
                <div>
                  <p className="text-sm text-foreground">产品更新</p>
                  <p className="text-xs text-muted-foreground">
                    接收新功能和改进的通知
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

      case "personalization":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-foreground mb-4">
              个性化
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-border">
                <div>
                  <p className="text-sm text-foreground">接收独家内容</p>
                  <p className="text-xs text-muted-foreground">
                    获取独家优惠、活动更新、优秀案例示例和新功能指南
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between py-3 border-b border-border">
                <div>
                  <p className="text-sm text-foreground">任务完成通知</p>
                  <p className="text-xs text-muted-foreground">
                    当任务完成排队并开始处理时发送通知
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between py-3 border-b border-border">
                <div>
                  <p className="text-sm text-foreground">显示所有模型</p>
                  <p className="text-xs text-muted-foreground">
                    在模型选择器中显示所有可用模型
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
            <h3 className="text-lg font-medium text-foreground mb-4">
              隐私与安全
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-border">
                <div>
                  <p className="text-sm text-foreground">数据收集</p>
                  <p className="text-xs text-muted-foreground">
                    允许收集使用数据以改进服务
                  </p>
                </div>
                <Switch />
              </div>

              <div className="flex items-center justify-between py-3 border-b border-border">
                <div>
                  <p className="text-sm text-foreground">对话历史</p>
                  <p className="text-xs text-muted-foreground">
                    保存对话历史记录
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-foreground">管理 Cookies</p>
                </div>
                <Button variant="outline" size="sm">
                  管理
                </Button>
              </div>
            </div>
          </div>
        );

      case "data":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-foreground mb-4">
              数据管理
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-border">
                <div>
                  <p className="text-sm text-foreground">导出数据</p>
                  <p className="text-xs text-muted-foreground">
                    下载您的所有对话和数据
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  导出
                </Button>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-border">
                <div>
                  <p className="text-sm text-foreground">清除对话历史</p>
                  <p className="text-xs text-muted-foreground">
                    删除所有保存的对话记录
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  清除
                </Button>
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-foreground">删除账户</p>
                  <p className="text-xs text-muted-foreground">
                    永久删除您的账户和所有数据
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  删除
                </Button>
              </div>
            </div>
          </div>
        );

      case "help":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-foreground mb-4">
              获取帮助
            </h3>

            <div className="space-y-2">
              <a
                href="#"
                className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-accent transition-colors"
              >
                <span className="text-sm text-foreground">帮助中心</span>
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </a>

              <a
                href="#"
                className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-accent transition-colors"
              >
                <span className="text-sm text-foreground">常见问题</span>
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </a>

              <a
                href="#"
                className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-accent transition-colors"
              >
                <span className="text-sm text-foreground">联系支持</span>
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </a>

              <a
                href="#"
                className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-accent transition-colors"
              >
                <span className="text-sm text-foreground">服务状态</span>
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </a>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0 bg-card border-border overflow-hidden">
        <div className="flex h-[500px]">
          {/* Sidebar */}
          <div className="w-52 border-r border-border bg-sidebar p-4">
            <DialogHeader className="mb-4">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center">
                  <span className="text-background font-bold text-xs">M</span>
                </div>
                <span className="text-foreground">设置</span>
              </DialogTitle>
            </DialogHeader>

            <nav className="space-y-1">
              {settingsTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                    activeTab === tab.id
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">{renderTabContent()}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
