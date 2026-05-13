"use client";

import { useEffect, useState } from "react";

/**
 * Returns whether the given CSS media query currently matches.
 * Defaults to false during SSR and on the very first client render to
 * avoid hydration mismatches; updates to the real value in useEffect.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);

  return matches;
}
