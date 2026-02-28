import { lazy, ComponentType } from "react";

/**
 * Wraps React.lazy with retry logic for stale chunk errors.
 * On failure, reloads the page once to fetch updated assets.
 */
export function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((error) => {
      const isChunkError =
        error?.message?.includes("Failed to fetch dynamically imported module") ||
        error?.message?.includes("Loading chunk") ||
        error?.name === "ChunkLoadError";

      if (isChunkError) {
        const reloadedAt = sessionStorage.getItem("chunk-reloaded");
        const now = Date.now();

        // Only reload if we haven't reloaded in the last 10 seconds
        if (!reloadedAt || now - Number(reloadedAt) > 10_000) {
          sessionStorage.setItem("chunk-reloaded", String(now));
          window.location.reload();
          // Return a never-resolving promise so React stays in Suspense
          // until the page actually reloads
          return new Promise<{ default: T }>(() => {});
        }
      }

      throw error;
    })
  );
}
