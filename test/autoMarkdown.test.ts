import { describe, expect, it } from "vitest";
import autoMarkdown from "../src/index";

const createRequest = (headers: Record<string, string>) => {
  return new Request("https://example.com/articles/1", {
    headers,
  });
};

describe("autoMarkdown middleware", () => {
  it("converts HTML responses to Markdown for AI-looking requests", async () => {
    const middleware = autoMarkdown();
    const req = createRequest({ "user-agent": "ChatGPT Browser" });

    const ctx: any = { req: { raw: req }, res: undefined };
    const htmlBody = "<main><h1>Hello!</h1><p>This page.</p></main>";
    let originalResponse: Response | undefined;

    const next = async () => {
      originalResponse = new Response(htmlBody, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
      ctx.res = originalResponse;
    };

    await middleware(ctx, next);

    expect(ctx.res).not.toBe(originalResponse);
    expect(ctx.res?.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(ctx.res?.headers.get("x-hono-auto-md")).toBe("1");

    const markdown = await ctx.res!.text();
    expect(markdown).toContain("Hello!");
    expect(markdown).not.toContain("<h1>");
  });

  it("leaves HTML untouched for regular browsers", async () => {
    const middleware = autoMarkdown();
    const req = createRequest({ "user-agent": "Mozilla/5.0" });

    const ctx: any = { req: { raw: req }, res: undefined };
    const originalResponse = new Response("<h1>Welcome</h1>", {
      headers: { "content-type": "text/html; charset=utf-8" },
    });

    const next = async () => {
      ctx.res = originalResponse;
    };

    await middleware(ctx, next);

    expect(ctx.res).toBe(originalResponse);
  });

  it("respects allowedContentTypes and skips conversion", async () => {
    const middleware = autoMarkdown({ allowedContentTypes: ["application/xhtml+xml"] });
    const req = createRequest({ "user-agent": "ChatGPT Browser" });

    const ctx: any = { req: { raw: req }, res: undefined };
    const originalResponse = new Response("<h1>Hi</h1>", {
      headers: { "content-type": "text/plain" },
    });

    const next = async () => {
      ctx.res = originalResponse;
    };

    await middleware(ctx, next);

    expect(ctx.res).toBe(originalResponse);
  });

  it("uses custom detect function when provided", async () => {
    const middleware = autoMarkdown({
      detect: (request) => request.headers.get("x-my-ai-bot") === "1",
    });
    const req = createRequest({ "user-agent": "Mozilla/5.0", "x-my-ai-bot": "1" });

    const ctx: any = { req: { raw: req }, res: undefined };
    const htmlBody = "<h1>Docs</h1>";

    const next = async () => {
      ctx.res = new Response(htmlBody, {
        headers: { "content-type": "text/html" },
      });
    };

    await middleware(ctx, next);

    const markdown = await ctx.res!.text();
    expect(markdown).toContain("Docs");
  });
});
