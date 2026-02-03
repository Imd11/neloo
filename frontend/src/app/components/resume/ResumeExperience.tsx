"use client";

import { ResumePageContent } from "@/app/resume/page";

export function ResumeExperience({ onExit }: { onExit: () => void }) {
    return <ResumePageContent onExit={onExit} />;
}
