import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
  type AutoMarkdownOptions,
  autoMarkdown,
  CLAUDE_CODE_HEADER_MATCHER,
  MARKDOWN_CONTENT_TYPE,
} from "../src/index";
import { resolveBaseUrl } from "../src/utils";

const HTML_PAGE = `
  <main>
    <h1>Hello!</h1>
    <p>This page will be converted to Markdown for AI agents.</p>
  </main>
`;

const createApp = (options?: AutoMarkdownOptions) => {
  const app = new Hono();
  app.use("*", autoMarkdown(options));
  app.get("/", (c) => c.html(HTML_PAGE));
  app.get("/plain", (c) => c.text("Plain text", 200, { "content-type": "text/plain" }));
  app.get("/markdown", (c) => c.text("# Already Markdown", 200, { "content-type": "text/markdown" }));
  return app;
};

describe("autoMarkdown middleware", () => {
  it("converts HTML responses to Markdown for default header matchers", async () => {
    const app = createApp();
    const claudeAgent = CLAUDE_CODE_HEADER_MATCHER[0]?.includes?.[0] ?? "Claude-User";

    const response = await app.request("https://example.com/", {
      headers: { "user-agent": claudeAgent },
    });

    expect(response.headers.get("content-type")).toBe(MARKDOWN_CONTENT_TYPE);
    expect(response.headers.get("x-hono-auto-md")).toBe("TRUE");

    const markdown = await response.text();
    expect(markdown).toContain("# Hello!");
    expect(markdown).not.toContain("<h1>");
  });

  it("leaves HTML untouched for unmatched requests", async () => {
    const app = createApp();

    const response = await app.request("https://example.com/", {
      headers: { "user-agent": "Mozilla/5.0" },
    });

    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("x-hono-auto-md")).toBeNull();

    const body = await response.text();
    expect(body).toContain("<h1>Hello!</h1>");
  });

  it("skips conversion when response is already Markdown", async () => {
    const app = createApp();

    const response = await app.request("https://example.com/markdown", {
      headers: { "user-agent": "Claude-User" },
    });

    expect(response.headers.get("content-type")).toBe("text/markdown");
    expect(response.headers.get("x-hono-auto-md")).toBeNull();

    const body = await response.text();
    expect(body).toContain("Already Markdown");
  });

  it("respects allowedContentTypes option", async () => {
    const app = createApp({ allowedContentTypes: ["application/xhtml+xml"] });

    const response = await app.request("https://example.com/", {
      headers: { "user-agent": "Claude-User" },
    });

    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("x-hono-auto-md")).toBeNull();
  });

  it("supports custom detect functions", async () => {
    const app = createApp({
      detect: async (request) => request.header("x-my-ai-bot") === "1",
    });

    const response = await app.request("https://example.com/", {
      headers: {
        "user-agent": "Mozilla/5.0",
        "x-my-ai-bot": "1",
      },
    });

    expect(response.headers.get("content-type")).toBe(MARKDOWN_CONTENT_TYPE);
    expect(response.headers.get("x-hono-auto-md")).toBe("TRUE");
  });

  it("supports header matcher arrays via the detect option", async () => {
    const app = createApp({
      detect: [
        {
          header: "x-llm-client",
          equals: ["demo"],
        },
      ],
    });

    const response = await app.request("https://example.com/", {
      headers: {
        "user-agent": "Mozilla/5.0",
        "x-llm-client": "demo",
      },
    });

    expect(response.headers.get("content-type")).toBe(MARKDOWN_CONTENT_TYPE);
    expect(response.headers.get("x-hono-auto-md")).toBe("TRUE");
  });

  it("allows overriding the response content type", async () => {
    const app = createApp({
      responseContentType: "text/plain",
    });

    const response = await app.request("https://example.com/", {
      headers: { "user-agent": "Claude-User" },
    });

    expect(response.headers.get("content-type")).toBe("text/plain");
    expect(response.headers.get("x-hono-auto-md")).toBe("TRUE");
  });

  it("supports a custom htmlToMarkdown implementation", async () => {
    const app = createApp({
      htmlToMarkdown: () => "Custom Markdown",
    });

    const response = await app.request("https://example.com/", {
      headers: { "user-agent": "Claude-User" },
    });

    expect(response.headers.get("content-type")).toBe(MARKDOWN_CONTENT_TYPE);

    const markdown = await response.text();
    expect(markdown).toBe("Custom Markdown");
  });

  it("does not convert non-HTML responses", async () => {
    const app = createApp();

    const response = await app.request("https://example.com/plain", {
      headers: { "user-agent": "Claude-User" },
    });

    expect(response.headers.get("content-type")).toBe("text/plain");
    expect(response.headers.get("x-hono-auto-md")).toBeNull();

    const body = await response.text();
    expect(body).toBe("Plain text");
  });
});

describe("resolveBaseUrl", () => {
  it("returns the same absolute URL string", () => {
    const url = "https://example.com/path";
    expect(resolveBaseUrl(url)).toBe(url);
  });

  it("returns undefined for invalid URLs", () => {
    expect(resolveBaseUrl("/relative")).toBeUndefined();
    expect(resolveBaseUrl("not-a-url")).toBeUndefined();
  });
});
