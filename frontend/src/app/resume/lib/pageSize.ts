import type { PageSize } from "../types/resume";

export const PAGE_PRESETS: Record<
  PageSize,
  { label: string; width: string; height: string; printSize: "A4" | "letter" }
> = {
  A4: {
    label: 'A4 (8.27" x 11.69")',
    width: "210mm",
    height: "297mm",
    printSize: "A4",
  },
  Letter: {
    label: 'Letter (8.5" x 11")',
    width: "216mm",
    height: "279mm",
    printSize: "letter",
  },
};

export function getPagePreset(pageSize: PageSize) {
  return PAGE_PRESETS[pageSize];
}
