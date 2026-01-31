"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTriggers, CRON_PRESETS, Trigger } from "@/app/hooks/useTriggers";
import { toast } from "sonner";
import { Clock, Play, Trash2, History, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

interface ScheduleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    agentId: string;
    agentName: string;
}

export function ScheduleDialog({ open, onOpenChange, agentId, agentName }: ScheduleDialogProps) {
    const { triggers, loading, fetchTriggers, createTrigger, updateTrigger, deleteTrigger, toggleTrigger, runTrigger, getExecutionLogs } = useTriggers(agentId);

    const [showCreate, setShowCreate] = useState(false);
    const [selectedPreset, setSelectedPreset] = useState("");
    const [customCron, setCustomCron] = useState("");
    const [defaultPrompt, setDefaultPrompt] = useState("");
    const [notificationMethod, setNotificationMethod] = useState<"in_app" | "email" | "none">("in_app");
    const [saving, setSaving] = useState(false);
    const [runningId, setRunningId] = useState<string | null>(null);

    // Fetch triggers when dialog opens
    useEffect(() => {
        if (open && agentId) {
            fetchTriggers();
        }
    }, [open, agentId, fetchTriggers]);

    const handleCreate = async () => {
        const cronExpression = selectedPreset || customCron;
        if (!cronExpression) {
            toast.error("请选择或输入定时规则");
            return;
        }

        setSaving(true);
        try {
            const result = await createTrigger({
                agent_id: agentId,
                cron_expression: cronExpression,
                default_prompt: defaultPrompt || undefined,
                notification_method: notificationMethod,
            });

            if (result) {
                toast.success("定时任务创建成功");
                setShowCreate(false);
                resetForm();
            } else {
                toast.error("创建失败");
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (triggerId: string) => {
        if (await deleteTrigger(triggerId)) {
            toast.success("已删除定时任务");
        } else {
            toast.error("删除失败");
        }
    };

    const handleToggle = async (triggerId: string, enabled: boolean) => {
        if (await toggleTrigger(triggerId, enabled)) {
            toast.success(enabled ? "已启用定时任务" : "已暂停定时任务");
        }
    };

    const handleRunNow = async (triggerId: string) => {
        setRunningId(triggerId);
        try {
            const result = await runTrigger(triggerId);
            if (result.success) {
                toast.success("任务已执行");
            } else {
                toast.error("执行失败");
            }
        } finally {
            setRunningId(null);
        }
    };

    const resetForm = () => {
        setSelectedPreset("");
        setCustomCron("");
        setDefaultPrompt("");
        setNotificationMethod("in_app");
    };

    const formatNextRun = (nextRun: string | null) => {
        if (!nextRun) return "未设置";
        try {
            return format(new Date(nextRun), "MM/dd HH:mm", { locale: zhCN });
        } catch {
            return "未知";
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        定时执行 - {agentName}
                    </DialogTitle>
                    <DialogDescription>
                        设置智能体自动执行的时间规则
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Existing triggers list */}
                    {triggers.length > 0 && !showCreate && (
                        <div className="space-y-3">
                            {triggers.map((trigger) => (
                                <div
                                    key={trigger.id}
                                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm">
                                                {CRON_PRESETS.find(p => p.value === trigger.cron_expression)?.label || trigger.cron_expression}
                                            </span>
                                            <span className={`text-xs px-1.5 py-0.5 rounded ${trigger.enabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                                                {trigger.enabled ? "启用" : "暂停"}
                                            </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            下次执行: {formatNextRun(trigger.next_run)}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Switch
                                            checked={trigger.enabled}
                                            onCheckedChange={(checked) => handleToggle(trigger.id, checked)}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRunNow(trigger.id)}
                                            disabled={runningId === trigger.id}
                                        >
                                            {runningId === trigger.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Play className="w-4 h-4" />
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDelete(trigger.id)}
                                            className="hover:text-destructive"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Create new trigger form */}
                    {(showCreate || triggers.length === 0) && (
                        <div className="space-y-4">
                            {/* Preset selection */}
                            <div className="space-y-2">
                                <Label>选择执行频率</Label>
                                <Select value={selectedPreset} onValueChange={(v) => { setSelectedPreset(v); setCustomCron(""); }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="选择预设规则..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CRON_PRESETS.map((preset) => (
                                            <SelectItem key={preset.value} value={preset.value}>
                                                <div>
                                                    <span>{preset.label}</span>
                                                    <span className="text-xs text-muted-foreground ml-2">{preset.description}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Custom cron input */}
                            <div className="space-y-2">
                                <Label>或输入自定义 Cron 表达式</Label>
                                <Input
                                    placeholder="例如: 0 */2 * * * (每2小时)"
                                    value={customCron}
                                    onChange={(e) => { setCustomCron(e.target.value); setSelectedPreset(""); }}
                                />
                            </div>

                            {/* Default prompt */}
                            <div className="space-y-2">
                                <Label>默认提示词 (可选)</Label>
                                <Textarea
                                    placeholder="执行时发送的默认消息..."
                                    value={defaultPrompt}
                                    onChange={(e) => setDefaultPrompt(e.target.value)}
                                    rows={2}
                                />
                            </div>

                            {/* Notification method */}
                            <div className="space-y-2">
                                <Label>执行完成通知</Label>
                                <Select value={notificationMethod} onValueChange={(v) => setNotificationMethod(v as any)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="in_app">站内通知</SelectItem>
                                        <SelectItem value="email">邮件通知</SelectItem>
                                        <SelectItem value="none">不通知</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {/* Empty state */}
                    {triggers.length === 0 && !showCreate && (
                        <div className="text-center py-8 text-muted-foreground">
                            <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>暂无定时任务</p>
                            <p className="text-sm">设置后智能体将自动在指定时间执行</p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {showCreate || triggers.length === 0 ? (
                        <>
                            {triggers.length > 0 && (
                                <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>
                                    取消
                                </Button>
                            )}
                            <Button onClick={handleCreate} disabled={saving || (!selectedPreset && !customCron)}>
                                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                创建定时任务
                            </Button>
                        </>
                    ) : (
                        <Button onClick={() => setShowCreate(true)}>
                            添加新的定时任务
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
