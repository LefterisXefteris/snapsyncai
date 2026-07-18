import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Sparkles, Upload, Store, Zap, Shield, BrainCircuit, Image, Tags, FileText,
  Search, Bot, ArrowRight, CheckCircle2, Clock, Globe, TrendingUp, Layers, ShoppingCart, Coins, Play, Crown, Star
} from "lucide-react";
import { SiShopify, SiEtsy } from "react-icons/si";
import { useClerk } from "@clerk/clerk-react";
import snapsyncaiLogo from "../assets/snapsyncai-logo.png";

/* ─── Live demo hero moment ─────────────────────────────────────────────────
   A looping three-act animation: a product photo is scanned → the listing
   streams in like the model is writing it → it publishes to marketplaces.
   Pure CSS/framer-motion, no video. The global AuroraBackground breathes
   behind everything. */
const DEMO_TITLE = "Handwoven Ceramic Vase — Sage";
const DEMO_DESC = "Hand-thrown stoneware with a matte sage glaze. Each piece is one of a kind…";

function HeroLiveDemo() {
  const [phase, setPhase] = useState<"scan" | "write" | "publish">("scan");
  const [chars, setChars] = useState(0);

  useEffect(() => {
    let writeTimer: ReturnType<typeof setInterval> | undefined;
    const cycle = () => {
      setPhase("scan");
      setChars(0);
    };
    const timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      timers.push(setTimeout(() => {
        setPhase("write");
        writeTimer = setInterval(() => {
          setChars((c) => {
            if (c >= DEMO_TITLE.length + DEMO_DESC.length) {
              clearInterval(writeTimer);
              return c;
            }
            return c + 2;
          });
        }, 35);
      }, 2200));
      timers.push(setTimeout(() => setPhase("publish"), 5600));
      timers.push(setTimeout(() => { cycle(); run(); }, 9000));
    };
    run();
    return () => {
      timers.forEach(clearTimeout);
      if (writeTimer) clearInterval(writeTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const titleChars = Math.min(chars, DEMO_TITLE.length);
  const descChars = Math.max(0, chars - DEMO_TITLE.length);
  const writing = phase !== "scan";

  return (
    <div className="glass-panel rounded-3xl p-5 md:p-6 max-w-2xl mx-auto text-left">
      <div className="flex items-center justify-between mb-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          live · photo to listing
        </span>
        <span className={`font-mono text-[10px] uppercase tracking-[0.2em] transition-colors duration-500 ${
          phase === "scan" ? "text-aurora-2" : phase === "write" ? "text-primary" : "text-aurora-1"
        }`}>
          {phase === "scan" ? "analyzing…" : phase === "write" ? "writing…" : "published"}
        </span>
      </div>

      <div className="flex gap-5 items-stretch">
        {/* The "photo" being scanned */}
        <div className="relative w-28 h-28 md:w-36 md:h-36 shrink-0 rounded-2xl overflow-hidden shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.08)]">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 35% 30%, hsl(45 60% 55% / 0.9), hsl(42 45% 35%) 55%, hsl(0 0% 12%) 100%)",
            }}
          />
          {/* vase silhouette */}
          <div className="absolute inset-x-0 bottom-3 mx-auto w-12 md:w-16 h-16 md:h-24 rounded-[45%_45%_30%_30%/60%_60%_20%_20%] bg-background/50 backdrop-blur-[2px]" />
          {phase === "scan" && <div className="scan-line" />}
          {phase === "publish" && (
            <div className="absolute inset-0 animate-bloom rounded-2xl" />
          )}
        </div>

        {/* The listing streaming in */}
        <div className="flex-1 min-w-0 flex flex-col">
          <p className="font-display font-semibold text-sm md:text-base leading-snug min-h-[1.4em]">
            {writing ? DEMO_TITLE.slice(0, titleChars) : ""}
            {phase === "write" && titleChars < DEMO_TITLE.length && (
              <span className="inline-block w-1.5 h-3.5 bg-aurora-2 animate-pulse ml-0.5 align-baseline" />
            )}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1.5 min-h-[3em]">
            {writing ? DEMO_DESC.slice(0, descChars) : ""}
            {phase === "write" && titleChars >= DEMO_TITLE.length && descChars < DEMO_DESC.length && (
              <span className="inline-block w-1.5 h-3 bg-aurora-2 animate-pulse ml-0.5 align-baseline" />
            )}
          </p>
          {!writing && (
            <div className="space-y-1.5 mt-0.5">
              <div className="h-3.5 w-4/5 rounded animate-shimmer" />
              <div className="h-2.5 w-full rounded animate-shimmer" />
              <div className="h-2.5 w-2/3 rounded animate-shimmer" />
            </div>
          )}

          {/* Marketplace publish row */}
          <div className="mt-auto pt-3 flex items-center gap-3">
            {[
              { Icon: SiShopify, color: "#96BF48", delay: 0 },
              { Icon: SiEtsy, color: "#F56400", delay: 0.15 },
              { Icon: ShoppingCart, color: "#FF9900", delay: 0.3 },
            ].map(({ Icon, color, delay }, i) => (
              <motion.span
                key={i}
                animate={
                  phase === "publish"
                    ? { opacity: 1, scale: [1, 1.25, 1] }
                    : { opacity: 0.25, scale: 1 }
                }
                transition={{ duration: 0.5, delay: phase === "publish" ? delay : 0 }}
                className="inline-flex"
              >
                <Icon className="w-4 h-4 md:w-5 md:h-5" style={{ color }} />
              </motion.span>
            ))}
            <AnimatePresence>
              {phase === "publish" && (
                <motion.span
                  initial={{ opacity: 0, x: -6, filter: "blur(4px)" }}
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0 }}
                  className="font-mono text-[10px] uppercase tracking-[0.15em] text-primary"
                >
                  live on 3 marketplaces
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Scroll-reveal hook ──────────────────────────────────────────────────── */
function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}


const FAQ_DATA = [
  {
    question: "What is SnapSync AI and how does it work?",
    answer: "SnapSync AI is an AI-powered product listing generator built for e-commerce sellers. You upload product photos, and our AI analyses each image to generate complete listings — including titles, descriptions, pricing, categories, SEO metadata, and AEO content. You can then review, edit, and push listings to Shopify, Etsy, or Amazon with one click."
  },
  {
    question: "How does the 30-product weekly limit work?",
    answer: "Each week (Monday to Sunday UTC) you can unlock full AI analysis for up to 30 products. A product can have multiple images — they all count as one product towards your limit. The count resets every Monday at midnight UTC."
  },
  {
    question: "How do I create product listings from photos?",
    answer: "Simply drag and drop up to 200 product images into SnapSync AI. The AI instantly generates a free preview with titles, categories, and tags. Subscribe to SnapSync AI and your limit of 30 products per week gives you access to full AI analysis including detailed descriptions, pricing suggestions, SEO metadata, AEO FAQ content, and variant options for every product."
  },
  {
    question: "Which e-commerce platforms does SnapSync AI support?",
    answer: "SnapSync AI supports Shopify, Etsy, and Amazon. Connect your store credentials, review your AI-generated listings in the built-in review queue, then push approved products to any or all three platforms simultaneously with a single click."
  },
  {
    question: "What is AEO (Answer Engine Optimisation)?",
    answer: "AEO stands for Answer Engine Optimisation — the next frontier of product discovery. SnapSync AI generates FAQ pairs and conversational snippets for each product, designed to be picked up by AI assistants like ChatGPT, Google AI Overviews, Perplexity, and voice search. This helps your products appear in AI-powered search results alongside traditional SEO."
  },
  {
    question: "How much does SnapSync AI cost?",
    answer: "Uploading images and getting AI previews is completely free — no credit card required. To unlock full AI-generated descriptions, pricing, SEO, AEO content, and variants, subscribe for £4/week or £173/year — up to 30 AI-powered products per week. No per-product charges, cancel anytime."
  },
  {
    question: "Can I edit AI-generated product listings before publishing?",
    answer: "Yes, absolutely. SnapSync AI includes a built-in review queue where you can edit every field — title, description, price, category, tags, SEO metadata, and more — before pushing products to your connected stores. You have full control over what gets published."
  },
  {
    question: "How is SnapSync AI different from writing product descriptions manually?",
    answer: "SnapSync AI reduces product listing time by up to 90%. Instead of spending 15-30 minutes per product writing titles, descriptions, and SEO content, SnapSync AI generates everything in seconds from a single photo. It also handles tasks most sellers skip, like AEO content, alt text, and variant suggestions — all completely automated."
  },
  {
    question: "Does SnapSync AI generate SEO-optimised product listings?",
    answer: "Yes. Every listing includes an SEO title, meta description, alt text for images, keyword-rich product descriptions, and structured category taxonomy. SnapSync AI also generates AEO content (FAQs and conversational snippets) to maximise visibility across both traditional search engines like Google and AI assistants like ChatGPT."
  },
  {
    question: "Can SnapSync AI handle bulk product uploads?",
    answer: "Yes. SnapSync AI supports batch uploads of up to 200 product images at once. All images are processed in parallel, so you can go from 200 photos to 200 AI-generated listings in minutes rather than days."
  }
];

const FEATURES = [
  {
    icon: Upload,
    title: "Batch Upload 200 Images",
    description: "Drag and drop up to 200 product photos at once. Get free AI-generated previews with titles, categories, and tags instantly — no credit card needed.",
    badge: "Free"
  },
  {
    icon: BrainCircuit,
    title: "AI-Generated Listings",
    description: "Complete product titles, descriptions, suggested pricing, variant options, and full category taxonomy — all generated from a single product photo in seconds.",
    badge: "Subscription"
  },
  {
    icon: Store,
    title: "Push to 3 Marketplaces",
    description: "Connect Shopify, Etsy, and Amazon. Review and edit in the built-in queue, then publish to all platforms simultaneously with one click.",
    badge: "Subscription"
  }
];

const SEO_AEO_FEATURES = [
  { icon: Search,   title: "SEO Titles & Meta Descriptions",  description: "Keyword-optimised meta titles and descriptions crafted to rank on Google, Bing, and beyond." },
  { icon: Image,    title: "Image Alt Text",                  description: "Auto-generated descriptive alt text for every image — boosting accessibility and image search rankings." },
  { icon: Tags,     title: "Smart Categories & Tags",         description: "Auto-categorisation with full Shopify-compatible taxonomy paths and keyword-rich product tags." },
  { icon: Bot,      title: "AEO FAQ Pairs",                   description: "AI-generated Q&A content designed to be surfaced by ChatGPT, Google AI Overviews, and Perplexity." },
  { icon: FileText, title: "Conversational Snippets",         description: "Natural-language product summaries optimised for voice search and AI assistant responses." },
  { icon: Zap,      title: "90% Faster Listing",              description: "What takes 30 minutes per product manually is done in under 10 seconds with SnapSync AI." }
];

const STEPS = [
  {
    number: "01",
    title: "Upload Your Product Photos",
    description: "Drag and drop up to 200 product images. Add optional brand context and choose your preferred tone of voice.",
    icon: Upload
  },
  {
    number: "02",
    title: "AI Generates Complete Listings",
    description: "AI analyses every image and generates titles, descriptions, pricing, categories, SEO metadata, AEO FAQs, and variant suggestions — simultaneously.",
    icon: Sparkles
  },
  {
    number: "03",
    title: "Review, Edit & Publish",
    description: "Edit any field in the built-in review queue. Then push approved products to Shopify, Etsy, and Amazon with a single click.",
    icon: CheckCircle2
  }
];

const STATS = [
  { value: "90%",  label: "Faster than manual listing",       icon: TrendingUp },
  { value: "200",  label: "Images per batch upload",          icon: Layers },
  { value: "3",    label: "Marketplaces supported",           icon: Globe },
  { value: "10s",  label: "Average listing generation time",  icon: Clock },
];

const TESTIMONIALS = [
  {
    name: "Sarah K.",
    role: "Etsy seller · Handmade Jewellery",
    quote: "I used to spend my whole Sunday writing listings. Now I upload 40 photos on Friday night and everything is ready to review by Saturday morning. SnapSync AI paid for itself in the first week.",
    stars: 5,
    highlight: "Saves me 6+ hours every week"
  },
  {
    name: "Marcus D.",
    role: "Shopify merchant · Vintage Clothing",
    quote: "The SEO descriptions it writes are genuinely better than what I was doing manually. My organic traffic went up 34% in the first month. The AEO content is something I'd never have done on my own.",
    stars: 5,
    highlight: "+34% organic traffic in month one"
  },
  {
    name: "Emma T.",
    role: "Multi-platform seller · Home Decor",
    quote: "I sell on Shopify, Etsy, and Amazon. The one-click push to all three is incredible. What used to take me a full day now takes about 20 minutes including review. Can't recommend it enough.",
    stars: 5,
    highlight: "Full day's work down to 20 minutes"
  }
];

export default function Landing() {
  const { openSignIn } = useClerk();
  useScrollReveal();

  useEffect(() => {
    document.title = "SnapSync AI — AI Product Listing Generator for Shopify, Etsy & Amazon";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", "Upload product photos and let AI generate complete e-commerce listings in seconds. Titles, descriptions, pricing, SEO metadata, and AEO content — then push to Shopify, Etsy, or Amazon with one click. Subscribe for £4/week or £173/year.");
    }
  }, []);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": FAQ_DATA.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": { "@type": "Answer", "text": faq.answer }
    }))
  };

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "SnapSync AI",
    "url": "https://snapsyncai.co.uk",
    "logo": "https://snapsyncai.co.uk/favicon.png",
    "description": "AI-powered product listing generator for Shopify, Etsy, and Amazon. Upload product photos and get complete e-commerce listings with SEO and AEO content in seconds.",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "inLanguage": "en-GB",
    "offers": [
      { "@type": "Offer", "price": "4.00", "priceCurrency": "GBP", "name": "Weekly subscription — up to 30 products/week", "priceSpecification": { "@type": "UnitPriceSpecification", "price": "4.00", "priceCurrency": "GBP", "billingIncrement": 1, "unitCode": "WEE" } },
      { "@type": "Offer", "price": "173.00", "priceCurrency": "GBP", "name": "Annual subscription — up to 30 products/week", "priceSpecification": { "@type": "UnitPriceSpecification", "price": "173.00", "priceCurrency": "GBP", "billingIncrement": 1, "unitCode": "ANN" } },
    ],
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "reviewCount": "87",
      "bestRating": "5"
    },
    "featureList": [
      "AI product image analysis", "Batch upload up to 200 images",
      "Auto-generated product titles and descriptions", "AI-suggested pricing",
      "SEO title and meta description generation", "Image alt text generation",
      "AEO FAQ pairs", "Conversational product snippets for AI assistants",
      "Shopify one-click publishing", "Etsy one-click publishing",
      "Amazon one-click publishing", "Built-in product review queue",
      "Bulk product publishing", "Product variant suggestions"
    ]
  };

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "SnapSync AI",
    "url": "https://snapsyncai.co.uk",
    "logo": "https://snapsyncai.co.uk/favicon.png"
  };

  return (
    <div className="min-h-screen bg-transparent text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-lg hairline-b transition-all duration-300" aria-label="Main navigation">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src={snapsyncaiLogo} alt="SnapSync AI logo" className="w-8 h-8 rounded-md" width="32" height="32" />
            <span className="font-display text-lg font-bold tracking-tight">SnapSync AI</span>
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            <a href="#features"     className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">Features</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">How It Works</a>
            <a href="#pricing"      className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">Pricing</a>
            <a href="#faq"          className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">FAQ</a>
            <Button variant="outline" size="sm" onClick={() => openSignIn()}>Sign In</Button>
            <Button size="sm" className="hidden sm:flex" onClick={() => openSignIn()}>Start Free</Button>
          </div>
        </div>
      </nav>

      <main className="pt-14">

        {/* ── HERO ── */}
        <section className="relative overflow-hidden" aria-labelledby="hero-heading">
          <div className="max-w-5xl mx-auto px-6 py-24 md:py-32 relative text-center z-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-primary/80 mb-6 animate-in fade-in duration-500">
              ambient commerce · est. 2027
            </p>

            <h1 id="hero-heading" className="text-5xl md:text-6xl lg:text-7xl font-display font-extrabold tracking-tight leading-[1.05] mb-6 animate-settle">
              <span className="text-gradient-animated">
                Photos in.
                <br />
                Listings, everywhere.
              </span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              Drop product images into the portal and the AI writes complete{" "}
              <strong className="text-foreground font-medium">Shopify, Etsy, and Amazon listings</strong> —
              titles, descriptions, pricing, SEO and AEO content. One click to publish everywhere.
            </p>

            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground/70 mb-10 animate-in fade-in duration-700 delay-150">
              free previews · no card required
            </p>

            {/* Live demo hero moment */}
            <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
              <HeroLiveDemo />
            </div>

            <div className="flex items-center justify-center gap-4 flex-wrap mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
              <Button size="lg" className="h-14 px-8 text-base gap-2 rounded-2xl hover:scale-105 transition-all duration-300 group" onClick={() => openSignIn()}>
                Get Started Free
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-8 text-base rounded-2xl" onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}>
                <Play className="w-4 h-4 mr-2" />
                Watch Demo
              </Button>
            </div>

            <p className="text-xs text-muted-foreground animate-in fade-in duration-700 delay-300">
              Free AI preview for every image · Subscribe from £4/week · Cancel anytime
            </p>

            {/* Micro social proof */}
            <div className="mt-6 flex items-center justify-center gap-2 animate-in fade-in duration-700 delay-400">
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">Loved by <strong className="text-foreground">500+ sellers</strong> across Shopify, Etsy & Amazon</span>
            </div>

            {/* Platform logos */}
            <div className="mt-16 flex items-center justify-center gap-8 flex-wrap animate-in fade-in duration-700 delay-300 relative z-10 p-6 rounded-2xl bg-black/20 backdrop-blur-md border border-white/5 shadow-xl max-w-3xl mx-auto">
              <span className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Works seamlessly with</span>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 group cursor-pointer">
                  <SiShopify className="w-6 h-6 text-[#96BF48] group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Shopify</span>
                </div>
                <div className="flex items-center gap-2 group cursor-pointer">
                  <SiEtsy className="w-6 h-6 text-[#F56400] group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Etsy</span>
                </div>
                <div className="flex items-center gap-2 group cursor-pointer">
                  <ShoppingCart className="w-6 h-6 text-[#FF9900] group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Amazon</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── STATS BAR ── */}
        <div className="relative glass-panel overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-amber-400/10 opacity-60" />
          <div className="max-w-5xl mx-auto px-6 py-12 relative z-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {STATS.map((stat, i) => (
                <div key={i} className={`space-y-1 reveal delay-${i + 1}`}>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <stat.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-3xl font-display font-bold text-foreground font-mono">{stat.value}</div>
                  <div className="text-xs text-muted-foreground leading-tight">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── TESTIMONIALS ── */}
        <section className="max-w-6xl mx-auto px-6 py-20 border-t border-border/30" aria-labelledby="testimonials-heading">
          <div className="text-center mb-12 reveal">
            <div className="flex items-center justify-center gap-0.5 mb-3">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <h2 id="testimonials-heading" className="text-3xl font-display font-bold tracking-tight mb-2">
              Sellers save hours every week
            </h2>
            <p className="text-muted-foreground">Real results from real e-commerce sellers.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className={`reveal delay-${i + 1} relative rounded-2xl border border-white/10 bg-background/70 p-6 space-y-4 hover:border-primary/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.15)]`}>
                <div className="flex items-center gap-0.5">
                  {[...Array(t.stars)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">"{t.quote}"</p>
                <div className="pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                    <span className="text-[11px] font-medium text-primary bg-primary/10 border border-primary/20 rounded-full px-2.5 py-1 text-center leading-tight max-w-[120px]">{t.highlight}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── VIDEO DEMO ── */}
        <section id="demo" className="relative py-24 overflow-hidden" aria-labelledby="demo-heading">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.03] to-transparent pointer-events-none" />
          <div className="max-w-6xl mx-auto px-6 relative z-10">
            <div className="text-center mb-12 reveal">
              <Badge variant="outline" className="mb-4 no-default-active-elevate gap-1.5">
                <Play className="w-3 h-3" /> Live Demo
              </Badge>
              <h2 id="demo-heading" className="text-4xl font-display font-bold tracking-tight mb-4">
                See SnapSync AI in Action
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto text-lg">
                From uploading product photos to a publish-ready listing — watch the full workflow in under 2 minutes.
              </p>
            </div>

            {/* Video player */}
            <div className="reveal relative max-w-5xl mx-auto">
              <div className="absolute -inset-4 bg-gradient-to-tr from-primary/20 to-amber-400/20 blur-3xl rounded-[3rem] opacity-50" />
              <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_80px_rgba(16,185,129,0.15)] bg-black/60">
                <video
                  className="w-full aspect-video object-cover"
                  controls
                  playsInline
                  preload="metadata"
                  poster="/screenshot-workspace.png"
                >
                  <source src="/demo.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>

            {/* Screenshots grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 reveal">
              <div className="relative group">
                <div className="absolute -inset-2 bg-gradient-to-tr from-primary/15 to-transparent blur-2xl rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-xl hover:shadow-[0_0_40px_rgba(16,185,129,0.15)] transition-all duration-500 hover:-translate-y-1 bg-black/20">
                  <div className="absolute top-3 left-3 z-10">
                    <Badge className="text-[10px] bg-primary/90 text-primary-foreground backdrop-blur-md border-0 shadow-lg">Library Picker</Badge>
                  </div>
                  <img
                    src="/screenshot-workspace2.png"
                    alt="SnapSync AI workspace showing AI-generated product listings"
                    className="w-full h-auto object-cover"
                    loading="lazy"
                  />
                </div>
                <p className="text-center text-xs text-muted-foreground mt-3">Browse &amp; select from your full image library</p>
              </div>
              <div className="relative group">
                <div className="absolute -inset-2 bg-gradient-to-tr from-amber-400/15 to-transparent blur-2xl rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-xl hover:shadow-[0_0_40px_rgba(217,168,38,0.12)] transition-all duration-500 hover:-translate-y-1 bg-black/20">
                  <div className="absolute top-3 left-3 z-10">
                    <Badge variant="outline" className="text-[10px] backdrop-blur-md border-primary/40 bg-background/80 shadow-lg">Review Queue</Badge>
                  </div>
                  <img
                    src="/screenshot-workspace.png"
                    alt="SnapSync AI review queue with AI-generated product listing ready to publish"
                    className="w-full h-auto object-cover"
                    loading="lazy"
                  />
                </div>
                <p className="text-center text-xs text-muted-foreground mt-3">Review, edit and approve before publishing</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" className="max-w-6xl mx-auto px-6 py-24 border-t border-border/50" aria-labelledby="features-heading">
          <div className="text-center mb-16 reveal">
            <Badge variant="outline" className="mb-4 no-default-active-elevate">Features</Badge>
            <h2 id="features-heading" className="text-4xl font-display font-bold tracking-tight mb-4">
              Everything You Need to List Products Faster
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-lg">
              AI handles the heavy lifting so you can focus on selling — not writing listings.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[300px] bg-primary/5 blur-[100px] rounded-full pointer-events-none" />
            {FEATURES.map((feature, i) => (
              <Card key={i} className={`hover-elevate relative overflow-hidden group border-white/10 hover:border-primary/40 bg-background/75 transition-all duration-500 reveal delay-${i + 1} hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:-translate-y-1`}>
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <CardHeader className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
                      <feature.icon className="w-6 h-6 text-primary" />
                    </div>
                    <Badge variant={feature.badge === "Free" ? "secondary" : "default"} className="text-[10px] font-semibold tracking-wide">
                      {feature.badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl font-bold">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <CardDescription className="leading-relaxed text-sm text-muted-foreground group-hover:text-foreground/80 transition-colors">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ── AI IMAGE EDITING SHOWCASE ── */}
        <section className="max-w-6xl mx-auto px-6 py-24 border-t border-border/50" aria-labelledby="ai-editing-heading">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 relative reveal">
              <div className="absolute -inset-4 bg-gradient-to-tr from-amber-500/30 to-amber-400/30 blur-3xl rounded-[3rem] opacity-70 animate-pulse-glow" />
              <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(16,185,129,0.15)] bg-black/70 animate-float">
                <img
                  src="/screenshot-workspace2.png"
                  alt="SnapSync AI workspace with AI-generated product listings"
                  className="w-full h-auto object-cover"
                  loading="lazy"
                />
                <div className="absolute bottom-6 left-6 right-6 p-5 rounded-2xl bg-background/90 border border-white/10 animate-float-delayed shadow-2xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 via-amber-400 to-primary flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(217,168,38,0.3)]">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">Multiple Variants Generated</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Experiment with backgrounds, lighting &amp; styles.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2 space-y-6 reveal delay-1">
              <Badge variant="outline" className="no-default-active-elevate gap-1.5 text-primary border-primary/30 bg-primary/5">
                <Sparkles className="w-3 h-3" /> AI Image Editing
              </Badge>
              <h2 id="ai-editing-heading" className="text-4xl font-display font-bold tracking-tight">
                Edit Images with AI &amp; Generate Stunning Variants
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Take your product photography to the next level. Our AI Image Editor lets you instantly generate beautiful lifestyle variants — all without leaving the SnapSync AI workspace.
              </p>
              <ul className="space-y-4 pt-4">
                {[
                  "Instantly swap backgrounds to match your brand aesthetic",
                  "Generate multiple product variants in a single click",
                  "Enhance image quality and adjust lighting automatically",
                  "Perfect for creating fresh content for social media and ads"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-foreground">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── SEO & AEO ── */}
        <section className="relative bg-card/60 py-24 overflow-hidden" aria-labelledby="seo-aeo-heading">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-400/5 via-transparent to-primary/5 pointer-events-none" />
          <div className="max-w-6xl mx-auto px-6 relative z-10">
            <div className="text-center mb-16 reveal">
              <Badge variant="outline" className="mb-4 no-default-active-elevate gap-1.5">
                <Search className="w-3 h-3" /> SEO &amp; AEO
              </Badge>
              <h2 id="seo-aeo-heading" className="text-4xl font-display font-bold tracking-tight mb-4">
                Get Found on Google <em className="not-italic text-primary">&amp;</em> AI Assistants
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                SnapSync AI generates SEO content that ranks on traditional search engines, <em>and</em> AEO content
                that gets surfaced by ChatGPT, Google AI Overviews, Perplexity, and voice search — automatically.
              </p>
            </div>

            <div className="mb-10 p-6 rounded-2xl border border-primary/20 bg-primary/5 flex flex-col md:flex-row items-start gap-4 reveal">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm mb-1">What is Answer Engine Optimisation (AEO)?</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  AEO is the practice of optimising your content for AI-powered search tools — like ChatGPT Shopping, Google AI Overviews, and Perplexity.
                  SnapSync AI generates FAQ pairs and conversational product summaries for every listing, making your products discoverable
                  across the next generation of search. It's like SEO, but for the AI era.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {SEO_AEO_FEATURES.map((feature, i) => (
                <Card key={i} className={`hover-elevate group border-white/5 hover:border-primary/40 bg-background/70 transition-all duration-300 reveal delay-${(i % 3) + 1} hover:shadow-[0_8px_30px_rgba(16,185,129,0.15)]`}>
                  <CardContent className="flex items-start gap-3 pt-6 pb-5 relative z-10">
                    <div className="w-10 h-10 rounded-xl bg-primary/5 group-hover:bg-primary/20 flex items-center justify-center flex-shrink-0 transition-colors shadow-inner border border-white/5">
                      <feature.icon className="w-4 h-4 group-hover:text-primary transition-colors text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm mb-1 text-foreground/90">{feature.title}</p>
                      <p className="text-xs text-muted-foreground/80 leading-relaxed group-hover:text-muted-foreground transition-colors">{feature.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" className="relative max-w-6xl mx-auto px-6 py-24" aria-labelledby="how-heading">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
          <div className="text-center mb-16 reveal relative z-10">
            <Badge variant="outline" className="mb-4 no-default-active-elevate">How It Works</Badge>
            <h2 id="how-heading" className="text-4xl font-display font-bold tracking-tight mb-4">
              Three Steps to Live Listings
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-lg">
              From product photo to published listing in under a minute.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-7 left-[calc(33%+1rem)] right-[calc(33%+1rem)] h-px bg-gradient-to-r from-border via-primary/30 to-border" />
            {STEPS.map((step, i) => (
              <div key={i} className={`flex flex-col items-center text-center group reveal delay-${i + 1}`}>
                <div className="w-14 h-14 rounded-2xl bg-muted group-hover:bg-primary/10 border border-border group-hover:border-primary/30 flex items-center justify-center mb-5 transition-all duration-300 relative z-10">
                  <step.icon className="w-6 h-6 group-hover:text-primary transition-colors" />
                </div>
                <div className="inline-block mb-3">
                  <Badge variant="outline" className="no-default-active-elevate font-mono text-xs">{step.number}</Badge>
                </div>
                <h3 className="font-display font-bold text-xl mb-3">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── PRICING ── */}
        <section id="pricing" className="relative bg-card/60 py-24 overflow-hidden" aria-labelledby="pricing-heading">
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-background to-amber-900/10 pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-amber-400/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="max-w-6xl mx-auto px-6 relative z-10">
            <div className="text-center mb-16 reveal">
              <Badge variant="outline" className="mb-4 no-default-active-elevate gap-1.5">
                <Coins className="w-3 h-3" /> Pricing
              </Badge>
              <h2 id="pricing-heading" className="text-4xl font-display font-bold tracking-tight mb-4">
                Simple, Transparent Pricing
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto text-lg">
                Subscribe weekly or annually for full AI-powered listings. No hidden fees, no surprises.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 text-sm text-primary font-medium bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Up to 30 products/week · Cancel anytime
              </div>
            </div>

            {/* Subscription plans */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10 max-w-2xl mx-auto">
              {/* Weekly */}
              <Card className="flex flex-col reveal delay-1 bg-background/75 border border-white/10 hover:border-white/20 transition-all duration-300 shadow-xl">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Crown className="w-4 h-4 text-primary" />
                    <CardTitle className="text-xl">Pro Weekly</CardTitle>
                  </div>
                  <CardDescription>Up to 30 products/week, billed weekly</CardDescription>
                  <div className="pt-3">
                    <span className="text-4xl font-display font-bold">£4</span>
                    <span className="text-muted-foreground text-sm ml-2">/week</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <Separator className="mb-5 border-white/10" />
                  <ul className="space-y-3 flex-1 mb-6">
                    {["Up to 30 AI-powered products per week", "Full descriptions & pricing", "SEO & AEO content", "Push to all stores", "Cancel anytime"].map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Button variant="outline" className="w-full mt-auto rounded-xl border-border/60 hover:bg-primary/5 hover:border-primary/50 transition-all duration-300" onClick={() => openSignIn()}>
                    Get Started — £4/wk
                  </Button>
                </CardContent>
              </Card>

              {/* Annual */}
              <Card className="flex flex-col relative overflow-hidden reveal delay-2 border-primary/50 shadow-[0_0_50px_rgba(16,185,129,0.15)] bg-background/80 hover:shadow-[0_0_60px_rgba(16,185,129,0.25)] transition-all duration-300 shadow-xl">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent opacity-50 pointer-events-none" />
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-primary" />
                <CardHeader className="pb-4 relative z-10">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-primary" />
                      <CardTitle className="text-xl">Pro Annual</CardTitle>
                    </div>
                    <Badge className="text-[10px] font-bold text-primary-foreground bg-primary border-0 shadow-[0_0_12px_rgba(16,185,129,0.4)]">
                      Save £35 · Best Value
                    </Badge>
                  </div>
                  <CardDescription>Up to 30 products/week, save over 2 months</CardDescription>
                  <div className="pt-3">
                    <span className="text-4xl font-display font-bold">£173</span>
                    <span className="text-muted-foreground text-sm ml-2">/year</span>
                  </div>
                  <p className="text-xs text-primary mt-1 font-medium">= £3.33/wk · best per-week rate</p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col relative z-10">
                  <Separator className="mb-5" />
                  <ul className="space-y-3 flex-1 mb-6">
                    {["Up to 30 AI-powered products per week", "Full descriptions & pricing", "SEO & AEO content", "Push to all stores", "Best per-week rate"].map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full mt-auto rounded-xl shadow-md shadow-primary/20" onClick={() => openSignIn()}>
                    Get Started — £173/yr
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </div>

            <p className="text-center text-xs text-muted-foreground mt-8 reveal">
              Cancel anytime · Secure payments via Stripe
            </p>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="max-w-3xl mx-auto px-6 py-24" aria-labelledby="faq-heading">
          <div className="text-center mb-14 reveal">
            <Badge variant="outline" className="mb-4 no-default-active-elevate">FAQ</Badge>
            <h2 id="faq-heading" className="text-4xl font-display font-bold tracking-tight mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Everything you need to know about SnapSync AI, AI product listings, SEO, and AEO for e-commerce.
            </p>
          </div>
          <div className="reveal">
            <Accordion type="single" collapsible className="w-full space-y-3">
              {FAQ_DATA.map((faq, index) => (
                <AccordionItem key={index} value={`faq-${index}`} className="border border-white/10 bg-background/60 rounded-xl px-4 md:px-6 shadow-sm data-[state=open]:border-primary/40 data-[state=open]:bg-primary/5 transition-colors overflow-hidden">
                  <AccordionTrigger className="text-left text-sm md:text-base font-semibold py-5 hover:no-underline hover:text-primary transition-colors">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed text-sm md:text-base pb-5">{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* ── BOTTOM CTA ── */}
        <section className="max-w-6xl mx-auto px-6 pb-24" aria-labelledby="cta-heading">
          <div className="relative rounded-3xl border border-white/10 bg-black/40 backdrop-blur-md p-12 md:p-20 text-center overflow-hidden reveal shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-amber-900/20" />
            <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-amber-400/20 blur-[120px] rounded-full pointer-events-none" />
            <div className="relative z-10">
              <Badge variant="outline" className="mb-8 no-default-active-elevate gap-1.5 px-4 py-1.5 rounded-full border-primary/30 bg-primary/10 text-primary">
                <Sparkles className="w-4 h-4" />
                <span className="font-semibold tracking-wide uppercase text-xs">Start in 60 seconds</span>
              </Badge>
              <h2 id="cta-heading" className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold tracking-tight mb-6">
                Ready to Supercharge <br className="hidden md:block" /> Your Listings?
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto mb-10 text-lg md:text-xl leading-relaxed">
                Upload your first product photos for free. See how AI transforms images into complete, SEO- and AEO-optimised
                listings in seconds — then publish everywhere with one click.
              </p>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <Button size="lg" className="h-14 px-10 text-base shadow-[0_0_30px_-5px_hsl(var(--primary))] hover:shadow-[0_0_45px_-5px_hsl(var(--primary))] gap-3 rounded-xl hover:scale-105 transition-all duration-300 group" onClick={() => openSignIn()}>
                  Get Started Free
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button size="lg" variant="outline" className="h-14 px-8 text-base rounded-xl border-border/60 hover:bg-primary/5 hover:border-primary/50 transition-all duration-300" onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}>
                  View Pricing
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-8 font-medium">No credit card required · Free AI previews always included · Cancel anytime</p>
            </div>
          </div>
        </section>
      </main>

      <Separator />

      {/* ── FOOTER ── */}
      <footer className="py-12" role="contentinfo">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <img src={snapsyncaiLogo} alt="SnapSync AI" className="w-7 h-7 rounded-md" width="28" height="28" />
                <span className="font-display text-base font-bold">SnapSync AI</span>
              </div>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                AI-powered product listing generator for Shopify, Etsy, and Amazon.
                From Photo to Product in Seconds.
              </p>
            </div>
            <div className="flex flex-wrap gap-8 text-sm text-muted-foreground">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Product</p>
                <a href="#features"     className="block hover:text-foreground transition-colors">Features</a>
                <a href="#how-it-works" className="block hover:text-foreground transition-colors">How It Works</a>
                <a href="#pricing"      className="block hover:text-foreground transition-colors">Pricing</a>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Platforms</p>
                <span className="block">Shopify</span>
                <span className="block">Etsy</span>
                <span className="block">Amazon</span>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Contact</p>
                <a href="mailto:lefteris@tribeagent.co.uk" className="block hover:text-foreground transition-colors">lefteris@tribeagent.co.uk</a>
              </div>
            </div>
          </div>
          <Separator className="my-8" />
          <p className="text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} SnapSync AI. All rights reserved. AI product listing generator for e-commerce sellers.
          </p>
        </div>
      </footer>
    </div>
  );
}
