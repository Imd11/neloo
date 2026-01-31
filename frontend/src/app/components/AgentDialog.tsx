"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAgents, Agent } from "@/app/hooks/useAgents";
import {
    Store,
    User,
    Plus,
    Search,
    Clock,
    MoreHorizontal,
    Copy,
    Pencil,
    Trash2,
    Play,
    ChevronRight,
    Sparkles,
    Globe,
    Code,
    Image as ImageIcon,
    FileText,
    X,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface AgentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUseAgent?: (agentId: string, agentName: string, systemPrompt: string) => void;
}

// Tool definitions
const TOOLS = {
    base: [
        { id: "search_web", name: "网页搜索", icon: Globe, recommended: true },
    ],
    optional: [
        { id: "code_execution", name: "代码执行", icon: Code, recommended: true },
        { id: "image_generation", name: "图片生成", icon: ImageIcon, recommended: false },
        { id: "file_processing", name: "文件处理", icon: FileText, recommended: false },
    ],
};

// Emoji picker options
const EMOJI_OPTIONS = ["🤖", "📊", "✍️", "🧑‍💻", "📈", "🎨", "💡", "🔧", "📝", "🎯", "🚀", "💬"];

type TabId = "store" | "my" | "create";
type EditTab = "info" | "prompt" | "schedule";

