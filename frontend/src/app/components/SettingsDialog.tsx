"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
    const { theme, setTheme } = useTheme();
    // Prevent hydration mismatch
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>设置</DialogTitle>
                    <DialogDescription>
                        管理应用偏好设置与外观
                    </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="general" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="general">通用</TabsTrigger>
                        <TabsTrigger value="appearance">外观</TabsTrigger>
                    </TabsList>
                    <TabsContent value="general" className="space-y-4 py-4">
                        <div className="flex items-center justify-between space-x-2">
                            <Label htmlFor="notifications">系统通知</Label>
                            <Switch id="notifications" defaultChecked />
                        </div>
                        <div className="flex items-center justify-between space-x-2">
                            <Label htmlFor="history">自动保存历史记录</Label>
                            <Switch id="history" defaultChecked />
                        </div>
                    </TabsContent>
                    <TabsContent value="appearance" className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>主题模式</Label>
                            <div className="grid grid-cols-3 gap-4">
                                <button
                                    onClick={() => setTheme("light")}
                                    className={`flex flex-col items-center gap-2 p-2 rounded-lg border-2 ${theme === "light" ? "border-primary" : "border-transparent"
                                        }`}
                                >
                                    <div className="w-full aspect-video rounded bg-white shadow-sm border" />
                                    <span className="text-xs">浅色</span>
                                </button>
                                <button
                                    onClick={() => setTheme("dark")}
                                    className={`flex flex-col items-center gap-2 p-2 rounded-lg border-2 ${theme === "dark" ? "border-primary" : "border-transparent"
                                        }`}
                                >
                                    <div className="w-full aspect-video rounded bg-slate-950 shadow-sm border" />
                                    <span className="text-xs">深色</span>
                                </button>
                                <button
                                    onClick={() => setTheme("system")}
                                    className={`flex flex-col items-center gap-2 p-2 rounded-lg border-2 ${theme === "system" ? "border-primary" : "border-transparent"
                                        }`}
                                >
                                    <div className="w-full aspect-video rounded bg-gradient-to-br from-white to-slate-950 shadow-sm border" />
                                    <span className="text-xs">跟随系统</span>
                                </button>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
