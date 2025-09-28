import type { MiddlewareHandler } from "hono";
import { htmlToMarkdown } from "webforai";

export type HeaderMatcher = {
  header: string;
  includes?: string[];
  equals?: string[];
  matches?: RegExp[];
};

export interface AutoMarkdownOptions {
  detect?: (request: Request) => boolean | Promise<boolean>;
  headerMatchers?: HeaderMatcher[];
  allowedContentTypes?: string[];
  responseContentType?: string;
  onDetectError?: (error: unknown, request: Request) => void;
  onConvertError?: (error: unknown, request: Request) => void;
}

// Heuristics for popular LLM user agents and helper headers.
const DEFAULT_HEADER_MATCHERS: HeaderMatcher[] = [
  {
    header: "user-agent",
    includes: [
      "gpt",
      "chatgpt",
      "chat-gpt",
      "openai",
      "anthropic",
      "claude",
      "gemini",
      "bard",
      "llama",
      "mistral",
      "ollama",
      "llm",
      "ai-search",
    ],
  },
  {
    header: "x-openai-host",
  },
  {
    header: "x-ai-client",
  },
  {
    header: "x-stainless-runtime",
    includes: ["ai"],
  },
];

const DEFAULT_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];

const MARKDOWN_CONTENT_TYPE = "text/markdown; charset=utf-8";

const hasTextMatch = (value: string, matcher: HeaderMatcher): boolean => {
  const lowered = value.toLowerCase();

  if (matcher.equals?.some((item) => lowered === item.toLowerCase())) {
    return true;
  }

  if (matcher.includes?.some((item) => lowered.includes(item.toLowerCase()))) {
    return true;
  }

  if (matcher.matches?.some((regex) => regex.test(value))) {
    return true;
  }

  if (!matcher.equals && !matcher.includes && !matcher.matches) {
    // when matcher has no constraints, simply checking header existence is enough
    return true;
  }

  return false;
};

const detectByHeaders = (request: Request, matchers: HeaderMatcher[]): boolean => {
  for (const matcher of matchers) {
    const value = request.headers.get(matcher.header);
    if (!value) continue;

    if (hasTextMatch(value, matcher)) {
      return true;
    }
  }

  return false;
};

const shouldConvertContentType = (contentType: string | null, allowed: string[]): boolean => {
  if (!contentType) return false;
  const lowered = contentType.toLowerCase();
  return allowed.some((type) => lowered.includes(type.toLowerCase()));
};

const resolveBaseUrl = (request: Request): string | undefined => {
  try {
    return new URL(request.url).toString();
  } catch {
    return undefined;
  }
};

export const autoMarkdown = (options: AutoMarkdownOptions = {}): MiddlewareHandler => {
  const headerMatchers = options.headerMatchers ?? DEFAULT_HEADER_MATCHERS;
  const allowedContentTypes = options.allowedContentTypes ?? DEFAULT_CONTENT_TYPES;
  const contentTypeForMarkdown = options.responseContentType ?? MARKDOWN_CONTENT_TYPE;

  return async (c, next) => {
    await next();

    const response = c.res;
    if (!response) return;

    if (response.headers.get("content-type")?.includes("text/markdown")) {
      return;
    }

    let shouldConvert = false;

    try {
      if (options.detect) {
        shouldConvert = await options.detect(c.req.raw);
      } else {
        shouldConvert = detectByHeaders(c.req.raw, headerMatchers);
      }
    } catch (error) {
      options.onDetectError?.(error, c.req.raw);
      return;
    }

    if (!shouldConvert) {
      return;
    }

    const responseContentType = response.headers.get("content-type");
    if (!shouldConvertContentType(responseContentType, allowedContentTypes)) {
      return;
    }

    let cloned: Response;
    try {
      cloned = response.clone();
    } catch (error) {
      options.onConvertError?.(error, c.req.raw);
      return;
    }

    let html: string;
    try {
      html = await cloned.text();
    } catch (error) {
      options.onConvertError?.(error, c.req.raw);
      return;
    }

    let markdown: string;
    try {
      markdown = htmlToMarkdown(html, {
        baseUrl: resolveBaseUrl(c.req.raw),
      });
    } catch (error) {
      options.onConvertError?.(error, c.req.raw);
      return;
    }

    const headers = new Headers(response.headers);
    headers.set("content-type", contentTypeForMarkdown);
    headers.set("x-hono-auto-md", "1");
    headers.delete("content-length");

    c.res = new Response(markdown, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
};

export default autoMarkdown;
