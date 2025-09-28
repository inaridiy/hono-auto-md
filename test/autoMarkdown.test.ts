import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import autoMarkdown from "../src/index";

const HTML_PAGE = `
  <main>
    <h1>Hello!</h1>
    <p>This page will be converted to Markdown for AI agents.</p>
  </main>
`;

const createApp = (options?: Parameters<typeof autoMarkdown>[0]) => {
  const app = new Hono();
  app.use("*", autoMarkdown(options));
  app.get("/", (c) => c.html(HTML_PAGE));
  app.get("/plain", (c) => c.text("Plain text", 200, { "content-type": "text/plain" }));
  return app;
};

describe("autoMarkdown middleware", () => {
  it("converts HTML responses to Markdown for AI-looking requests", async () => {
    const app = createApp();

    const response = await app.request("https://example.com/", {
      headers: { "user-agent": "ChatGPT Browser" },
    });

    expect(response.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(response.headers.get("x-hono-auto-md")).toBe("1");

    const markdown = await response.text();
    expect(markdown).toContain("Hello!");
    expect(markdown).not.toContain("<h1>");
  });

  it("leaves HTML untouched for regular browsers", async () => {
    const app = createApp();

    const response = await app.request("https://example.com/", {
      headers: { "user-agent": "Mozilla/5.0" },
    });

    expect(response.headers.get("content-type")).toContain("text/html");

    const body = await response.text();
    expect(body).toContain("<h1>Hello!</h1>");
  });

  it("respects allowedContentTypes and skips conversion", async () => {
    const app = createApp({ allowedContentTypes: ["application/xhtml+xml"] });

    const response = await app.request("https://example.com/", {
      headers: { "user-agent": "ChatGPT Browser" },
    });

    expect(response.headers.get("content-type")).toContain("text/html");
  });

  it("uses custom detect function when provided", async () => {
    const app = createApp({
      detect: (request) => request.headers.get("x-my-ai-bot") === "1",
    });

    const response = await app.request("https://example.com/", {
      headers: {
        "user-agent": "Mozilla/5.0",
        "x-my-ai-bot": "1",
      },
    });

    expect(response.headers.get("content-type")).toBe("text/markdown; charset=utf-8");

    const markdown = await response.text();
    expect(markdown).toContain("Hello!");
  });

  it("does not convert non-HTML responses", async () => {
    const app = createApp();

    const response = await app.request("https://example.com/plain", {
      headers: { "user-agent": "ChatGPT Browser" },
    });

    expect(response.headers.get("content-type")).toBe("text/plain");
    expect(response.headers.get("x-hono-auto-md")).toBeNull();

    const body = await response.text();
    expect(body).toBe("Plain text");
  });
});
