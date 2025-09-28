export const resolveBaseUrl = (maybeUrl: string): string | undefined => {
  try {
    return new URL(maybeUrl).toString();
  } catch {
    return undefined;
  }
};
