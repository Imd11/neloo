"use client";

import { useState, useEffect } from "react";
import {
    User,
    CreditCard,
    Sparkles,
    Edit2,
    Check,
    X,
    Crown,
    Zap,
    Clock,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";

interface UserProfileDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const profileTabs = [
    { id: "account", label: "账户", icon: User },
    { id: "subscription", label: "套餐", icon: CreditCard },
    { id: "usage", label: "使用情况", icon: Sparkles },
];

// Simple Progress component inline since it might not exist
function Progress({ value, className }: { value: number; className?: string }) {
    return (
        <div className={cn("w-full bg-muted rounded-full overflow-hidden", className)}>
            <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
            />
        </div>
    );
}

export function UserProfileDialog({
    open,
    onOpenChange,
}: UserProfileDialogProps) {
    const { user, updateDisplayName } = useAuth();
    const [activeTab, setActiveTab] = useState("account");
    const [isEditingName, setIsEditingName] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Get user info from auth - prefer display_name from user_metadata
    const displayName = (user?.user_metadata?.display_name as string) || user?.email?.split('@')[0] || "User";
    const email = user?.email || "user@example.com";

    const [userName, setUserName] = useState(displayName);
    const [tempName, setTempName] = useState(displayName);

    // Update userName when user changes
    useEffect(() => {
        const newName = (user?.user_metadata?.display_name as string) || user?.email?.split('@')[0] || "User";
        setUserName(newName);
        setTempName(newName);
    }, [user]);

    const handleSaveName = async () => {
        if (!tempName.trim()) return;

        setIsSaving(true);
        try {
            const { error } = await updateDisplayName(tempName.trim());
            if (error) {
                console.error("Failed to update display name:", error);
                return;
            }
            setUserName(tempName.trim());
            setIsEditingName(false);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelEdit = () => {
        setTempName(userName);
        setIsEditingName(false);
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case "account":
                return (
                    <div className="space-y-6">
                        <h3 className="text-lg font-medium text-foreground mb-4">账户信息</h3>

                        {/* Avatar & Name */}
                        <div className="flex items-center gap-4 p-4 bg-accent/50 rounded-xl">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xl text-white font-medium">
                                {userName.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1">
                                {isEditingName ? (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            value={tempName}
                                            onChange={(e) => setTempName(e.target.value)}
                                            className="h-9 bg-background"
                                            autoFocus
                                        />
                                        <Button size="icon" variant="ghost" onClick={handleSaveName}>
                                            <Check className="w-4 h-4 text-green-500" />
                                        </Button>
                                        <Button size="icon" variant="ghost" onClick={handleCancelEdit}>
                                            <X className="w-4 h-4 text-muted-foreground" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-medium text-foreground">{userName}</span>
                                        <button
                                            onClick={() => setIsEditingName(true)}
                                            className="p-1 hover:bg-accent rounded transition-colors"
                                        >
                                            <Edit2 className="w-4 h-4 text-muted-foreground" />
                                        </button>
                                    </div>
                                )}
                                <p className="text-sm text-muted-foreground">{email}</p>
                            </div>
                        </div>

                        {/* Account Details */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between py-3 border-b border-border">
                                <span className="text-sm text-muted-foreground">邮箱</span>
                                <span className="text-sm text-foreground">{email}</span>
                            </div>
                            <div className="flex items-center justify-between py-3 border-b border-border">
                                <span className="text-sm text-muted-foreground">账户状态</span>
                                <span className="text-sm text-green-500 flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-green-500" />
                                    本地访客
                                </span>
                            </div>
                        </div>
                    </div>
                );

            case "subscription":
                return (
                    <div className="space-y-6">
                        <h3 className="text-lg font-medium text-foreground mb-4">当前套餐</h3>

                        {/* Current Plan */}
                        <div className="p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-500/20">
                            <div className="flex items-center gap-3 mb-3">
                                <Crown className="w-6 h-6 text-yellow-500" />
                                <div>
                                    <h4 className="text-lg font-semibold text-foreground">Plus 会员</h4>
                                    <p className="text-sm text-muted-foreground">¥99/月</p>
                                </div>
                            </div>
                            <div className="space-y-2 text-sm text-muted-foreground">
                                <p className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-green-500" />
                                    无限对话
                                </p>
                                <p className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-green-500" />
                                    优先响应
                                </p>
                                <p className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-green-500" />
                                    高级模型访问
                                </p>
                                <p className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-green-500" />
                                    图片生成
                                </p>
                            </div>
                        </div>

                        {/* Renewal Info */}
                        <div className="flex items-center justify-between py-3 border-b border-border">
                            <span className="text-sm text-muted-foreground">下次续费</span>
                            <span className="text-sm text-foreground">2025年1月28日</span>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1">
                                管理订阅
                            </Button>
                            <Button className="flex-1 gap-2">
                                <Zap className="w-4 h-4" />
                                升级套餐
                            </Button>
                        </div>
                    </div>
                );

            case "usage":
                return (
                    <div className="space-y-6">
                        <h3 className="text-lg font-medium text-foreground mb-4">使用情况</h3>

                        {/* Current Period */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                            <Clock className="w-4 h-4" />
                            <span>当前计费周期：2024年12月29日 - 2025年1月28日</span>
                        </div>

                        {/* Usage Stats */}
                        <div className="space-y-4">
                            <div className="p-4 bg-accent/50 rounded-xl">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-foreground">对话次数</span>
                                    <span className="text-sm text-muted-foreground">1,247 / 无限</span>
                                </div>
                                <Progress value={100} className="h-2" />
                            </div>

                            <div className="p-4 bg-accent/50 rounded-xl">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-foreground">图片生成</span>
                                    <span className="text-sm text-muted-foreground">45 / 100</span>
                                </div>
                                <Progress value={45} className="h-2" />
                            </div>

                            <div className="p-4 bg-accent/50 rounded-xl">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-foreground">高级模型调用</span>
                                    <span className="text-sm text-muted-foreground">89 / 200</span>
                                </div>
                                <Progress value={44.5} className="h-2" />
                            </div>
                        </div>

                        {/* Usage History */}
                        <div className="pt-4 border-t border-border">
                            <h4 className="text-sm font-medium text-foreground mb-3">最近活动</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center justify-between py-2">
                                    <span className="text-muted-foreground">今日对话</span>
                                    <span className="text-foreground">23 次</span>
                                </div>
                                <div className="flex items-center justify-between py-2">
                                    <span className="text-muted-foreground">本周对话</span>
                                    <span className="text-foreground">156 次</span>
                                </div>
                                <div className="flex items-center justify-between py-2">
                                    <span className="text-muted-foreground">本月图片生成</span>
                                    <span className="text-foreground">45 张</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl p-0 gap-0 bg-card border-border overflow-hidden">
                <div className="flex h-[480px]">
                    {/* Sidebar */}
                    <div className="w-48 border-r border-border bg-sidebar p-4">
                        <DialogHeader className="mb-4">
                            <DialogTitle className="text-lg text-foreground">个人中心</DialogTitle>
                        </DialogHeader>

                        <nav className="space-y-1">
                            {profileTabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                                        activeTab === tab.id
                                            ? "bg-accent text-accent-foreground"
                                            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                                    )}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        {renderTabContent()}
                    </div>
                </div>

            </DialogContent>
        </Dialog>
    );
}
