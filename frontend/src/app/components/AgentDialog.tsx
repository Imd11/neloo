"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAgents, Agent } from "@/app/hooks/useAgents";
import {
    Store,
    User,
    Users,
    Plus,
    Search,
    Clock,
    MoreHorizontal,
    Heart,
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
    HelpCircle,
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
import { CHAT_MODELS } from "@/lib/models";
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
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

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
        generateAgent,
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
            frequency: "daily" as "once" | "daily" | "weekly" | "monthly" | "interval",
            time: "09:00",
            date: "", // For "once" mode - specific date
            weekday: "1", // For "weekly" mode - 1=Monday, 7=Sunday
            monthDay: "1", // For "monthly" mode - day of month
            intervalValue: 30, // For "interval" mode - number
            intervalUnit: "minutes" as "minutes" | "hours", // For "interval" mode
            timezone: "Asia/Shanghai",
            defaultPrompt: "",
            notification: "in_app",
            model: "deepseek-chat",
        },
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedIcon, setGeneratedIcon] = useState<string | null>(null); // base64 data URL

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

    // NEW: Handle full agent generation (prompt + icon in parallel)
    const handleGenerateAgent = async () => {
        if (!formData.name.trim() || !formData.description.trim()) {
            toast.error("请填写智能体名称和功能描述");
            return;
        }

        setIsGenerating(true);
        try {
            const result = await generateAgent(formData.name, formData.description, formData.tools);
            if (result) {
                setFormData(prev => ({ ...prev, systemPrompt: result.system_prompt }));
                if (result.icon_url) {
                    setGeneratedIcon(result.icon_url);
                }
                toast.success("智能体已生成，请确认后保存");
            }
        } catch (error) {
            toast.error("生成智能体失败");
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
                frequency: "daily" as const,
                time: "09:00",
                date: "",
                weekday: "1",
                monthDay: "1",
                intervalValue: 30,
                intervalUnit: "minutes" as const,
                timezone: "Asia/Shanghai",
                defaultPrompt: "",
                notification: "in_app",
                model: "deepseek-chat",
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
            toast.success("智能体已收藏到我的列表");
        } catch (error) {
            toast.error("收藏失败");
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
        setGeneratedIcon(null);
        setFormData({
            name: "",
            icon: "🤖",
            description: "",
            systemPrompt: "",
            tools: ["search_web"],
            isPublic: false,
            schedule: {
                enabled: false,
                frequency: "daily" as const,
                time: "09:00",
                date: "",
                weekday: "1",
                monthDay: "1",
                intervalValue: 30,
                intervalUnit: "minutes" as const,
                timezone: "Asia/Shanghai",
                defaultPrompt: "",
                notification: "in_app",
                model: "deepseek-chat",
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

    const renderStoreContent = () => {
        // Helper function to format count (e.g., 8800 -> "8.8K")
        const formatCount = (count: number) => {
            if (count >= 10000) {
                return `${(count / 10000).toFixed(1)}万`;
            } else if (count >= 1000) {
                return `${(count / 1000).toFixed(1)}K`;
            }
            return count.toString();
        };

        return (
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
                            className="p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
                            onClick={() => handleCopyAgent(agent)}
                        >
                            {/* Header: Icon + Name */}
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-2xl">{agent.icon}</span>
                                <h4 className="font-semibold text-foreground truncate flex-1">{agent.name}</h4>
                            </div>

                            {/* Description */}
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-3 min-h-[40px]">
                                {agent.description}
                            </p>

                            {/* Footer: Creator (left) + Stats (right) */}
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="truncate max-w-[100px]">
                                    @{agent.creator_name || "匿名"}
                                </span>
                                <div className="flex items-center gap-3">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="flex items-center gap-1 cursor-default">
                                                <Users className="w-3.5 h-3.5" />
                                                {formatCount(agent.usage_count || 0)}
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{(agent.usage_count || 0).toLocaleString()} 人使用过</p>
                                        </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="flex items-center gap-1 cursor-default">
                                                <Heart className="w-3.5 h-3.5" />
                                                {formatCount(agent.favorite_count || 0)}
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{(agent.favorite_count || 0).toLocaleString()} 人已收藏</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                            </div>

                            {/* Hover Action Button */}
                            <div className="pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="w-full text-muted-foreground hover:text-foreground"
                                    onClick={(e) => { e.stopPropagation(); handleCopyAgent(agent); }}
                                >
                                    <Heart className="w-3 h-3 mr-1" /> 收藏
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

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
                        <p>从商店收藏或创建你的专属智能体</p>
                    </div>
                )}
            </div>
        </div>
    );

    const renderCreateContent = () => (
        <div className="space-y-6 relative">
            {/* Loading Overlay */}
            {isGenerating && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-lg">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
                    <p className="text-sm text-muted-foreground">智能体生成中...</p>
                </div>
            )}

            {/* Title */}
            <h2 className="text-lg font-semibold text-foreground">
                {editingAgent ? "编辑智能体" : "新建智能体"}
            </h2>

            {/* Scrollable content */}
            <div className="max-h-[450px] overflow-y-auto pr-2 space-y-6">
                {/* Icon Picker */}

                <div>
                    <label className="text-sm text-foreground mb-2 block">图标</label>
                    <div className="flex gap-2 flex-wrap items-center">
                        {/* Generated AI Icon */}
                        {generatedIcon && (
                            <button
                                onClick={() => setFormData(prev => ({ ...prev, icon: generatedIcon }))}
                                className={cn(
                                    "w-12 h-12 rounded-lg flex items-center justify-center transition-all overflow-hidden",
                                    formData.icon === generatedIcon
                                        ? "ring-2 ring-primary"
                                        : "ring-1 ring-border hover:ring-primary/50"
                                )}
                            >
                                <img src={generatedIcon} alt="AI生成图标" className="w-full h-full object-cover" />
                            </button>
                        )}
                        {/* Emoji Options */}
                        {EMOJI_OPTIONS.map((emoji) => (
                            <button
                                key={emoji}
                                onClick={() => {
                                    setFormData(prev => ({ ...prev, icon: emoji }));
                                }}
                                className={cn(
                                    "w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all",
                                    formData.icon === emoji && !generatedIcon?.startsWith('data:')
                                        ? "bg-primary/20 ring-2 ring-primary"
                                        : "bg-accent hover:bg-accent/80"
                                )}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                    {generatedIcon && (
                        <p className="text-xs text-muted-foreground mt-1">✨ 已生成 AI 图标</p>
                    )}
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
                </div>

                {/* Generate Agent Button - shown before generation */}
                {!formData.systemPrompt && !editingAgent && (
                    <Button
                        className="w-full"
                        onClick={handleGenerateAgent}
                        disabled={!formData.name.trim() || !formData.description.trim() || isGenerating}
                    >
                        <Sparkles className="w-4 h-4 mr-2" /> 生成智能体
                    </Button>
                )}

                {/* System Prompt (shown after generation or for editing) */}
                {(formData.systemPrompt || editingAgent) && (
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm text-foreground">系统提示词</label>
                            <Button variant="ghost" size="sm" onClick={handleGeneratePrompt} disabled={isGenerating}>
                                🔄 重新生成
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                            由 AI 根据你的描述自动生成，你可以手动调整
                        </p>
                        <Textarea
                            value={formData.systemPrompt}
                            onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                            rows={8}
                            className="font-mono text-sm"
                            placeholder="点击「生成系统提示词」按钮来生成..."
                        />
                    </div>
                )}

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

                {/* Visibility Section */}
                <div>
                    <label className="text-sm text-foreground mb-2 block">可见性</label>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
                        <div className="flex items-center gap-2">
                            <span className="text-sm">公开到智能体商店</span>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button className="text-muted-foreground hover:text-foreground">
                                        <HelpCircle className="w-4 h-4" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[280px]">
                                    <p className="text-sm">
                                        公开后，其他用户可以使用你的智能体。
                                        每次被使用，你将获得积分奖励。
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <Switch
                            checked={formData.isPublic}
                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isPublic: checked }))}
                        />
                    </div>
                </div>

                {/* Scheduled Execution Section */}
                <div>
                    <label className="text-sm text-foreground mb-2 block">定时执行（可选）</label>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
                            <span className="text-sm">启用定时任务</span>
                            <Switch
                                checked={formData.schedule.enabled}
                                onCheckedChange={(checked) => setFormData(prev => ({
                                    ...prev,
                                    schedule: { ...prev.schedule, enabled: checked }
                                }))}
                            />
                        </div>

                        {formData.schedule.enabled && (
                            <div className="space-y-4 p-3 rounded-lg border border-border">
                                {/* Model Selection - Required when schedule enabled */}
                                <div>
                                    <label className="text-sm text-foreground mb-2 block">
                                        执行模型 <span className="text-destructive">*</span>
                                    </label>
                                    <Select
                                        value={formData.schedule.model || "deepseek-chat"}
                                        onValueChange={(v) => setFormData(prev => ({
                                            ...prev,
                                            schedule: { ...prev.schedule, model: v }
                                        }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="选择模型" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CHAT_MODELS.map((model) => (
                                                <SelectItem key={model.id} value={model.id}>
                                                    {model.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Frequency Selection - Horizontal Layout */}
                                <div>
                                    <label className="text-sm text-foreground mb-2 block">执行频率</label>
                                    <div className="flex items-center gap-3 flex-wrap">
                                        {/* Frequency Type Selector */}
                                        <Select
                                            value={formData.schedule.frequency}
                                            onValueChange={(v: "once" | "daily" | "weekly" | "monthly" | "interval") => setFormData(prev => ({
                                                ...prev,
                                                schedule: { ...prev.schedule, frequency: v }
                                            }))}
                                        >
                                            <SelectTrigger className="w-[120px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="once">只执行一次</SelectItem>
                                                <SelectItem value="daily">每天</SelectItem>
                                                <SelectItem value="weekly">每周</SelectItem>
                                                <SelectItem value="monthly">每月</SelectItem>
                                                <SelectItem value="interval">每隔</SelectItem>
                                            </SelectContent>
                                        </Select>

                                        {/* Once Mode: Date + Time */}
                                        {formData.schedule.frequency === "once" && (
                                            <>
                                                <Input
                                                    type="date"
                                                    value={formData.schedule.date}
                                                    onChange={(e) => setFormData(prev => ({
                                                        ...prev,
                                                        schedule: { ...prev.schedule, date: e.target.value }
                                                    }))}
                                                    className="w-[150px]"
                                                />
                                                <Select
                                                    value={formData.schedule.time}
                                                    onValueChange={(v) => setFormData(prev => ({
                                                        ...prev,
                                                        schedule: { ...prev.schedule, time: v }
                                                    }))}
                                                >
                                                    <SelectTrigger className="w-[100px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {Array.from({ length: 24 }, (_, h) =>
                                                            ["00", "30"].map(m => {
                                                                const time = `${h.toString().padStart(2, '0')}:${m}`;
                                                                return <SelectItem key={time} value={time}>{time}</SelectItem>;
                                                            })
                                                        ).flat()}
                                                    </SelectContent>
                                                </Select>
                                            </>
                                        )}

                                        {/* Daily Mode: Just Time */}
                                        {formData.schedule.frequency === "daily" && (
                                            <Select
                                                value={formData.schedule.time}
                                                onValueChange={(v) => setFormData(prev => ({
                                                    ...prev,
                                                    schedule: { ...prev.schedule, time: v }
                                                }))}
                                            >
                                                <SelectTrigger className="w-[100px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Array.from({ length: 24 }, (_, h) =>
                                                        ["00", "30"].map(m => {
                                                            const time = `${h.toString().padStart(2, '0')}:${m}`;
                                                            return <SelectItem key={time} value={time}>{time}</SelectItem>;
                                                        })
                                                    ).flat()}
                                                </SelectContent>
                                            </Select>
                                        )}

                                        {/* Weekly Mode: Weekday + Time */}
                                        {formData.schedule.frequency === "weekly" && (
                                            <>
                                                <Select
                                                    value={formData.schedule.weekday}
                                                    onValueChange={(v) => setFormData(prev => ({
                                                        ...prev,
                                                        schedule: { ...prev.schedule, weekday: v }
                                                    }))}
                                                >
                                                    <SelectTrigger className="w-[100px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="1">星期一</SelectItem>
                                                        <SelectItem value="2">星期二</SelectItem>
                                                        <SelectItem value="3">星期三</SelectItem>
                                                        <SelectItem value="4">星期四</SelectItem>
                                                        <SelectItem value="5">星期五</SelectItem>
                                                        <SelectItem value="6">星期六</SelectItem>
                                                        <SelectItem value="7">星期日</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Select
                                                    value={formData.schedule.time}
                                                    onValueChange={(v) => setFormData(prev => ({
                                                        ...prev,
                                                        schedule: { ...prev.schedule, time: v }
                                                    }))}
                                                >
                                                    <SelectTrigger className="w-[100px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {Array.from({ length: 24 }, (_, h) =>
                                                            ["00", "30"].map(m => {
                                                                const time = `${h.toString().padStart(2, '0')}:${m}`;
                                                                return <SelectItem key={time} value={time}>{time}</SelectItem>;
                                                            })
                                                        ).flat()}
                                                    </SelectContent>
                                                </Select>
                                            </>
                                        )}

                                        {/* Monthly Mode: Day + Time */}
                                        {formData.schedule.frequency === "monthly" && (
                                            <>
                                                <Select
                                                    value={formData.schedule.monthDay}
                                                    onValueChange={(v) => setFormData(prev => ({
                                                        ...prev,
                                                        schedule: { ...prev.schedule, monthDay: v }
                                                    }))}
                                                >
                                                    <SelectTrigger className="w-[80px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {Array.from({ length: 31 }, (_, i) => (
                                                            <SelectItem key={i + 1} value={String(i + 1)}>
                                                                {i + 1}号
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Select
                                                    value={formData.schedule.time}
                                                    onValueChange={(v) => setFormData(prev => ({
                                                        ...prev,
                                                        schedule: { ...prev.schedule, time: v }
                                                    }))}
                                                >
                                                    <SelectTrigger className="w-[100px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {Array.from({ length: 24 }, (_, h) =>
                                                            ["00", "30"].map(m => {
                                                                const time = `${h.toString().padStart(2, '0')}:${m}`;
                                                                return <SelectItem key={time} value={time}>{time}</SelectItem>;
                                                            })
                                                        ).flat()}
                                                    </SelectContent>
                                                </Select>
                                            </>
                                        )}

                                        {/* Interval Mode: Number + Unit */}
                                        {formData.schedule.frequency === "interval" && (
                                            <>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={999}
                                                    value={formData.schedule.intervalValue}
                                                    onChange={(e) => setFormData(prev => ({
                                                        ...prev,
                                                        schedule: { ...prev.schedule, intervalValue: parseInt(e.target.value) || 1 }
                                                    }))}
                                                    className="w-[80px]"
                                                />
                                                <Select
                                                    value={formData.schedule.intervalUnit}
                                                    onValueChange={(v: "minutes" | "hours") => setFormData(prev => ({
                                                        ...prev,
                                                        schedule: { ...prev.schedule, intervalUnit: v }
                                                    }))}
                                                >
                                                    <SelectTrigger className="w-[80px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="minutes">分钟</SelectItem>
                                                        <SelectItem value="hours">小时</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </>
                                        )}
                                    </div>
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
                                        {[
                                            { value: "in_app", label: "应用内" },
                                            { value: "email", label: "邮件" },
                                            { value: "none", label: "不通知" },
                                        ].map((method) => (
                                            <label key={method.value} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="notification"
                                                    value={method.value}
                                                    checked={formData.schedule.notification === method.value}
                                                    onChange={(e) => setFormData(prev => ({
                                                        ...prev,
                                                        schedule: { ...prev.schedule, notification: e.target.value }
                                                    }))}
                                                    className="w-4 h-4"
                                                />
                                                <span className="text-sm">{method.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer - inside scrollable area */}
                <div className="flex justify-end gap-2 pt-4 mt-2 border-t border-border">
                    <Button variant="outline" onClick={resetForm}>取消</Button>
                    <Button
                        onClick={handleSaveAgent}
                        disabled={!formData.name || !formData.description || (formData.schedule.enabled && !formData.schedule.model)}
                    >
                        保存
                    </Button>
                </div>
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
