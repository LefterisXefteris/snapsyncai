import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

import { useShopifyStatus } from "@/hooks/use-images";
import { appendStagedDrafts, groupStagedDrafts } from "@/hooks/use-staged-images";
import {
  applyGroupedDraftPhotos,
  chatBody,
  choosePhotos,
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
 * Chat along the bottom of the signed-in content area.
 * It overlays the Destination. It is not mounted on the Landing page.
 */

export function ChatCard() {
  const [draft, setDraft] = useState("");
  const [lines, setLines] = useState<string[]>([]);
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
      queryClient.setQueryData(["/api/chat", shopDomain], data);
      // The open product page reads the catalogue. Refreshing it does not change Destination.
      void queryClient.invalidateQueries({ queryKey: ["/api/images"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/images/group"] });
      setDraft("");
    },
  });

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
        {turns.map((turn, index) => (
          <p
            key={`${index}-${turn.text}`}
            className={cn(
              "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed",
              turn.role === "seller"
                ? "ml-auto bg-primary text-primary-foreground"
                : "mr-auto bg-secondary text-foreground",
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
