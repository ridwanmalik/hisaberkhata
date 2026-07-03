import { createSerwistRoute } from "@serwist/turbopack";

// New revision every build so precached app-shell pages get refreshed.
const revision = crypto.randomUUID();

// Precache the app shell so every screen works offline from the first visit.
const APP_SHELL = ["/", "/history", "/withdrawal", "/budget", "/accounts", "/~offline"];

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    additionalPrecacheEntries: APP_SHELL.map((url) => ({ url, revision })),
    swSrc: "app/sw.ts",
    useNativeEsbuild: true,
  });
