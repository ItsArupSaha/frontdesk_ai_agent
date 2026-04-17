import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
  vx?: number;
  vy?: number;
};

type ParticleFieldProps = {
  className?: string;
  mode?: "inward" | "ambient";
  count?: number;
};

const PARTICLE_COUNT = 180;
const AMBIENT_PARTICLE_COUNT = 110;
const AMBIENT_TARGET_FPS = 30;

/**
 * Subtle white particles that drift slowly inward toward the centre.
 * They reset from the edges when they get close enough to centre,
 * creating a continuous soft inward-flow effect matching the screenshot.
 */
export function ParticleField({ className, mode = "inward", count }: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let W = 0;
    let H = 0;
    let cx = 0;
    let cy = 0;
    let lastFrameTime = 0;
    let isVisible = true;
    const particles: Particle[] = [];
    const isAmbient = mode === "ambient";

    const spawnEdge = (): Particle => {
      const edge = Math.floor(Math.random() * 4);
      let x = 0;
      let y = 0;
      if (edge === 0) { x = Math.random() * W; y = -8; }
      else if (edge === 1) { x = W + 8; y = Math.random() * H; }
      else if (edge === 2) { x = Math.random() * W; y = H + 8; }
      else { x = -8; y = Math.random() * H; }
      return {
        x,
        y,
        size: Math.random() > 0.8 ? 1.5 : 1,
        speed: 0.12 + Math.random() * 0.28,
        alpha: 0.12 + Math.random() * 0.30,
      };
    };

    const spawnAmbient = (): Particle => ({
      x: Math.random() * W,
      y: Math.random() * H,
      size: Math.random() > 0.82 ? 1.6 : 0.9 + Math.random() * 0.35,
      speed: 0.1 + Math.random() * 0.22,
      alpha: 0.22 + Math.random() * 0.24,
      vx: (Math.random() - 0.5) * 0.65,
      vy: (Math.random() - 0.5) * 0.65,
    });

    const spawnRandom = (): Particle => ({
      x: Math.random() * W,
      y: Math.random() * H,
      size: Math.random() > 0.8 ? 1.5 : 1,
      speed: 0.12 + Math.random() * 0.28,
      alpha: 0.12 + Math.random() * 0.30,
    });

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const bounds = parent.getBoundingClientRect();
      const dpr = isAmbient ? 1 : (window.devicePixelRatio || 1);
      W = Math.floor(bounds.width);
      H = Math.floor(bounds.height);
      cx = W * 0.5;
      cy = H * 0.5;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (particles.length === 0) {
        const particleCount = isAmbient ? (count ?? AMBIENT_PARTICLE_COUNT) : PARTICLE_COUNT;
        for (let i = 0; i < particleCount; i++) {
          particles.push(isAmbient ? spawnAmbient() : spawnRandom());
        }
      }
    };

    const render = (time: number) => {
      if (isAmbient && !isVisible) {
        raf = 0;
        return;
      }

      if (isAmbient) {
        const frameInterval = 1000 / AMBIENT_TARGET_FPS;
        if (time - lastFrameTime < frameInterval) {
          raf = requestAnimationFrame(render);
          return;
        }
        lastFrameTime = time;
      }

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#ffffff";

      for (const p of particles) {
        if (isAmbient) {
          p.vx = (p.vx ?? 0) + (Math.random() - 0.5) * 0.018;
          p.vy = (p.vy ?? 0) + (Math.random() - 0.5) * 0.018;
          p.vx = Math.max(-0.65, Math.min(0.65, p.vx));
          p.vy = Math.max(-0.65, Math.min(0.65, p.vy));
          p.x += p.vx + ((Math.random() - 0.5) * p.speed);
          p.y += p.vy + ((Math.random() - 0.5) * p.speed);

          if (p.x < -12) p.x = W + 12;
          else if (p.x > W + 12) p.x = -12;
          if (p.y < -12) p.y = H + 12;
          else if (p.y > H + 12) p.y = -12;

          ctx.globalAlpha = p.alpha;
        } else {
          const dx = cx - p.x;
          const dy = cy - p.y;
          const dist = Math.hypot(dx, dy) || 1;

          // Gentle inward drift
          const pull = p.speed * (0.5 + (1 - Math.min(dist / (Math.max(W, H) * 0.5), 1)) * 0.8);
          p.x += (dx / dist) * pull;
          p.y += (dy / dist) * pull;

          // Fade near centre
          const fadeFactor = Math.min(dist / (Math.max(W, H) * 0.38), 1);
          ctx.globalAlpha = p.alpha * Math.max(fadeFactor, 0.05);

          // Reset when within 30px of centre
          if (dist < 30) {
            const np = spawnEdge();
            p.x = np.x;
            p.y = np.y;
            p.size = np.size;
            p.speed = np.speed;
            p.alpha = np.alpha;
          }
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(render);
    };

    const intersectionObserver = isAmbient
      ? new IntersectionObserver(
          ([entry]) => {
            isVisible = entry?.isIntersecting ?? false;
            if (isVisible && !raf) {
              lastFrameTime = 0;
              raf = requestAnimationFrame(render);
            }
          },
          { threshold: 0.01 },
        )
      : null;

    resize();
    intersectionObserver?.observe(canvas);
    raf = requestAnimationFrame(render);
    window.addEventListener("resize", resize);

    return () => {
      intersectionObserver?.disconnect();
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, [count, mode]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
