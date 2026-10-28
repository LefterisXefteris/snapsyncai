import { MutableRefObject, useEffect, useRef, useState } from "react";

import { useToast } from "@/hooks/use-toast";
import { appendStagedDrafts, MAX_STAGED_PHOTOS } from "@/hooks/use-staged-images";
import {
  registerGroupedDrafts,
  registerPhotoIntake,
  rememberNewListingDrafts,
  rememberNewListingSelection,
} from "@/lib/chat-page";
import { extractAsDraft, packMultiPhotoFirst } from "@/lib/draft-products";

type CanvasGroup = { id: string; items: { id: string }[] };

/** Restores this browser's New listing canvas, then keeps Chat's photo intake on it. */
export function useChatPhotoIntake<T extends CanvasGroup>(
  groups: readonly T[],
  setGroups: (groups: T[]) => void,
  selectedIds: ReadonlySet<string>,
  onDrop: (files: File[]) => void,
  loadStaged: () => Promise<{ groups: T[]; urlsCreated: string[] }>,
  urlsRef: MutableRefObject<string[]>,
  saveGroups: (groups: T[]) => void | Promise<void>,
  clearSelection: () => void,
): void {
  const { toast } = useToast();
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const saveGroupsRef = useRef(saveGroups);
  saveGroupsRef.current = saveGroups;
  const clearRef = useRef(clearSelection);
  clearRef.current = clearSelection;
  const readyRef = useRef(false);
  const queued = useRef<File[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const first = await loadStaged();
      const batch = queued.current.splice(0);
      if (batch.length) {
        first.urlsCreated.forEach((url) => URL.revokeObjectURL(url));
        await appendStagedDrafts(batch);
      }
      if (cancel) return;
      const restored = batch.length ? await loadStaged() : first;
      if (cancel) return;
      if (restored.groups.length > 0) {
        restored.urlsCreated.forEach((url) => urlsRef.current.push(url));
        setGroups(packMultiPhotoFirst(restored.groups));
      }
      readyRef.current = true;
      setReady(true);
    })();
    return () => {
      cancel = true;
    };
    // loadStaged is a fresh function each render. Restore once, like the canvas did before.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    rememberNewListingDrafts(groups.map((group) => ({
      id: group.id,
      items: group.items.map((item) => ({ id: item.id })),
    })));
  }, [ready, groups]);

  useEffect(() => {
    rememberNewListingSelection(Array.from(selectedIds));
    return () => rememberNewListingSelection([]);
  }, [selectedIds]);

  useEffect(() => {
    return registerGroupedDrafts((ids) => {
      const prev = Array.from(groupsRef.current);
      const grouped = extractAsDraft(prev, ids, crypto.randomUUID());
      if (grouped === prev) return false;
      const next = grouped.map((draft) => {
        const existing = prev.find((group) => group.id === draft.id);
        if (existing) return { ...existing, items: draft.items as T["items"] };
        return { ...prev[0], id: draft.id, items: draft.items as T["items"] };
      });
      setGroups(next);
      void saveGroupsRef.current(next);
      clearRef.current();
      return true;
    });
  }, [setGroups]);

  useEffect(() => {
    return registerPhotoIntake((files) => {
      const photos = files as File[];
      if (!readyRef.current) {
        queued.current.push(...photos);
        return true;
      }
      const count = groupsRef.current.reduce((sum, group) => sum + group.items.length, 0);
      if (count + photos.length > MAX_STAGED_PHOTOS) {
        toast({
          title: "Too many images",
          description: "Max 200 photos.",
          variant: "destructive",
        });
        return false;
      }
      onDropRef.current(photos);
      return true;
    });
  }, [toast]);
}
