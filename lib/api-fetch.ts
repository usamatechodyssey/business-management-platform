// lib/api-fetch.ts
//
// Global fetch interceptor for authenticated API calls. Patches
// `window.fetch` once so any 401 from /api/* triggers a redirect to
// the appropriate login page. This mirrors the Axios interceptor
// pattern — installed at module import time, active for the whole app.
//
// Why patch the global: we have ~30 client components calling fetch.
// Threading a custom wrapper through every one is mechanical noise;
// a single interceptor gives the same behaviour with one install point.
//
// Safety:
//   • Only runs in the browser (SSR skips via typeof check).
//   • Idempotent — a global flag prevents double-patching across HMR
//     reloads and repeated imports.
//   • Login pages are excluded so their own 401 handling (inline
//     "invalid credentials") is preserved.
//   • Only /api/* routes are inspected — everything else passes
//     through untouched.

declare global {
  interface Window {
    __bmFetchPatched?: boolean;
  }
}

export function installApiFetchInterceptor(): void {
  if (typeof window === "undefined") return;
  if (window.__bmFetchPatched) return;
  window.__bmFetchPatched = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const response = await originalFetch(input, init);

    if (response.status !== 401) return response;

    // Determine the URL the caller requested so we can decide between
    // business login and admin login.
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    // Only handle our own API routes. Anything else (Next.js internals,
    // third-party calls) passes through.
    if (!url.startsWith("/api/")) return response;

    // Don't redirect when the user is already on a login page — the
    // form is expected to render the 401 inline.
    const currentPath = window.location.pathname;
    if (
      currentPath === "/login" ||
      currentPath === "/register" ||
      currentPath === "/admin/login"
    ) {
      return response;
    }

    const target = url.startsWith("/api/admin/")
      ? "/admin/login"
      : "/login";

    // Hard redirect — client-side router would just re-render the
    // same protected page and hit 401 again. Full navigation clears
    // in-memory state and lets proxy.ts re-evaluate cleanly.
    window.location.href = target;

    return response;
  };
}