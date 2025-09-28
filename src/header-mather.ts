import type { HonoRequest } from "hono";

export type HeaderMatcher = {
  header: string;
  includes?: string[];
  equals?: string[];
  matches?: RegExp[];
};

export const isMatchHeader = (request: HonoRequest, matchers: HeaderMatcher[]): boolean => {
  for (const matcher of matchers) {
    const lowered = request.header(matcher.header)?.toLowerCase();
    if (!lowered) continue;

    if (matcher.equals?.some((item) => lowered === item.toLowerCase())) {
      return true;
    }

    if (matcher.includes?.some((item) => lowered.includes(item.toLowerCase()))) {
      return true;
    }

    if (matcher.matches?.some((regex) => regex.test(lowered))) {
      return true;
    }
  }
  return false;
};
