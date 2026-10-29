import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

import { useShopifyStatus } from "@/hooks/use-images";
import { appendStagedDrafts, groupStagedDrafts } from "@/hooks/use-staged-images";
import {
  applyGroupedDraftPhotos,
  chatBody,
  choosePhotos,
  UNDO_MS,
  copyUndoControls,
  copyUndoWrite,
  factsUndoControls,
  factsUndoWrite,
  gpsrUndoControls,
  gpsrUndoWrite,
  holdCopyUndos,
  holdFactsUndos,
  holdGpsrUndos,
  holdInventoryUndos,
  holdPublicationsUndos,
  holdSellingUndos,
  importRunning,
  intakeSentences,
  inventoryUndoControls,
  inventoryUndoWrite,
  landCopyUndo,
  landFactsUndo,
  landGpsrUndo,
  landInventoryUndo,
  landPublicationsUndo,
  landSellingUndo,
  rollbackPhotoIntake,
  publicationsUndoControls,
  publicationsUndoWrite,
  sellingUndoControls,
  sellingUndoWrite,
  type CopyUndo,
  type FactsUndo,
  type GpsrUndo,
  type HeldCopyUndo,
  type HeldFactsUndo,
  type HeldGpsrUndo,
  type HeldInventoryUndo,
  type HeldPublicationsUndo,
  type HeldSellingUndo,
  type InventoryUndo,
  type PublicationsUndo,
  type SellingUndo,
} from "@/lib/chat-page";
import { api, buildUrl } from "@/lib/api-routes";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type ChatTurn = { role: "seller" | "chat"; text: string };
type ChatThread = {
  thread: ChatTurn[];
  groupedPhotoIds?: string[];
  inventoryUndos?: InventoryUndo[];
  sellingUndos?: SellingUndo[];
  copyUndos?: CopyUndo[];
  factsUndos?: FactsUndo[];
  publicationUndos?: PublicationsUndo[];
  gpsrUndos?: GpsrUndo[];
};

const PHOTO_ACCEPT = "image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff,.heic,.heif,.avif";

function ignoreFileDrop(event: DragEvent) {
  event.preventDefault();
}

/**
 * Chat along the bottom of the signed-in content area.
 * It overlays the Destination. It is not mounted on the Landing page.
 */

