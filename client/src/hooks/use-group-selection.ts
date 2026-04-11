import { useCallback, useRef, useState } from "react";

/**
 * Bulk selection hook for thumbnail grids with macOS Finder-style modifiers.
 *
 * - Plain click         → select only this id, set as range anchor
 * - Shift-click         → range-select from anchor to id in visual (flat) order
 * - Cmd/Meta/Ctrl-click → toggle this id in/out of the selection, move anchor
 *
 * `itemIdsInOrder` must be a flat list of every thumbnail id in visual DOM
 * order (flatMap over groups); range selection spans group boundaries.
 *
 * Esc / Cmd+A listeners are intentionally NOT wired here — the caller owns
 * the keyboard effect so the hook stays pure and easy to test.
 */
export function useGroupSelection(itemIdsInOrder: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const anchorRef = useRef<string | null>(null);

  const handleClick = useCallback(
    (id: string, e: React.MouseEvent | MouseEvent) => {
      const order = itemIdsInOrder;

      if (e.shiftKey && anchorRef.current) {
        const a = order.indexOf(anchorRef.current);
        const b = order.indexOf(id);
        if (a < 0 || b < 0) return;
        const [lo, hi] = a < b ? [a, b] : [b, a];
        setSelected(new Set(order.slice(lo, hi + 1)));
        return;
      }

      if (e.metaKey || e.ctrlKey) {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          return next;
        });
        anchorRef.current = id;
        return;
      }

      setSelected(new Set([id]));
      anchorRef.current = id;
    },
    [itemIdsInOrder],
  );

  const clear = useCallback(() => {
    setSelected(new Set());
    anchorRef.current = null;
  }, []);

  return { selected, handleClick, clear, setSelected };
}
