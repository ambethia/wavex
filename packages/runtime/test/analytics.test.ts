import { describe, expect, it, vi } from "vitest";
import { analyticsEventNameForTarget, createPostHogCaptureClient } from "../src/index.js";

describe("analytics", () => {
  it("posts PostHog capture payloads with stable distinct ids and WAVEx lib metadata", () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const storage = new Map<string, string>();
    const client = createPostHogCaptureClient({
      apiKey: "ph_test",
      host: "https://posthog.example/",
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value)
      },
      fetchFn: vi.fn((url: string | URL | Request, init?: RequestInit) => {
        requests.push({ url: String(url), init: init ?? {} });
        return Promise.resolve(new Response(null, { status: 200 }));
      }) as typeof fetch
    });

    client.capture("tasks:create", { id: "task-1" });
    client.capture("tasks:toggle");

    expect(requests).toHaveLength(2);
    expect(requests[0]?.url).toBe("https://posthog.example/capture/");
    expect(requests[0]?.init).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true
    });

    const firstPayload = JSON.parse(String(requests[0]?.init.body));
    const secondPayload = JSON.parse(String(requests[1]?.init.body));
    expect(firstPayload).toMatchObject({
      api_key: "ph_test",
      event: "tasks:create",
      properties: { id: "task-1", $lib: "wavex" }
    });
    expect(secondPayload).toMatchObject({
      api_key: "ph_test",
      event: "tasks:toggle",
      properties: { $lib: "wavex" }
    });
    expect(firstPayload.distinct_id).toMatch(/^wx-|[0-9a-f-]{36}/);
    expect(secondPayload.distinct_id).toBe(firstPayload.distinct_id);
  });

  it("uses an anonymous distinct id when no storage exists", () => {
    const requests: RequestInit[] = [];
    const client = createPostHogCaptureClient({
      apiKey: "ph_test",
      fetchFn: vi.fn((_url: string | URL | Request, init?: RequestInit) => {
        requests.push(init ?? {});
        return Promise.resolve(new Response(null, { status: 200 }));
      }) as typeof fetch
    });

    client.capture("anonymous");

    expect(JSON.parse(String(requests[0]?.body))).toMatchObject({ distinct_id: "wavex-anonymous" });
  });

  it("captures without throwing when storage persistence fails", () => {
    const requests: RequestInit[] = [];
    const client = createPostHogCaptureClient({
      apiKey: "ph_test",
      storage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        }
      },
      fetchFn: vi.fn((_url: string | URL | Request, init?: RequestInit) => {
        requests.push(init ?? {});
        return Promise.resolve(new Response(null, { status: 200 }));
      }) as typeof fetch
    });

    expect(() => client.capture("private-mode")).not.toThrow();
    expect(JSON.parse(String(requests[0]?.body))).toMatchObject({
      api_key: "ph_test",
      event: "private-mode",
      properties: { $lib: "wavex" }
    });
  });

  it("derives conventional event names from semantic action targets", () => {
    expect(analyticsEventNameForTarget("$$tasks:create")).toBe("tasks:create");
    expect(analyticsEventNameForTarget("$pageview")).toBe("pageview");
    expect(analyticsEventNameForTarget("custom")).toBe("custom");
  });
});
