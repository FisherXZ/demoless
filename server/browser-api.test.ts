import type { NextApiRequest, NextApiResponse } from "next";
import { describe, expect, it, vi, afterEach } from "vitest";

import handler from "../pages/api/browser";
import * as browser from "@/lib/browser/session";

vi.mock("@/lib/browser/session", () => ({
  startSession: vi.fn().mockResolvedValue({
    sessionId: "bb-session",
    liveViewUrl: "https://live.example.com",
    url: "https://www.browserbase.com/",
    title: "Browserbase",
  }),
  navigate: vi.fn().mockResolvedValue({
    sessionId: "bb-session",
    url: "https://example.com/docs",
    title: "Docs",
  }),
  clickText: vi.fn().mockResolvedValue({
    sessionId: "bb-session",
    url: "https://example.com/pricing",
    title: "Pricing",
  }),
  stopSession: vi.fn().mockResolvedValue(undefined),
}));

function req(body: unknown, method = "POST") {
  return { method, body } as NextApiRequest;
}

function res() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    headers: new Map<string, string | string[]>(),
    setHeader: vi.fn((key: string, value: string | string[]) => {
      response.headers.set(key, value);
      return response;
    }),
    status: vi.fn((code: number) => {
      response.statusCode = code;
      return response;
    }),
    json: vi.fn((body: unknown) => {
      response.body = body;
      return response;
    }),
  };
  return response as unknown as NextApiResponse & typeof response;
}

describe("/api/browser", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("rejects production browser-control requests before starting a Browserbase session", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = res();

    await handler(req({ action: "start", url: "https://www.browserbase.com/" }), response);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ ok: false, error: "not found" });
    expect(browser.startSession).not.toHaveBeenCalled();
  });

  it("allows only POST requests", async () => {
    const response = res();

    await handler(req({}, "GET"), response);

    expect(response.setHeader).toHaveBeenCalledWith("Allow", "POST");
    expect(response.status).toHaveBeenCalledWith(405);
    expect(response.json).toHaveBeenCalledWith({
      ok: false,
      error: "method not allowed",
    });
  });

  it("starts a sandbox browser session with the requested URL", async () => {
    const response = res();

    await handler(req({ action: "start", url: "https://example.com/demo" }), response);

    expect(browser.startSession).toHaveBeenCalledWith("https://example.com/demo");
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.body).toEqual({
      ok: true,
      sessionId: "bb-session",
      liveViewUrl: "https://live.example.com",
      url: "https://www.browserbase.com/",
      title: "Browserbase",
    });
  });

  it("starts at the default target when no URL is provided", async () => {
    const response = res();

    await handler(req({ action: "start" }), response);

    expect(browser.startSession).toHaveBeenCalledWith("https://www.browserbase.com/");
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it("navigates an existing sandbox session", async () => {
    const response = res();

    await handler(
      req({ action: "navigate", sessionId: "bb-session", url: "https://example.com/docs" }),
      response
    );

    expect(browser.navigate).toHaveBeenCalledWith(
      "bb-session",
      "https://example.com/docs"
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.body).toEqual({
      ok: true,
      sessionId: "bb-session",
      url: "https://example.com/docs",
      title: "Docs",
    });
  });

  it("requires a session id and URL before navigating", async () => {
    const missingSession = res();
    const missingUrl = res();

    await handler(req({ action: "navigate", url: "https://example.com/docs" }), missingSession);
    await handler(req({ action: "navigate", sessionId: "bb-session" }), missingUrl);

    expect(missingSession.status).toHaveBeenCalledWith(500);
    expect(missingSession.body).toEqual({
      ok: false,
      error: "sessionId and url required",
    });
    expect(missingUrl.status).toHaveBeenCalledWith(500);
    expect(missingUrl.body).toEqual({
      ok: false,
      error: "sessionId and url required",
    });
    expect(browser.navigate).not.toHaveBeenCalled();
  });

  it("clicks visible text in an existing sandbox session", async () => {
    const response = res();

    await handler(req({ action: "click", sessionId: "bb-session", text: "Pricing" }), response);

    expect(browser.clickText).toHaveBeenCalledWith("bb-session", "Pricing");
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.body).toEqual({
      ok: true,
      sessionId: "bb-session",
      url: "https://example.com/pricing",
      title: "Pricing",
    });
  });

  it("requires a session id and visible text before clicking", async () => {
    const missingSession = res();
    const missingText = res();

    await handler(req({ action: "click", text: "Pricing" }), missingSession);
    await handler(req({ action: "click", sessionId: "bb-session" }), missingText);

    expect(missingSession.status).toHaveBeenCalledWith(500);
    expect(missingSession.body).toEqual({
      ok: false,
      error: "sessionId and text required",
    });
    expect(missingText.status).toHaveBeenCalledWith(500);
    expect(missingText.body).toEqual({
      ok: false,
      error: "sessionId and text required",
    });
    expect(browser.clickText).not.toHaveBeenCalled();
  });

  it("stops an existing sandbox session", async () => {
    const response = res();

    await handler(req({ action: "stop", sessionId: "bb-session" }), response);

    expect(browser.stopSession).toHaveBeenCalledWith("bb-session");
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.body).toEqual({ ok: true });
  });

  it("treats stop without a session id as already stopped", async () => {
    const response = res();

    await handler(req({ action: "stop" }), response);

    expect(browser.stopSession).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.body).toEqual({ ok: true });
  });

  it("reports unknown or missing actions", async () => {
    const unknown = res();
    const missing = res();

    await handler(req({ action: "launch" }), unknown);
    await handler(req(undefined), missing);

    expect(unknown.status).toHaveBeenCalledWith(400);
    expect(unknown.body).toEqual({ ok: false, error: "unknown action" });
    expect(missing.status).toHaveBeenCalledWith(400);
    expect(missing.body).toEqual({ ok: false, error: "unknown action" });
  });

  it("reports browser adapter failures", async () => {
    vi.mocked(browser.navigate).mockRejectedValueOnce("adapter offline");
    const response = res();

    await handler(
      req({ action: "navigate", sessionId: "bb-session", url: "https://example.com/docs" }),
      response
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.body).toEqual({ ok: false, error: "adapter offline" });
  });
});
