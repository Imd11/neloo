"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * OAuth Callback Landing Page
 * 
 * This page handles redirects from OAuth providers (e.g., Twitter via Composio).
 * It redirects to home and opens the settings modal automatically.
 */
function SettingsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        // Get query params for passing to home
        const tab = searchParams.get("tab") || "apps";
        const app = searchParams.get("app") || "";

        // Redirect to home with settings params
        // The home page should detect these and open the settings modal
        const redirectUrl = `/?openSettings=true&tab=${tab}&app=${app}`;
        router.replace(redirectUrl);
    }, [router, searchParams]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-gray-400">正在完成授权...</p>
            </div>
        </div>
    );
}

export default function SettingsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-black text-white">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-gray-400">加载中...</p>
                </div>
            </div>
        }>
            <SettingsContent />
        </Suspense>
    );
}
