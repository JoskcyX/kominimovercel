import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/** On the server, src/server.ts stores this request's CSP nonce here; the router stamps it on inline scripts. */
const requestNonce = (): string | undefined => {
  if (typeof window !== "undefined") return undefined;
  const store = (globalThis as { __cspNonceStore?: { getStore(): { nonce: string } | undefined } })
    .__cspNonceStore;
  return store?.getStore()?.nonce;
};

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
  });
  const nonce = requestNonce();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    ...(nonce ? { ssr: { nonce } } : {}),
  });

  return router;
};