export function ChatCard() {
  const [draft, setDraft] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const [undos, setUndos] = useState<HeldInventoryUndo[]>([]);
  const [selling, setSelling] = useState<HeldSellingUndo[]>([]);
  const [copies, setCopies] = useState<HeldCopyUndo[]>([]);
  const [facts, setFacts] = useState<HeldFactsUndo[]>([]);
  const [publications, setPublications] = useState<HeldPublicationsUndo[]>([]);
  const [gpsr, setGpsr] = useState<HeldGpsrUndo[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const controls = inventoryUndoControls(undos, now);
  const sellingControls = sellingUndoControls(selling, now);
  const copyControls = copyUndoControls(copies, now);
  const factsControls = factsUndoControls(facts, now);
  const publicationControls = publicationsUndoControls(publications, now);
  const gpsrControls = gpsrUndoControls(gpsr, now);
  const undosRef = useRef(undos);
  undosRef.current = undos;
  const sellingRef = useRef(selling);
  sellingRef.current = selling;
  const copiesRef = useRef(copies);
  copiesRef.current = copies;
  const factsRef = useRef(facts);
  factsRef.current = facts;
  const publicationsRef = useRef(publications);
  publicationsRef.current = publications;
  const gpsrRef = useRef(gpsr);
  gpsrRef.current = gpsr;
  const queryClient = useQueryClient();
  const scroller = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const shopify = useShopifyStatus();
  const shopDomain = shopify.data?.shopDomain ?? "";
  const [pathname] = useLocation();
  const page = useRef(pathname);
  page.current = pathname;
  const thread = useQuery<ChatThread>({
    queryKey: ["/api/chat", shopDomain],
    refetchInterval: (query) => (importRunning(query.state.data?.thread ?? []) ? 2000 : false),
  });
  const turns = thread.data?.thread ?? [];
  const running = importRunning(turns);
  const wasRunning = useRef(false);

  useEffect(() => {
    if (wasRunning.current && !running) {
      void queryClient.invalidateQueries({ queryKey: ["/api/images"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/images/group"] });
    }
    wasRunning.current = running;
  }, [running, queryClient]);

  const send = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", "/api/chat", chatBody(message, page.current));
      return (await response.json()) as ChatThread;
    },
    onSuccess: (data) => {
      const grouped = data.groupedPhotoIds ?? [];
      if (grouped.length >= 2 && !applyGroupedDraftPhotos(grouped)) {
        void groupStagedDrafts(grouped);
      }
      const {
        inventoryUndos: incoming,
        sellingUndos: incomingSelling,
        copyUndos: incomingCopy,
        factsUndos: incomingFacts,
        publicationUndos: incomingPublications,
        gpsrUndos: incomingGpsr,
        ...stored
      } = data;
      queryClient.setQueryData(["/api/chat", shopDomain], stored);
      const shownAt = Date.now();
      if (incoming && incoming.length > 0) {
        setUndos((current) => holdInventoryUndos(current, incoming, shownAt));
        setNow(shownAt);
      }
      if (incomingSelling && incomingSelling.length > 0) {
        setSelling((current) => holdSellingUndos(current, incomingSelling, shownAt));
        setNow(shownAt);
      }
      if (incomingCopy && incomingCopy.length > 0) {
        setCopies((current) => holdCopyUndos(current, incomingCopy, shownAt));
        setNow(shownAt);
      }
      if (incomingFacts && incomingFacts.length > 0) {
        setFacts((current) => holdFactsUndos(current, incomingFacts, shownAt));
        setNow(shownAt);
      }
      if (incomingPublications && incomingPublications.length > 0) {
        setPublications((current) => holdPublicationsUndos(current, incomingPublications, shownAt));
        setNow(shownAt);
      }
      if (incomingGpsr && incomingGpsr.length > 0) {
        setGpsr((current) => holdGpsrUndos(current, incomingGpsr, shownAt));
        setNow(shownAt);
      }
      // The open product page reads the catalogue. Refreshing it does not change Destination.
      void queryClient.invalidateQueries({ queryKey: ["/api/images"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/images/group"] });
      setDraft("");
    },
  });

  useEffect(() => {
    const waiting = [
      ...undos.filter((undo) => now - undo.shownAt < UNDO_MS),
      ...selling.filter((undo) => now - undo.shownAt < UNDO_MS),
      ...copies.filter((undo) => now - undo.shownAt < UNDO_MS),
      ...facts.filter((undo) => now - undo.shownAt < UNDO_MS),
      ...publications.filter((undo) => now - undo.shownAt < UNDO_MS),
      ...gpsr.filter((undo) => now - undo.shownAt < UNDO_MS),
    ];
    if (waiting.length === 0) return;
    const due = Math.min(...waiting.map((undo) => undo.shownAt + UNDO_MS));
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, due - Date.now()));
    return () => window.clearTimeout(timer);
  }, [undos, selling, copies, facts, publications, gpsr, now]);

  const undoInventory = async (replyIndex: number) => {
    const write = inventoryUndoWrite(undosRef.current, replyIndex, Date.now());
    if (!write) return;
    try {
      await apiRequest("POST", `/api/inventory/items/${write.itemId}/adjustments`, {
        mode: write.mode,
        quantity: write.quantity,
        reason: write.reason,
      });
    } catch {
      return;
    }
    setUndos((current) => landInventoryUndo(current, replyIndex));
    void queryClient.invalidateQueries({ queryKey: ["/api/inventory/overview"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
  };

  const rewindSelling = async (replyIndex: number) => {
    const write = sellingUndoWrite(sellingRef.current, replyIndex, Date.now());
    if (!write) return;
    try {
      await apiRequest(
        "PUT",
        buildUrl(api.images.update.path, { id: write.productId }),
        write.body,
      );
    } catch {
      return;
    }
    setSelling((current) => landSellingUndo(current, replyIndex));
    void queryClient.invalidateQueries({ queryKey: ["/api/images"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/images/group"] });
  };

  const undoCopy = async (replyIndex: number) => {
    const write = copyUndoWrite(copiesRef.current, replyIndex, Date.now());
    if (!write) return;
    try {
      await apiRequest(
        "PUT",
        buildUrl(api.images.update.path, { id: write.productId }),
        write.body,
      );
    } catch {
      return;
    }
    setCopies((current) => landCopyUndo(current, replyIndex));
    void queryClient.invalidateQueries({ queryKey: ["/api/images"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/images/group"] });
  };

  const undoFacts = async (replyIndex: number) => {
    const write = factsUndoWrite(factsRef.current, replyIndex, Date.now());
    if (!write) return;
    try {
      await apiRequest(
        "POST",
        buildUrl(api.images.confirmProductFacts.path, { id: write.productId }),
        write.body,
      );
    } catch {
      return;
    }
    setFacts((current) => landFactsUndo(current, replyIndex));
    void queryClient.invalidateQueries({ queryKey: ["/api/images"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/images/group"] });
  };

  const undoPublications = async (replyIndex: number) => {
    const write = publicationsUndoWrite(publicationsRef.current, replyIndex, Date.now());
    if (!write) return;
    try {
      await apiRequest(
        "PUT",
        buildUrl(api.images.update.path, { id: write.productId }),
        write.body,
      );
    } catch {
      return;
    }
    setPublications((current) => landPublicationsUndo(current, replyIndex));
    void queryClient.invalidateQueries({ queryKey: ["/api/images"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/images/group"] });
  };

  const undoGpsr = async (replyIndex: number) => {
    const write = gpsrUndoWrite(gpsrRef.current, replyIndex, Date.now());
    if (!write) return;
    try {
      await apiRequest("PUT", api.shopify.gpsrIdentity.path, write.body);
    } catch {
      return;
    }
    setGpsr((current) => landGpsrUndo(current, replyIndex));
    void queryClient.invalidateQueries({ queryKey: [api.shopify.status.path] });
    void queryClient.invalidateQueries({ queryKey: ["/api/images"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/images/group"] });
  };

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [turns.length, lines.length]);

  const onPhotos = (list: FileList | null) => {
    const choice = choosePhotos(list && list.length > 0 ? Array.from(list) : null);
    setLines([...intakeSentences()]);
    if (choice.handedOff || choice.photos.length === 0) return;
    void appendStagedDrafts(choice.photos).then((added) => {
      if (added === choice.photos.length) return;
      rollbackPhotoIntake(choice.photos.length, choice.epoch);
      setLines([...intakeSentences()]);
    });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || send.isPending) return;
    send.mutate(message);
  };

  return (
    <section
      aria-label="Chat"
      onDragOver={ignoreFileDrop}
      onDrop={ignoreFileDrop}
      className="absolute bottom-4 left-1/2 z-40 flex h-[min(24rem,calc(100%-1rem))] w-[min(40rem,calc(100%-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-[1rem] border border-primary/40 bg-card text-card-foreground opacity-60 shadow-[0_20px_48px_-16px_hsl(43_74%_52%/0.45)] motion-safe:transition-opacity motion-safe:duration-200 hover:opacity-100 focus-within:opacity-100"
    >
      <header className="flex shrink-0 items-center border-b border-primary/25 px-3 py-2">
        <h2 className="font-display text-sm font-semibold text-primary">Chat</h2>
      </header>
      <div
        ref={scroller}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3"
        aria-live="polite"
      >
        {turns.map((turn, index) => {
          const undo = controls.find((control) => control.replyIndex === index);
          const sellingRewind = sellingControls.find((control) => control.replyIndex === index);
          const copyRewind = copyControls.find((control) => control.replyIndex === index);
          const factsRewind = factsControls.find((control) => control.replyIndex === index);
          const publicationRewind = publicationControls.find((control) => control.replyIndex === index);
          const gpsrRewind = gpsrControls.find((control) => control.replyIndex === index);
          return (
            <div
              key={`${index}-${turn.text}`}
              className={cn("max-w-[85%]", turn.role === "seller" ? "ml-auto" : "mr-auto")}
            >
              <p
                className={cn(
                  "whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed",
                  turn.role === "seller"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground",
                )}
              >
                {turn.text}
              </p>
              {undo && (
                <button
                  type="button"
                  className="mt-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => void undoInventory(index)}
                >
                  Undo
                </button>
              )}
              {sellingRewind && (
                <button
                  type="button"
                  className="mt-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => void rewindSelling(index)}
                >
                  Undo
                </button>
              )}
              {copyRewind && (
                <button
                  type="button"
                  className="mt-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => void undoCopy(index)}
                >
                  Undo
                </button>
              )}
              {factsRewind && (
                <button
                  type="button"
                  className="mt-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => void undoFacts(index)}
                >
                  Undo
                </button>
              )}
              {publicationRewind && (
                <button
                  type="button"
                  className="mt-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => void undoPublications(index)}
                >
                  Undo
                </button>
              )}
              {gpsrRewind && (
                <button
                  type="button"
                  className="mt-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => void undoGpsr(index)}
                >
                  Undo
                </button>
              )}
            </div>
          );
        })}
        {thread.isError && (
          <p className="text-sm text-destructive">Chat is not available right now.</p>
        )}
        {send.isError && (
          <p className="text-sm text-destructive">That message didn't send.</p>
        )}
        {lines.map((line, index) => (
          <p
            key={`${index}-${line}`}
            className="mr-auto max-w-[85%] rounded-lg bg-secondary px-3 py-2 text-sm leading-relaxed text-foreground"
          >
            {line}
          </p>
        ))}
      </div>
      <form onSubmit={onSubmit} className="flex shrink-0 gap-2 border-t border-primary/25 p-2">
        <input
          ref={picker}
          type="file"
          accept={PHOTO_ACCEPT}
          multiple
          className="hidden"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            onPhotos(event.target.files);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          className="self-end shrink-0 rounded-lg px-2 py-2 text-xs font-medium text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => picker.current?.click()}
        >
          Choose photos
        </button>
        <label className="sr-only" htmlFor="chat-message">
          Message
        </label>
        <textarea
          id="chat-message"
          rows={2}
          value={draft}
          placeholder="Ask for an act"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          className="min-h-10 flex-1 resize-none rounded-lg border border-primary/30 bg-background/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          disabled={send.isPending || draft.trim() === ""}
          className="self-end rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Send
        </button>
      </form>
    </section>
  );
}
