const SIGNED_PARAMS = new Set(["sig", "exp", "ba_iat", "ba_param", "ba_pl"]);

export const isOAuthFlow = () => new URLSearchParams(window.location.search).has("sig");

export function resumeAuthorizeUrl(): string {
  const params = new URLSearchParams(window.location.search);

  for (const key of params.keys()) if (SIGNED_PARAMS.has(key)) params.delete(key);

  return `/api/auth/oauth2/authorize?${params}`;
}

export function safeRedirect(target: unknown, fallback: string): string {
  if (typeof target !== "string" || !target.startsWith("/") || target.startsWith("//")) return fallback;

  return target;
}

export function goTo(url: string) {
  if (url.startsWith("/api/")) {
    window.location.replace(url);

    return;
  }

  return navigateTo(url, { replace: true });
}
