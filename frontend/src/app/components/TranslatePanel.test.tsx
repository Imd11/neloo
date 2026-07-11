import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TranslatePanel } from "./TranslatePanel";

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({
    session: { access_token: "" },
    loading: true,
  }),
}));

vi.mock("@/providers/LanguageProvider", () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock("@/app/context/SidebarContext", () => ({
  useSidebar: () => ({ collapsed: false, width: 240, collapsedWidth: 64 }),
}));

describe("TranslatePanel authentication", () => {
  it("does not submit while the guest session is loading", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<TranslatePanel onBack={() => undefined} />);

    fireEvent.change(screen.getByPlaceholderText("translate.source_placeholder"), {
      target: { value: "Hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: "translate.action" }));

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
