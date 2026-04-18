import { useEffect } from "react";
import Lenis from "lenis";

export function useLenisScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      autoRaf: false,
      smoothWheel: true,
      syncTouch: true,
      lerp: 0.08,
      wheelMultiplier: 1,
      touchMultiplier: 1,
    });

    let raf = 0;

    const onFrame = (time: number) => {
      lenis.raf(time);
      raf = window.requestAnimationFrame(onFrame);
    };

    raf = window.requestAnimationFrame(onFrame);

    return () => {
      window.cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);
}
