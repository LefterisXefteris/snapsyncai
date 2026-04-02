import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Check, RefreshCw } from "lucide-react";
import { useGenerateContent, useRegenerateField, type GeneratedContent } from "@/hooks/use-images";

const STYLE_TONES = [
  "Professional & trustworthy",
  "Playful & fun",
  "Luxury & premium",
  "Casual & friendly",
  "Bold & energetic",
];

interface AiContentPanelProps {
  imageId: number;
  defaultCategory?: string;
  onAcceptTitle: (value: string) => void;
  onAcceptDescription: (value: string) => void;
  onAcceptTags: (value: string[]) => void;
  onAcceptAeoFaqs: (value: { q: string; a: string }[]) => void;
}

export function AiContentPanel({
  imageId,
  defaultCategory,
  onAcceptTitle,
  onAcceptDescription,
  onAcceptTags,
  onAcceptAeoFaqs,
}: AiContentPanelProps) {
  const { generate } = useGenerateContent();
  const { regenerate } = useRegenerateField();

  // Guided inputs state
  const [category, setCategory] = useState(defaultCategory || "");
  const [styleTone, setStyleTone] = useState(STYLE_TONES[0]);
  const [audience, setAudience] = useState("");

  // Streaming / generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamText, setStreamText] = useState(""); // raw streaming text (pre-parse)
  const [generated, setGenerated] = useState<GeneratedContent | null>(null);
  const [regeneratingField, setRegeneratingField] = useState<string | null>(null);

  // Per-field pending regenerated values (before accept)
  const [pendingTitle, setPendingTitle] = useState<string | null>(null);
  const [pendingDescription, setPendingDescription] = useState<string | null>(null);
  const [pendingTags, setPendingTags] = useState<string[] | null>(null);
  const [pendingFaqs, setPendingFaqs] = useState<{ q: string; a: string }[] | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setStreamText("");
    setGenerated(null);
    setPendingTitle(null);
    setPendingDescription(null);
    setPendingTags(null);
    setPendingFaqs(null);

    await generate(
      imageId,
      { category, styleTone, audience },
      (text) => setStreamText(text),
      (parsed) => {
        setGenerated(parsed);
        setIsGenerating(false);
        setStreamText("");
      },
      () => setIsGenerating(false)
    );
  };

  const handleRegenerateField = async (field: "title" | "description" | "seoKeywords" | "aeoFaqs") => {
    setRegeneratingField(field);
    await regenerate(
      imageId,
      field,
      { category, styleTone, audience },
      () => {}, // no mid-stream UI update for single field
      (value) => {
        if (field === "title") setPendingTitle(value as string);
        else if (field === "description") setPendingDescription(value as string);
        else if (field === "seoKeywords") setPendingTags(value as string[]);
        else if (field === "aeoFaqs") setPendingFaqs(value as { q: string; a: string }[]);
        setRegeneratingField(null);
      },
      () => setRegeneratingField(null)
    );
  };

  // Determine display values — pending overrides generated
  const displayTitle = pendingTitle ?? generated?.title ?? null;
  const displayDescription = pendingDescription ?? generated?.description ?? null;
  const displayTags = pendingTags ?? generated?.seoKeywords ?? null;
  const displayFaqs = pendingFaqs ?? generated?.aeoFaqs ?? null;

  const hasAnyResult =
    displayTitle !== null ||
    displayDescription !== null ||
    displayTags !== null ||
    displayFaqs !== null;

  return (
    <Card className="shadow-sm border-primary/20 bg-primary/[0.02]">
      <CardHeader className="px-4 py-3 border-b border-border/50">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          AI Content Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Guided inputs */}
        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Category</label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Apparel, Home Decor, Electronics"
              className="h-8 text-sm"
              disabled={isGenerating}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Style / Tone</label>
            <Select value={styleTone} onValueChange={setStyleTone} disabled={isGenerating}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STYLE_TONES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Target Audience</label>
            <Input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. Young adults, Gift buyers, Athletes"
              className="h-8 text-sm"
              disabled={isGenerating}
            />
          </div>
        </div>

        {/* Generate button */}
        <Button
          size="sm"
          className="w-full h-8 text-xs"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Generating&hellip;</>
          ) : (
            <><Sparkles className="w-3.5 h-3.5 mr-2" />{hasAnyResult ? "Regenerate All" : "Generate All"}</>
          )}
        </Button>

        {/* Streaming raw indicator */}
        {isGenerating && streamText && (
          <div className="text-[10px] text-muted-foreground font-mono bg-muted/50 p-2 rounded-md max-h-16 overflow-hidden">
            {streamText.slice(-200)}
          </div>
        )}

        {/* Generated field previews */}
        {hasAnyResult && (
          <div className="space-y-3 pt-1">
            {/* Title */}
            {displayTitle !== null && (
              <FieldPreview
                label="Title"
                value={displayTitle}
                isRegenerating={regeneratingField === "title"}
                onAccept={() => {
                  onAcceptTitle(displayTitle);
                  setPendingTitle(null);
                  if (generated) setGenerated({ ...generated, title: displayTitle });
                }}
                onRegenerate={() => handleRegenerateField("title")}
                renderValue={(v) => <p className="text-xs text-foreground leading-relaxed">{v as string}</p>}
              />
            )}

            {/* Description */}
            {displayDescription !== null && (
              <FieldPreview
                label="Description"
                value={displayDescription}
                isRegenerating={regeneratingField === "description"}
                onAccept={() => {
                  onAcceptDescription(displayDescription);
                  setPendingDescription(null);
                  if (generated) setGenerated({ ...generated, description: displayDescription });
                }}
                onRegenerate={() => handleRegenerateField("description")}
                renderValue={(v) => (
                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap line-clamp-6">{v as string}</p>
                )}
              />
            )}

            {/* SEO Keywords */}
            {displayTags !== null && (
              <FieldPreview
                label="SEO Keywords"
                value={displayTags}
                isRegenerating={regeneratingField === "seoKeywords"}
                onAccept={() => {
                  onAcceptTags(displayTags);
                  setPendingTags(null);
                  if (generated) setGenerated({ ...generated, seoKeywords: displayTags });
                }}
                onRegenerate={() => handleRegenerateField("seoKeywords")}
                renderValue={(v) => (
                  <div className="flex flex-wrap gap-1">
                    {(v as string[]).map((kw, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                )}
              />
            )}

            {/* AEO FAQs */}
            {displayFaqs !== null && (
              <FieldPreview
                label="AEO FAQ Pairs"
                value={displayFaqs}
                isRegenerating={regeneratingField === "aeoFaqs"}
                onAccept={() => {
                  onAcceptAeoFaqs(displayFaqs);
                  setPendingFaqs(null);
                  if (generated) setGenerated({ ...generated, aeoFaqs: displayFaqs });
                }}
                onRegenerate={() => handleRegenerateField("aeoFaqs")}
                renderValue={(v) => (
                  <div className="space-y-1.5">
                    {(v as { q: string; a: string }[]).map((faq, i) => (
                      <div key={i} className="text-[10px]">
                        <p className="font-medium text-foreground">{faq.q}</p>
                        <p className="text-muted-foreground">{faq.a}</p>
                      </div>
                    ))}
                  </div>
                )}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface FieldPreviewProps<T> {
  label: string;
  value: T;
  isRegenerating: boolean;
  onAccept: () => void;
  onRegenerate: () => void;
  renderValue: (v: T) => React.ReactNode;
}

function FieldPreview<T>({
  label,
  value,
  isRegenerating,
  onAccept,
  onRegenerate,
  renderValue,
}: FieldPreviewProps<T>) {
  return (
    <div className="border border-border/60 rounded-md p-3 space-y-2 bg-background">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground"
            onClick={onRegenerate}
            disabled={isRegenerating}
          >
            {isRegenerating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] px-2 text-primary hover:text-primary hover:bg-primary/10"
            onClick={onAccept}
            disabled={isRegenerating}
          >
            <Check className="w-3 h-3 mr-1" />
            Accept
          </Button>
        </div>
      </div>
      <div className="max-h-32 overflow-y-auto">{renderValue(value)}</div>
    </div>
  );
}
