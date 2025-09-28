import type { HonoRequest, MiddlewareHandler } from "hono";
import { type HtmlToMarkdownOptions, htmlToMarkdown as webforaiHtmlToMarkdown } from "webforai";
import { type HeaderMatcher, isMatchHeader } from "./header-mather";
import { resolveBaseUrl } from "./utils";

export interface AutoMarkdownOptions {
  detect?: ((request: HonoRequest) => boolean | Promise<boolean>) | HeaderMatcher[];
  htmlToMarkdown?:
    | Omit<HtmlToMarkdownOptions, "baseUrl">
    | ((payload: string) => string | Promise<string>);
  allowedContentTypes?: string[];
  responseContentType?: string;
}

// Heuristics for popular LLM user agents and helper headers.
export const CLAUDE_CODE_HEADER_MATCHER: HeaderMatcher[] = [
  {
    header: "user-agent",
    includes: ["Claude-User"],
  },
];

export const DEFAULT_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];

export const MARKDOWN_CONTENT_TYPE = "text/markdown; charset=utf-8";

export const autoMarkdown = (options: AutoMarkdownOptions = {}): MiddlewareHandler => {
  const detect = options.detect ?? CLAUDE_CODE_HEADER_MATCHER;
  const htmlToMarkdown = options.htmlToMarkdown ?? {};
  const allowedContentTypes = options.allowedContentTypes ?? DEFAULT_CONTENT_TYPES;
  const contentTypeForMarkdown = options.responseContentType ?? MARKDOWN_CONTENT_TYPE;

  return async (c, next) => {
    await next();

    const response = c.res;
    if (!response) return;

    if (response.headers.get("content-type")?.includes("text/markdown")) {
      return;
    }

    const shouldConvert =
      typeof detect === "function"
        ? await detect(c.req)
        : isMatchHeader(c.req, Array.isArray(detect) ? detect : []);
    if (!shouldConvert) return;

    const responseContentType = response.headers.get("content-type")?.toLowerCase();
    const shouldConvertContentType = allowedContentTypes.some((type) =>
      responseContentType?.includes(type.toLowerCase()),
    );
    if (!shouldConvertContentType) return;

    const cloned = response.clone();
    const html = await cloned.text();

    const markdown =
      htmlToMarkdown && typeof htmlToMarkdown === "function"
        ? await htmlToMarkdown(html)
        : webforaiHtmlToMarkdown(html, { baseUrl: resolveBaseUrl(c.req.url), ...htmlToMarkdown });

    const headers = new Headers(response.headers);
    headers.set("content-type", contentTypeForMarkdown);
    headers.set("x-hono-auto-md", "TRUE");
    headers.delete("content-length");

    c.res = new Response(markdown, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
};

export default autoMarkdown;
