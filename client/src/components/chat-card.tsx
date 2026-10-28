import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

import { useShopifyStatus } from "@/hooks/use-images";
import { appendStagedDrafts, groupStagedDrafts } from "@/hooks/use-staged-images";
import {
  applyGroupedDraftPhotos,
  chatBody,
  choosePhotos,
  closeChatCard,
  importRunning,
  intakeSentences,
  rollbackPhotoIntake,
} from "@/lib/chat-page";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type ChatTurn = { role: "seller" | "chat"; text: string };
type ChatThread = { thread: ChatTurn[]; groupedPhotoIds?: string[] };

const PHOTO_ACCEPT = "image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff,.heic,.heif,.avif";

function ignoreFileDrop(event: DragEvent) {
  event.preventDefault();
}

/**
 * The card along the bottom of the signed-in workspace.
 * Opening it does not change Destination. It is not mounted on the Landing page.
 */

export function ChatCard() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
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
      queryClient.setQueryData(["/api/chat", shopDomain], data);
      // The open product page reads the catalogue. Refreshing it does not change Destination.
      void queryClient.invalidateQueries({ queryKey: ["/api/images"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/images/group"] });
      setDraft("");
    },
  });

  useEffect(() => {
    if (!open) return;
    field.current?.focus();
  }, [open]);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [turns.length, lines.length, open]);

  const close = () => {
    closeChatCard();
    setLines([]);
    setOpen(false);
  };

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
    <div className="pointer-events-none fixed bottom-4 right-4 z-40">
      <div className="flex w-[min(24rem,calc(100vw-2rem))] flex-col items-end">
        {open ? (
          <section
            aria-label="Chat"
            onDragOver={ignoreFileDrop}
            onDrop={ignoreFileDrop}
            className="pointer-events-auto flex max-h-[min(32rem,70vh)] w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
          >
            <header className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
              <h2 className="font-display text-sm font-semibold">Chat</h2>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={close}
              >
                Close
              </button>
            </header>
            <div
              ref={scroller}
              className="min-h-32 flex-1 space-y-3 overflow-y-auto px-3 py-3"
              aria-live="polite"
            >
              {turns.map((turn, index) => (
                <p
                  key={`${index}-${turn.text}`}
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap text-sm leading-relaxed",
                    turn.role === "seller"
                      ? "ml-auto rounded-lg bg-secondary px-3 py-2"
                      : "mr-auto text-foreground",
                  )}
                >
                  {turn.text}
                </p>
              ))}
              {thread.isError && (
                <p className="text-sm text-destructive">Chat is not available right now.</p>
              )}
              {send.isError && (
                <p className="text-sm text-destructive">That message didn't send.</p>
              )}
              {lines.map((line, index) => (
                <p key={`${index}-${line}`} className="mr-auto text-sm leading-relaxed text-foreground">
                  {line}
                </p>
              ))}
            </div>
            <form onSubmit={onSubmit} className="flex shrink-0 gap-2 border-t border-border p-2">
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
                className="self-end shrink-0 rounded-lg px-2 py-2 text-xs font-medium text-foreground hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => picker.current?.click()}
              >
                Choose photos
              </button>
              <label className="sr-only" htmlFor="chat-message">
                Message
              </label>
              <textarea
                ref={field}
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
                className="min-h-10 flex-1 resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="submit"
                disabled={send.isPending || draft.trim() === ""}
                className="self-end rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {send.isPending ? "Sending" : "Send"}
              </button>
            </form>
          </section>
        ) : (
          <button
            type="button"
            className="pointer-events-auto rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground shadow-lg hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onDragOver={ignoreFileDrop}
            onDrop={ignoreFileDrop}
            onClick={() => setOpen(true)}
          >
            Chat
          </button>
        )}
      </div>
    </div>
  );
}