export function AgentDialog({ open, onOpenChange, onUseAgent }: AgentDialogProps) {
    // Use the agents hook for real data
    const {
        myAgents,
        myAgentsLoading,
        storeAgents,
        storeAgentsLoading,
        refreshMyAgents,
        refreshStoreAgents,
        createAgent,
        updateAgent,
        deleteAgent,
        copyAgent,
        useAgent,
        generatePrompt,
        isCreating,
        isUpdating,
        isDeleting,
    } = useAgents();

    const [activeTab, setActiveTab] = useState<TabId>("store");
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"popular" | "newest">("popular");

    // Create/Edit form state
    const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
    const [editTab, setEditTab] = useState<EditTab>("info");
    const [formData, setFormData] = useState({
        name: "",
        icon: "🤖",
        description: "",
        systemPrompt: "",
        tools: ["search_web"],
        isPublic: false,
        schedule: {
            enabled: false,
            frequency: "daily",
            time: "09:00",
            timezone: "Asia/Shanghai",
            defaultPrompt: "",
            notification: "in_app",
        },
    });
    const [isGenerating, setIsGenerating] = useState(false);

    const tabs = [
        { id: "store" as const, label: "商店", icon: Store },
        { id: "my" as const, label: "我的", icon: User },
        { id: "create" as const, label: "新建", icon: Plus },
    ];

    const handleToolToggle = (toolId: string) => {
        setFormData(prev => ({
            ...prev,
            tools: prev.tools.includes(toolId)
                ? prev.tools.filter(t => t !== toolId)
                : [...prev.tools, toolId],
        }));
    };

    const handleGeneratePrompt = async () => {
        if (!formData.description.trim()) return;

        setIsGenerating(true);
        try {
            const prompt = await generatePrompt(formData.name || "智能体", formData.description, formData.tools);
            if (prompt) {
                setFormData(prev => ({ ...prev, systemPrompt: prompt }));
                setEditTab("prompt");
            }
        } catch (error) {
            toast.error("生成提示词失败");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveAgent = async () => {
        try {
            if (editingAgent) {
                // Update existing agent
                await updateAgent(editingAgent.id, {
                    name: formData.name,
                    icon: formData.icon,
                    description: formData.description,
                    system_prompt: formData.systemPrompt,
                    tools: formData.tools,
                    is_public: formData.isPublic,
                });
                toast.success("智能体已更新");
            } else {
                // Create new agent
                await createAgent({
                    name: formData.name,
                    icon: formData.icon,
                    description: formData.description,
                    system_prompt: formData.systemPrompt,
                    tools: formData.tools,
                    is_public: formData.isPublic,
                });
                toast.success("智能体已创建");
            }
            resetForm();
            setActiveTab("my");
        } catch (error) {
            toast.error(editingAgent ? "更新失败" : "创建失败");
        }
    };

    const handleEditAgent = (agent: Agent) => {
        setEditingAgent(agent);
        setFormData({
            name: agent.name,
            icon: agent.icon,
            description: agent.description,
            systemPrompt: agent.system_prompt || "",
            tools: agent.tools || ["search_web"],
            isPublic: agent.is_public || false,
            schedule: {
                enabled: false,
                frequency: "daily",
                time: "09:00",
                timezone: "Asia/Shanghai",
                defaultPrompt: "",
                notification: "in_app",
            },
        });
        setActiveTab("create");
        setEditTab("info");
    };

    const handleUseAgent = async (agent: Agent) => {
        try {
            const result = await useAgent(agent.id);
            if (result && onUseAgent) {
                onUseAgent(agent.id, agent.name, result.system_prompt);
                onOpenChange(false);
            }
        } catch (error) {
            toast.error("使用智能体失败");
        }
    };

    const handleCopyAgent = async (agent: Agent) => {
        try {
            await copyAgent(agent.id);
            toast.success("智能体已复制到我的列表");
        } catch (error) {
            toast.error("复制失败");
        }
    };

    const handleDeleteAgent = async (agentId: string) => {
        try {
            await deleteAgent(agentId);
            toast.success("智能体已删除");
        } catch (error) {
            toast.error("删除失败");
        }
    };

    const resetForm = () => {
        setEditingAgent(null);
        setFormData({
            name: "",
            icon: "🤖",
            description: "",
            systemPrompt: "",
            tools: ["search_web"],
            isPublic: false,
            schedule: {
                enabled: false,
                frequency: "daily",
                time: "09:00",
                timezone: "Asia/Shanghai",
                defaultPrompt: "",
                notification: "in_app",
            },
        });
        setEditTab("info");
    };

    // Reset form when switching to create tab
    useEffect(() => {
        if (activeTab === "create" && !editingAgent) {
            resetForm();
        }
    }, [activeTab]);

    const renderStoreContent = () => (
        <div className="space-y-4">
            {/* Search and Sort */}
            <div className="flex gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="搜索智能体..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-background"
                    />
                </div>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as "popular" | "newest")}>
                    <SelectTrigger className="w-24">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="popular">热门</SelectItem>
                        <SelectItem value="newest">最新</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Agent Cards Grid */}
            <div className="grid grid-cols-2 gap-4 max-h-[420px] overflow-y-auto pr-2">
                {storeAgentsLoading ? (
                    <div className="col-span-2 text-center py-8 text-muted-foreground">
                        加载中...
                    </div>
                ) : storeAgents.filter((a: Agent) =>
                    a.name.includes(searchQuery) || a.description.includes(searchQuery)
                ).map((agent: Agent) => (
                    <div
                        key={agent.id}
                        className="p-4 rounded-xl bg-accent/50 hover:bg-accent transition-colors cursor-pointer group"
                        onClick={() => handleCopyAgent(agent)}
                    >
                        <div className="flex items-start gap-3">
                            <span className="text-3xl">{agent.icon}</span>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-foreground truncate">{agent.name}</h4>
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{agent.description}</p>
                                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                    <span>使用 {(agent.usage_count || 0) >= 1000 ? `${((agent.usage_count || 0) / 1000).toFixed(1)}k` : agent.usage_count || 0} 次</span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="sm" variant="secondary" className="flex-1" onClick={(e) => { e.stopPropagation(); handleCopyAgent(agent); }}>
                                <Copy className="w-3 h-3 mr-1" /> 复制
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderMyAgentsContent = () => (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-foreground">我的智能体</h3>
                <Button size="sm" onClick={() => { resetForm(); setActiveTab("create"); }}>
                    <Plus className="w-4 h-4 mr-1" /> 新建
                </Button>
            </div>

            {/* Agent List */}
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
                {myAgents.map((agent) => (
                    <div
                        key={agent.id}
                        className="p-4 rounded-xl bg-accent/50 hover:bg-accent transition-colors"
                    >
                        <div className="flex items-center gap-4">
                            <span className="text-3xl">{agent.icon}</span>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-foreground">{agent.name}</h4>
                                <p className="text-xs text-muted-foreground">{agent.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="secondary" onClick={() => handleUseAgent(agent)}>
                                    使用
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleEditAgent(agent)}>
                                    编辑
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button size="sm" variant="ghost">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleDeleteAgent(agent.id)}>
                                            <Trash2 className="w-4 h-4 mr-2" /> 删除
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </div>
                ))}

                {myAgents.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        <p>从商店复制或创建你的专属智能体</p>
                    </div>
                )}
            </div>
        </div>
    );

    const renderCreateContent = () => (
        <div className="space-y-4">
            {/* Edit Tabs */}
            <div className="flex gap-4 border-b border-border pb-2">
                {[
                    { id: "info" as const, label: "基本信息" },
                    { id: "prompt" as const, label: "系统提示词" },
                    { id: "schedule" as const, label: "定时执行" },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setEditTab(tab.id)}
                        className={cn(
                            "text-sm pb-2 border-b-2 transition-colors",
                            editTab === tab.id
                                ? "border-primary text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="max-h-[380px] overflow-y-auto pr-2">
                {editTab === "info" && (
                    <div className="space-y-4">
                        {/* Icon Picker */}
                        <div>
                            <label className="text-sm text-foreground mb-2 block">图标</label>
                            <div className="flex gap-2 flex-wrap">
                                {EMOJI_OPTIONS.map((emoji) => (
                                    <button
                                        key={emoji}
                                        onClick={() => setFormData(prev => ({ ...prev, icon: emoji }))}
                                        className={cn(
                                            "w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all",
                                            formData.icon === emoji
                                                ? "bg-primary/20 ring-2 ring-primary"
                                                : "bg-accent hover:bg-accent/80"
                                        )}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Name */}
                        <div>
                            <label className="text-sm text-foreground mb-2 block">名称</label>
                            <Input
                                placeholder="智能体名称"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="text-sm text-foreground mb-2 block">功能描述</label>
                            <Textarea
                                placeholder="用自然语言描述这个智能体的功能..."
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                rows={3}
                            />
                            <Button
                                className="mt-2 w-full"
                                onClick={handleGeneratePrompt}
                                disabled={!formData.description.trim() || isGenerating}
                            >
                                {isGenerating ? (
                                    <>生成中...</>
                                ) : (
                                    <><Sparkles className="w-4 h-4 mr-2" /> 生成系统提示词</>
                                )}
                            </Button>
                        </div>

                        {/* Tool Permissions */}
                        <div>
                            <label className="text-sm text-foreground mb-2 block">工具权限</label>
                            <div className="space-y-2">
                                <p className="text-xs text-muted-foreground">基础工具</p>
                                {TOOLS.base.map((tool) => (
                                    <div key={tool.id} className="flex items-center justify-between p-2 rounded-lg bg-accent/50">
                                        <div className="flex items-center gap-2">
                                            <tool.icon className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-sm">{tool.name}</span>
                                        </div>
                                        <Switch
                                            checked={formData.tools.includes(tool.id)}
                                            onCheckedChange={() => handleToolToggle(tool.id)}
                                        />
                                    </div>
                                ))}
                                <p className="text-xs text-muted-foreground mt-3">可选工具</p>
                                {TOOLS.optional.map((tool) => (
                                    <div key={tool.id} className="flex items-center justify-between p-2 rounded-lg bg-accent/50">
                                        <div className="flex items-center gap-2">
                                            <tool.icon className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-sm">{tool.name}</span>
                                            {tool.recommended && (
                                                <span className="text-xs text-yellow-500">⭐推荐</span>
                                            )}
                                        </div>
                                        <Switch
                                            checked={formData.tools.includes(tool.id)}
                                            onCheckedChange={() => handleToolToggle(tool.id)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Publish Settings */}
                        <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
                            <span className="text-sm">公开到智能体商店</span>
                            <Switch
                                checked={formData.isPublic}
                                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isPublic: checked }))}
                            />
                        </div>
                    </div>
                )}

                {editTab === "prompt" && (
                    <div className="space-y-4">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm text-foreground">系统提示词</label>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                                由 AI 根据你的描述自动生成，你可以手动调整
                            </p>
                            <Textarea
                                value={formData.systemPrompt}
                                onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                                rows={15}
                                className="font-mono text-sm bg-zinc-900"
                                placeholder="点击「生成系统提示词」按钮来生成..."
                            />
                            <div className="flex gap-2 mt-2">
                                <Button variant="outline" size="sm" onClick={handleGeneratePrompt} disabled={isGenerating}>
                                    🔄 重新生成
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {editTab === "schedule" && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
                            <span className="text-sm">启用定时执行</span>
                            <Switch
                                checked={formData.schedule.enabled}
                                onCheckedChange={(checked) => setFormData(prev => ({
                                    ...prev,
                                    schedule: { ...prev.schedule, enabled: checked }
                                }))}
                            />
                        </div>

                        {formData.schedule.enabled && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm text-foreground mb-2 block">执行频率</label>
                                        <Select
                                            value={formData.schedule.frequency}
                                            onValueChange={(v) => setFormData(prev => ({
                                                ...prev,
                                                schedule: { ...prev.schedule, frequency: v }
                                            }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="daily">每天</SelectItem>
                                                <SelectItem value="weekly">每周</SelectItem>
                                                <SelectItem value="monthly">每月</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-sm text-foreground mb-2 block">执行时间</label>
                                        <Input
                                            type="time"
                                            value={formData.schedule.time}
                                            onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                schedule: { ...prev.schedule, time: e.target.value }
                                            }))}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm text-foreground mb-2 block">时区</label>
                                    <Select
                                        value={formData.schedule.timezone}
                                        onValueChange={(v) => setFormData(prev => ({
                                            ...prev,
                                            schedule: { ...prev.schedule, timezone: v }
                                        }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Asia/Shanghai">Asia/Shanghai (GMT+8)</SelectItem>
                                            <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                                            <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <label className="text-sm text-foreground mb-2 block">固定输入</label>
                                    <Textarea
                                        placeholder="每次定时执行时发送的默认消息..."
                                        value={formData.schedule.defaultPrompt}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            schedule: { ...prev.schedule, defaultPrompt: e.target.value }
                                        }))}
                                        rows={2}
                                    />
                                </div>

                                <div>
                                    <label className="text-sm text-foreground mb-2 block">通知方式</label>
                                    <div className="flex gap-4">
                                        {["email", "in_app", "none"].map((method) => (
                                            <label key={method} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="notification"
                                                    value={method}
                                                    checked={formData.schedule.notification === method}
                                                    onChange={(e) => setFormData(prev => ({
                                                        ...prev,
                                                        schedule: { ...prev.schedule, notification: e.target.value }
                                                    }))}
                                                    className="w-4 h-4"
                                                />
                                                <span className="text-sm">
                                                    {method === "email" ? "邮件" : method === "in_app" ? "应用内" : "不通知"}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <Button variant="outline" onClick={resetForm}>取消</Button>
                <Button onClick={handleSaveAgent} disabled={!formData.name || !formData.description}>
                    保存
                </Button>
            </div>
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl p-0 gap-0 bg-card border-border overflow-hidden">
                <div className="flex h-[580px]">
                    {/* Sidebar */}
                    <div className="w-40 border-r border-border bg-sidebar p-4">
                        <DialogHeader className="mb-4">
                            <DialogTitle className="text-lg text-foreground">智能体</DialogTitle>
                        </DialogHeader>

                        <nav className="space-y-1">
                            {tabs.map((tab) => (
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
                    <div className="flex-1 p-6 overflow-hidden">
                        {activeTab === "store" && renderStoreContent()}
                        {activeTab === "my" && renderMyAgentsContent()}
                        {activeTab === "create" && renderCreateContent()}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
