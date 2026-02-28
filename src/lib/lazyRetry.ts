import { lazy, ComponentType } from "react";

/**
 * Wraps React.lazy with retry logic for stale chunk errors.
 * On failure, clears the module cache flag and reloads the page once.
 */
export function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 1
): React.LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((error) => {
      // Only retry on chunk load failures
      const isChunkError =
        error?.message?.includes("Failed to fetch dynamically imported module") ||
        error?.message?.includes("Loading chunk") ||
        error?.name === "ChunkLoadError";

      if (isChunkError && retries > 0) {
        // Check if we already reloaded to avoid infinite loops
        const key = "chunk-reload-" + Date.now().toString().slice(0, -4); // ~10s window
        const alreadyReloaded = sessionStorage.getItem("chunk-reloaded");
        if (!alreadyReloaded) {
          sessionStorage.setItem("chunk-reloaded", "true");
          window.location.reload();
        }
      }
      throw error;
    })
  );
}
