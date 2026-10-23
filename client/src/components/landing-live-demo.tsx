import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { SiShopify } from "react-icons/si";
import { DEMO } from "@/lib/landing-copy";

type DemoPhase = "photo" | "facts" | "write" | "publish";

const DEMO_PHASES: { id: DemoPhase; label: string }[] = [
  { id: "photo", label: "Photo" },
  { id: "facts", label: "Facts" },
  { id: "write", label: "Listing copy" },
  { id: "publish", label: "Live" },
];

const DEMO_FACTS = [
  ["Fibre composition", DEMO.fibre],
  ["Care instructions", DEMO.care],
  ["GPSR identity", DEMO.gpsr],
] as const;

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function LandingLiveDemo() {
  const fullLength = DEMO.title.length + DEMO.description.length;
  const reduced = prefersReducedMotion();
  const [phase, setPhase] = useState<DemoPhase>(reduced ? "publish" : "photo");
  const [chars, setChars] = useState(reduced ? fullLength : 0);

  useEffect(() => {
    if (reduced) return;
    let writeTimer: ReturnType<typeof setInterval> | undefined;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      setPhase("photo");
      setChars(0);
      timers.push(setTimeout(() => setPhase("facts"), 2000));
      timers.push(setTimeout(() => {
        setPhase("write");
        writeTimer = setInterval(() => {
          setChars((c) => {
            if (c >= fullLength) {
              clearInterval(writeTimer);
              return c;
            }
            return c + 2;
          });
        }, 35);
      }, 4500));
      timers.push(setTimeout(() => setPhase("publish"), 8500));
      timers.push(setTimeout(() => run(), 11500));
    };
    run();
    return () => {
      timers.forEach(clearTimeout);
      if (writeTimer) clearInterval(writeTimer);
    };
  }, [reduced, fullLength]);

  const titleChars = Math.min(chars, DEMO.title.length);
  const descChars = Math.max(0, chars - DEMO.title.length);
  const writing = phase === "write" || phase === "publish";
  const phaseIndex = DEMO_PHASES.findIndex((p) => p.id === phase);

  return (
    <div className="relative rounded-xl border border-border bg-card p-5 md:p-6 text-left shadow-2xl">
      <ol className="grid grid-cols-4 gap-2 mb-5" aria-label="Demo progress">
        {DEMO_PHASES.map((p, i) => (
          <li key={p.id} className="space-y-1.5">
            <div className={`h-1 rounded-full transition-colors duration-500 ${i <= phaseIndex ? "bg-primary" : "bg-muted"}`} />
            <span className={`block text-[11px] transition-colors ${i === phaseIndex ? "text-foreground" : "text-muted-foreground"}`}>
              {p.label}
            </span>
          </li>
        ))}
      </ol>

      <div className="flex gap-5 items-stretch">
        <div className="relative w-28 h-28 md:w-36 md:h-36 shrink-0 rounded-lg overflow-hidden border border-border">
          <div
            className="absolute inset-0"
            style={{
              background:
                "repeating-linear-gradient(90deg, hsl(0 0% 22%) 0 3px, hsl(0 0% 16%) 3px 6px), radial-gradient(circle at 40% 30%, hsl(30 12% 38%), hsl(0 0% 12%) 70%)",
            }}
          />
          <div className="absolute inset-x-4 top-6 bottom-5 rounded-sm bg-foreground/10" />
          <div className="absolute inset-x-8 top-8 h-10 rounded-b-[40%] bg-background/30" />
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          {phase === "facts" && (
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {DEMO_FACTS.map(([label, value]) => (
                <li key={label} className="flex items-center gap-1.5 motion-safe:animate-in motion-safe:fade-in duration-500">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="text-foreground/80">{label}</span> · {value}
                </li>
              ))}
            </ul>
          )}
          {writing && (
            <>
              <p className="font-semibold text-sm md:text-base leading-snug min-h-[1.4em]">
                {DEMO.title.slice(0, titleChars)}
                {phase === "write" && titleChars < DEMO.title.length && (
                  <span className="inline-block w-px h-3.5 bg-foreground animate-pulse ml-0.5 align-baseline" />
                )}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1.5 min-h-[3em]">
                {DEMO.description.slice(0, descChars)}
                {phase === "write" && titleChars >= DEMO.title.length && descChars < DEMO.description.length && (
                  <span className="inline-block w-px h-3 bg-foreground animate-pulse ml-0.5 align-baseline" />
                )}
              </p>
            </>
          )}
          {phase === "photo" && (
            <div className="space-y-1.5 mt-0.5">
              <div className="h-3.5 w-4/5 rounded bg-muted" />
              <div className="h-2.5 w-full rounded bg-muted" />
              <div className="h-2.5 w-2/3 rounded bg-muted" />
            </div>
          )}

          <div className="mt-auto pt-3 flex items-center gap-2">
            <SiShopify className="w-4 h-4 md:w-5 md:h-5" style={{ color: "#96BF48" }} />
            {phase === "publish" && (
              <span className="text-xs text-foreground motion-safe:animate-in motion-safe:fade-in duration-500">
                live on Shopify
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
