import { useAmbient, type AmbientState } from "./AmbientProvider";
import { cn } from "@/lib/utils";

/**
 * Fixed full-viewport aurora layer. Three blurred gradient blobs on slow
 * GPU-composited drift. The ambient state shifts their hue and tempo:
 * calm violet when idle, pulsing cyan/lime while AI thinks, a warm lime
 * bloom on success. Sits at -z-10, above the body background but below
 * all content.
 */
export function AuroraBackground() {
  const { state } = useAmbient();

  return (
    <div
      aria-hidden
      className={cn(
        "fixed inset-0 -z-10 overflow-hidden pointer-events-none",
        "opacity-60 dark:opacity-100",
        state === "thinking" && "ambient-thinking",
      )}
    >
      <div
        className="aurora-blob aurora-blob-1 w-[55vw] h-[55vw] -top-[15vw] -left-[12vw]"
        style={{ background: blobGradient(1, state) }}
      />
      <div
        className="aurora-blob aurora-blob-2 w-[45vw] h-[45vw] top-[10vh] -right-[14vw]"
        style={{ background: blobGradient(2, state) }}
      />
      <div
        className="aurora-blob aurora-blob-3 w-[60vw] h-[60vw] -bottom-[25vw] left-[15vw]"
        style={{ background: blobGradient(3, state) }}
      />
    </div>
  );
}

function blobGradient(blob: 1 | 2 | 3, state: AmbientState): string {
  // [aurora var, peak opacity] per blob per state
  const palette: Record<AmbientState, Record<number, [number, number]>> = {
    idle: { 1: [3, 0.16], 2: [2, 0.08], 3: [3, 0.1] },
    thinking: { 1: [2, 0.2], 2: [1, 0.16], 3: [3, 0.14] },
    success: { 1: [1, 0.24], 2: [1, 0.18], 3: [2, 0.12] },
  };
  const [hue, opacity] = palette[state][blob];
  return `radial-gradient(circle at center, hsl(var(--aurora-${hue}) / ${opacity}), transparent 70%)`;
}
