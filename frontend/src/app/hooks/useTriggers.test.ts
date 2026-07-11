import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useTriggers } from "./useTriggers";

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({
    session: { access_token: "signed-trigger-token" },
    loading: false,
  }),
}));

vi.mock("@/lib/config", () => ({
  getConfig: () => ({ deploymentUrl: "http://backend.test" }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useTriggers authentication", () => {
  it("uses the current AuthProvider guest token for trigger requests", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    renderHook(() => useTriggers("agent-1"));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const request = fetchSpy.mock.calls[0];

    expect(request[0]).toBe("http://backend.test/api/triggers");
    expect((request[1]?.headers as Record<string, string>).Authorization).toBe(
      "Bearer signed-trigger-token"
    );
  });
});
