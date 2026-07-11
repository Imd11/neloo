"use client";

import { ImagePageContent } from "@/app/image/page";

export function ImageExperience({ onExit }: { onExit: () => void }) {
  return <ImagePageContent onExit={onExit} />;
}
