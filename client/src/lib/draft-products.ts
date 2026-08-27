export type DraftPhoto = { id: string };

export type DraftProduct<T extends DraftPhoto = DraftPhoto> = {
  id: string;
  items: T[];
};

function takeSelected<T extends DraftPhoto>(
  drafts: DraftProduct<T>[],
  selectedIds: readonly string[],
): { remaining: DraftProduct<T>[]; taken: T[] } {
  const takenIds = new Set(selectedIds);
  const taken: T[] = [];
  const seen = new Set<string>();
  for (const id of selectedIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    for (const d of drafts) {
      const item = d.items.find(i => i.id === id);
      if (item) {
        taken.push(item);
        break;
      }
    }
  }
  const remaining = drafts
    .map(d => ({ ...d, items: d.items.filter(i => !takenIds.has(i.id)) }))
    .filter(d => d.items.length > 0);
  return { remaining, taken };
}

/** Selected photos become a new draft product. Unselected photos stay on their drafts. Empty drafts disappear. */
export function extractAsDraft<T extends DraftPhoto>(
  drafts: DraftProduct<T>[],
  selectedIds: readonly string[],
  newDraftId: string,
): DraftProduct<T>[] {
  if (selectedIds.length < 2) return drafts;
  const { remaining, taken } = takeSelected(drafts, selectedIds);
  if (taken.length < 2) return drafts;
  return [{ id: newDraftId, items: taken }, ...remaining];
}

/** Move selected photos onto an existing draft. That draft keeps its id and remaining photos. Empty drafts disappear. */
export function addToDraft<T extends DraftPhoto>(
  drafts: DraftProduct<T>[],
  selectedIds: readonly string[],
  destId: string,
): DraftProduct<T>[] {
  if (selectedIds.length === 0) return drafts;
  const dest = drafts.find(d => d.id === destId);
  if (!dest) return drafts;
  const alreadyOnDest = new Set(dest.items.map(i => i.id));
  const movingIds = selectedIds.filter(id => !alreadyOnDest.has(id));
  if (movingIds.length === 0) return drafts;
  const { remaining, taken } = takeSelected(drafts, movingIds);
  const destAfter = remaining.find(d => d.id === destId);
  const destItems = destAfter ? destAfter.items : [];
  const withoutDest = remaining.filter(d => d.id !== destId);
  const nextDest: DraftProduct<T> = { id: destId, items: [...destItems, ...taken] };
  const insertAt = drafts.findIndex(d => d.id === destId);
  const before = withoutDest.filter(d => drafts.findIndex(x => x.id === d.id) < insertAt);
  const after = withoutDest.filter(d => drafts.findIndex(x => x.id === d.id) > insertAt);
  return [...before, nextDest, ...after];
}

/** Selection becomes its own draft, including a single photo. Empty drafts disappear. */
export function separateAsDraft<T extends DraftPhoto>(
  drafts: DraftProduct<T>[],
  selectedIds: readonly string[],
  newDraftId: string,
): DraftProduct<T>[] {
  if (selectedIds.length === 0) return drafts;
  const { remaining, taken } = takeSelected(drafts, selectedIds);
  if (taken.length === 0) return drafts;
  return [{ id: newDraftId, items: taken }, ...remaining];
}

export function confirmCount(drafts: DraftProduct[]): number {
  return drafts.length;
}

/** Index 0 is the thumbnail. */
export function setThumbnail<T extends DraftPhoto>(
  drafts: DraftProduct<T>[],
  photoId: string,
): DraftProduct<T>[] {
  return drafts.map(d => {
    const index = d.items.findIndex(i => i.id === photoId);
    if (index <= 0) return d;
    const items = [...d.items];
    const [photo] = items.splice(index, 1);
    return { ...d, items: [photo, ...items] };
  });
}

export function addTargets<T extends DraftPhoto>(
  drafts: DraftProduct<T>[],
  selectedIds: ReadonlySet<string>,
): DraftProduct<T>[] {
  return drafts.filter(d => d.items.some(i => !selectedIds.has(i.id)));
}


