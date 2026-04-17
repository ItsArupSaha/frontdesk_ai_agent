import { cn } from "../lib/cn";
import { ParticleField } from "./ParticleField";

type SectionParticleLayerProps = {
  className?: string;
  glowClassName?: string;
  count?: number;
};

export function SectionParticleLayer({
  className,
  glowClassName,
  count = 110,
}: SectionParticleLayerProps) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 z-0 overflow-hidden", className)}>
      <div
        className={cn(
          "absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.1),transparent_32%)]",
          glowClassName,
        )}
      />
      <ParticleField mode="ambient" count={count} className="absolute inset-0 opacity-100" />
    </div>
  );
}
