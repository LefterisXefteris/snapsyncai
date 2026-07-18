import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

export type AmbientState = "idle" | "thinking" | "success";

interface AmbientContextValue {
  state: AmbientState;
  /** Call when an AI/publish operation starts. Safe to nest — uses a counter. */
  beginThinking: () => void;
  /** Call when an operation finishes. Pass true to trigger the success bloom. */
  endThinking: (success?: boolean) => void;
}

const AmbientContext = createContext<AmbientContextValue>({
  state: "idle",
  beginThinking: () => {},
  endThinking: () => {},
});

const SUCCESS_DECAY_MS = 2600;

export function AmbientProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AmbientState>("idle");
  const activeOps = useRef(0);
  const decayTimer = useRef<ReturnType<typeof setTimeout>>();

  const beginThinking = useCallback(() => {
    activeOps.current += 1;
    clearTimeout(decayTimer.current);
    setState("thinking");
  }, []);

  const endThinking = useCallback((success = false) => {
    activeOps.current = Math.max(0, activeOps.current - 1);
    if (activeOps.current > 0) return;
    if (success) {
      setState("success");
      clearTimeout(decayTimer.current);
      decayTimer.current = setTimeout(() => setState("idle"), SUCCESS_DECAY_MS);
    } else {
      setState("idle");
    }
  }, []);

  return (
    <AmbientContext.Provider value={{ state, beginThinking, endThinking }}>
      {children}
    </AmbientContext.Provider>
  );
}

export function useAmbient() {
  return useContext(AmbientContext);
}
