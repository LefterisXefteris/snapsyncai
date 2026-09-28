import { useState } from "react";
import { Link } from "wouter";
import { Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useShopifyConnect } from "@/hooks/use-images";
import {
  useConversation,
  useSendConversation,
  type ConversationSilence,
} from "@/hooks/use-conversation";
import { useOverflowConfirm } from "@/hooks/use-overflow-confirm";
import { isOverflowConfirmError, overflowNoticeText } from "@/lib/overflow-copy";

const JOB_LABEL: Record<string, string> = {
  bulk_seo: "Bulk SEO",
  listing_copy_refresh: "listing copy refresh",
  website: "a website prototype",
};

function TurnText({ text }: { text: string }) {
  const match = text.match(/^(.*)(\/product\/\d+)(.*)$/);
  if (!match) return <>{text}</>;
  return (
    <>
      {match[1]}
      <Link href={match[2]} className="underline">
        {match[2]}
      </Link>
      {match[3]}
    </>
  );
}

const EMPTY_SILENCE: ConversationSilence = {
  offers: false,
  bulkSeo: false,
  listingCopyRefresh: false,
  website: false,
};

export default function ConversationPage() {
  const conversation = useConversation();
  const send = useSendConversation();
  const connect = useShopifyConnect();
  const overflow = useOverflowConfirm();
  const [text, setText] = useState("");
  const [look, setLook] = useState("");
  const [shopDomain, setShopDomain] = useState("");
  const [silenceDraft, setSilenceDraft] = useState<ConversationSilence | null>(null);

  const view = conversation.data;
  const silence = silenceDraft ?? view?.silence ?? EMPTY_SILENCE;
  const proposal = view?.proposal ?? null;

  const accept = (productId: number, confirmOverflow = false) => {
    send.mutate(
      { act: { kind: "accept", productId, confirmOverflow } },
      {
        onSuccess: (next) => {
          if (confirmOverflow) return;
          overflow.retryIfConfirmRequired(next.reply, (confirmed) => {
            if (confirmed) accept(productId, true);
          });
        },
      },
    );
  };

  const handoff = (confirmOverflow = false) => {
    const productIds = proposal?.items.map((item) => item.productId) ?? [];
    send.mutate(
      { act: { kind: "handoff", look, productIds, confirmOverflow } },
      {
        onSuccess: (next) => {
          if (next.reply.startsWith("https://")) {
            window.open(next.reply, "_blank", "noopener,noreferrer");
          }
          if (confirmOverflow) return;
          overflow.retryIfConfirmRequired(next.reply, (confirmed) => {
            if (confirmed) handoff(true);
          });
        },
      },
    );
  };

  return (
    <div className="h-full w-full flex flex-col bg-transparent text-foreground overflow-hidden">
      <div className="p-3 bg-background border-b border-border z-10 sticky top-0">
        <h1 className="font-display text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Conversation
        </h1>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {view?.connectPath ? (
          <div className="space-y-2 max-w-md" data-testid="conversation-connect">
            <p className="text-sm">Connect the Shopify shop you already use.</p>
            <Label htmlFor="conversation-shop">Store URL</Label>
            <Input
              id="conversation-shop"
              value={shopDomain}
              placeholder="your-store.myshopify.com"
              onChange={(event) => setShopDomain(event.target.value)}
            />
            <Button
              size="sm"
              disabled={!shopDomain.trim() || connect.isPending}
              onClick={() => connect.mutate({ shopDomain })}
            >
              Authorize in Shopify
            </Button>
          </div>
        ) : null}

        <div className="space-y-3" data-testid="conversation-thread">
          {(view?.thread ?? []).map((turn, index) => (
            <p
              key={`${index}-${turn.role}`}
              className={
                turn.role === "seller"
                  ? "text-sm"
                  : "text-sm text-muted-foreground"
              }
            >
              <TurnText text={turn.text} />
            </p>
          ))}
          {conversation.isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : null}
        </div>

        {isOverflowConfirmError(view?.reply ?? "") ? (
          <p className="text-xs text-muted-foreground" data-testid="text-overflow-notice">
            {overflowNoticeText(overflow.overagePence)}
          </p>
        ) : null}

        {proposal ? (
          <div className="space-y-3 border border-border rounded-md p-3" data-testid="conversation-proposal">
            <p className="text-sm font-medium">{JOB_LABEL[proposal.job] ?? proposal.job}</p>
            {proposal.items.map((item) => (
              <div key={item.productId} className="space-y-2">
                <div className="text-sm space-y-1">
                  <p>
                    Product {item.productId}
                    {item.error ? `: ${item.error}` : ""}
                  </p>
                  {item.proposal?.description ? <p>{item.proposal.description}</p> : null}
                  {item.proposal?.tags?.length ? (
                    <p>Tags: {item.proposal.tags.join(", ")}</p>
                  ) : null}
                  {item.proposal?.seoTitle ? <p>SEO title: {item.proposal.seoTitle}</p> : null}
                  {item.proposal?.seoDescription ? (
                    <p>Meta description: {item.proposal.seoDescription}</p>
                  ) : null}
                </div>
                {proposal.job !== "website" && item.proposal ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => accept(item.productId)} disabled={send.isPending}>
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={send.isPending}
                      onClick={() => send.mutate({ act: { kind: "dismiss", productId: item.productId } })}
                    >
                      Dismiss
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={send.isPending}
                      onClick={() =>
                        send.mutate({ act: { kind: "regenerate", productId: item.productId } })
                      }
                    >
                      Regenerate
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
            {proposal.job === "website" ? (
              <div className="space-y-2">
                <Label htmlFor="conversation-look">Look</Label>
                <Textarea
                  id="conversation-look"
                  value={look}
                  onChange={(event) => setLook(event.target.value)}
                  placeholder="Write the look yourself"
                />
                <Button size="sm" onClick={() => handoff(false)} disabled={send.isPending || !look.trim()}>
                  Confirm handoff
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2" data-testid="conversation-silence">
          <p className="text-xs text-muted-foreground">Silence</p>
          {(
            [
              ["offers", "Job offers"],
              ["bulkSeo", "Bulk SEO"],
              ["listingCopyRefresh", "Listing copy refresh"],
              ["website", "Website"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={silence[key]}
                onCheckedChange={(checked) =>
                  setSilenceDraft({ ...silence, [key]: checked === true })
                }
              />
              {label}
            </label>
          ))}
          <Button
            size="sm"
            variant="outline"
            disabled={send.isPending}
            onClick={() =>
              send.mutate(
                { act: { kind: "silence", silence } },
                { onSuccess: () => setSilenceDraft(null) },
              )
            }
          >
            Save silence
          </Button>
        </div>
      </div>
      <form
        className="p-3 border-t border-border flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const next = text.trim();
          if (!next || send.isPending) return;
          setText("");
          send.mutate({ text: next });
        }}
      >
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Ask about stock, Bulk SEO, a refresh, or a website"
          data-testid="conversation-input"
        />
        <Button type="submit" size="sm" disabled={send.isPending || !text.trim()}>
          Send
        </Button>
      </form>
      {overflow.dialog}
    </div>
  );
}
