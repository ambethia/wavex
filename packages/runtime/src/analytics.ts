export interface AnalyticsClient {
  capture(event: string, properties?: Record<string, unknown>): void;
}

export interface PostHogCaptureOptions {
  apiKey: string;
  /** PostHog instance origin, default https://us.i.posthog.com */
  host?: string;
  fetchFn?: typeof fetch;
  storage?: Pick<Storage, "getItem" | "setItem">;
}

/**
 * Minimal PostHog capture bridge (decision for the baseline: no official
 * client dependency; events POST to the public /capture endpoint). Analytics
 * stays optional — apps enable it with VITE_POSTHOG_KEY / VITE_POSTHOG_HOST.
 */
export function createPostHogCaptureClient(options: PostHogCaptureOptions): AnalyticsClient {
  const host = (options.host ?? "https://us.i.posthog.com").replace(/\/$/, "");
  const fetchFn = options.fetchFn ?? fetch;

  return {
    capture(event, properties = {}) {
      try {
        const payload = {
          api_key: options.apiKey,
          event,
          distinct_id: distinctId(options.storage),
          properties: { ...properties, $lib: "wavex" },
          timestamp: new Date().toISOString()
        };
        void Promise.resolve(
          fetchFn(`${host}/capture/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            keepalive: true
          })
        ).catch(() => undefined);
      } catch {
        // PostHog telemetry is optional; storage, serialization, and fetch
        // failures must never bubble into app actions or rendering.
      }
    }
  };
}

function distinctId(storage: Pick<Storage, "getItem" | "setItem"> | undefined): string {
  const store = storage ?? defaultStorage();
  if (!store) return "wavex-anonymous";
  try {
    const existing = store.getItem("wx_distinct_id");
    if (existing) return existing;
  } catch {
    return createVolatileDistinctId();
  }

  const id = createVolatileDistinctId();
  try {
    store.setItem("wx_distinct_id", id);
  } catch {
    // Safari private mode can throw on setItem. Keep capture non-blocking by
    // using this event's generated id without attempting persistence fallback.
  }
  return id;
}

function defaultStorage(): Pick<Storage, "getItem" | "setItem"> | undefined {
  try {
    return typeof localStorage !== "undefined" ? localStorage : undefined;
  } catch {
    return undefined;
  }
}

function createVolatileDistinctId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `wx-${Date.now().toString(36)}`;
}

/** Conventional analytics event name for a semantic Convex action target, e.g. "$$tasks:create" -> "tasks:create". */
export function analyticsEventNameForTarget(target: string): string {
  return target.replace(/^\$\$?/, "");
}
