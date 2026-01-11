"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/providers/AuthProvider";

interface UserProfileDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function UserProfileDialog({ open, onOpenChange }: UserProfileDialogProps) {
    const { user, signOut } = useAuth();

    // Mock user if not logged in (or get from auth)
    const displayName = user?.email?.split('@')[0] || "User";
    const email = user?.email || "user@example.com";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>个人资料</DialogTitle>
                    <DialogDescription>
                        查看与管理你的个人信息
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center gap-4 py-4">
                    <Avatar className="w-20 h-20">
                        <AvatarImage src="" />
                        <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                            {displayName[0].toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="text-center">
                        <h3 className="text-lg font-medium">{displayName}</h3>
                        <p className="text-sm text-muted-foreground">{email}</p>
                    </div>

                    <div className="w-full border-t border-border my-2" />

                    <div className="w-full space-y-2">
                        <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                            <span className="text-sm font-medium">当前计划</span>
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">Pro Plan</span>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                            <span className="text-sm font-medium">使用额度</span>
                            <span className="text-sm text-muted-foreground">85 / 100 次</span>
                        </div>
                    </div>

                    <div className="w-full pt-4">
                        <Button
                            variant="destructive"
                            className="w-full"
                            onClick={() => signOut()}
                        >
                            退出登录
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
