import { useEffect, useState } from "react";

// Reactive media-query hook (SSR-safe-ish; defaults to false before mount).
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

// Tailwind `sm` breakpoint (640px) and up.
export function useIsDesktop() {
  return useMediaQuery("(min-width: 640px)");
}
