import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Sparkles, Upload, Store, Zap, Shield, BrainCircuit, Image, Tags, FileText,
  Search, Bot, ArrowRight, CheckCircle2, Clock, Globe, TrendingUp, Layers
} from "lucide-react";
import { SiShopify, SiEtsy, SiAmazon } from "react-icons/si";
import { useClerk } from "@clerk/clerk-react";
import snapsyncaiLogo from "../assets/snapsyncai-logo.png";

/* ─── Lightweight CSS-only particle field ───────────────────────────────────
   ~18 dots animated with GPU-composited transform + opacity only.
   No requestAnimationFrame loop, no canvas, zero JS overhead after mount.  */
function ParticleField() {
  const particles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: `${(i * 5.7 + Math.sin(i * 1.3) * 8 + 50) % 100}%`,
        top:  `${(i * 7.2 + Math.cos(i * 1.7) * 10 + 20) % 90}%`,
        size: (i % 4) + 2,                      // 2–5 px
        duration: 14 + (i % 7) * 2.5,           // 14–30 s
        delay: -(i * 2.1),                       // stagger so they don't burst at once
        opacity: 0.12 + (i % 5) * 0.06,         // 0.12–0.36
      })),
    []
  );

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none select-none"
      aria-hidden="true"
    >
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            left:              p.left,
            top:               p.top,
            width:             p.size,
            height:            p.size,
            opacity:           p.opacity,
            animationDuration: `${p.duration}s`,
            animationDelay:    `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Scroll-reveal hook ─────────────────────────────────────────────────────
   Adds 'revealed' class when .reveal elements enter the viewport.
   Uses IntersectionObserver (zero scroll-listener overhead).             */
function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target); // fire once, then stop watching
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
    question: "How do I create product listings from photos?",
    answer: "Simply drag and drop up to 100 product images into SnapSync AI. The AI instantly generates a free preview with titles, categories, and tags. Subscribe to SnapSync AI Pro (£30/month) to unlock full AI analysis including detailed descriptions, pricing suggestions, SEO metadata, AEO FAQ content, and variant options for every product."
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
    answer: "Uploading images and getting AI previews is completely free — no credit card required. To unlock full AI-generated descriptions, pricing, SEO, AEO content, and variants, subscribe to SnapSync AI Pro for £30 per month. This gives you unlimited image analysis with no per-image charges and no usage limits."
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
    question: "How do I push products to Shopify with SnapSync AI?",
    answer: "Connect your Shopify store by entering your store URL and a custom app access token (takes under 2 minutes). Once connected, select the products you want to publish from the SnapSync AI workspace, then click 'Push to Shopify'. Your listings — complete with titles, descriptions, pricing, and images — are published instantly."
  },
  {
    question: "Can SnapSync AI handle bulk product uploads?",
    answer: "Yes. SnapSync AI supports batch uploads of up to 100 product images at once. All images are processed in parallel, so you can go from 100 photos to 100 AI-generated listings in minutes rather than days."
  }
];

const FEATURES = [
  {
    icon: Upload,
    title: "Batch Upload 100 Images",
    description: "Drag and drop up to 100 product photos at once. Get free AI-generated previews with titles, categories, and tags instantly — no subscription needed.",
    badge: "Free"
  },
  {
    icon: BrainCircuit,
    title: "AI-Generated Listings",
    description: "Complete product titles, descriptions, suggested pricing, variant options, and full category taxonomy — all generated from a single product photo in seconds.",
    badge: "Pro"
  },
  {
    icon: Store,
    title: "Push to 3 Marketplaces",
    description: "Connect Shopify, Etsy, and Amazon. Review and edit in the built-in queue, then publish to all platforms simultaneously with one click.",
    badge: "Pro"
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
    description: "Drag and drop up to 100 product images. Add optional brand context and choose your preferred tone of voice.",
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
  { value: "100",  label: "Images per batch upload",          icon: Layers },
  { value: "3",    label: "Marketplaces supported",           icon: Globe },
  { value: "10s",  label: "Average listing generation time",  icon: Clock },
];

export default function Landing() {
  const { openSignIn } = useClerk();
  useScrollReveal();

  useEffect(() => {
    document.title = "SnapSync AI — AI Product Listing Generator for Shopify, Etsy & Amazon";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", "Upload product photos and let AI generate complete e-commerce listings in seconds. Titles, descriptions, pricing, SEO metadata, and AEO content — then push to Shopify, Etsy, or Amazon with one click. Try free today.");
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
    "offers": {
      "@type": "Offer",
      "price": "30.00",
      "priceCurrency": "GBP",
      "priceValidUntil": "2027-12-31",
      "description": "SnapSync AI Pro — unlimited AI product listing generation",
      "url": "https://snapsyncai.co.uk"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "reviewCount": "87",
      "bestRating": "5"
    },
    "featureList": [
      "AI product image analysis", "Batch upload up to 100 images",
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
    <div className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b border-white/5 shadow-sm transition-all duration-300" aria-label="Main navigation">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src={snapsyncaiLogo} alt="SnapSync AI logo" className="w-8 h-8 rounded-md" width="32" height="32" />
            <span className="font-display text-lg font-bold tracking-tight">SnapSync AI</span>
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            <a href="#features"     className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline" data-testid="link-features">Features</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline" data-testid="link-how-it-works">How It Works</a>
            <a href="#pricing"      className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline" data-testid="link-pricing">Pricing</a>
            <a href="#faq"          className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline" data-testid="link-faq">FAQ</a>
            <Button variant="outline" size="sm" data-testid="button-login-nav" onClick={() => openSignIn()}>Sign In</Button>
            <Button size="sm" className="hidden sm:flex" onClick={() => openSignIn()} data-testid="button-nav-cta">Start Free</Button>
          </div>
        </div>
      </nav>

      <main className="pt-14">

        {/* ── HERO (particles live here) ── */}
        <section className="relative overflow-hidden" aria-labelledby="hero-heading">
          {/* Glow blobs */}
          <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-primary/[0.03] to-transparent pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

          {/* ✨ Particles */}
          <ParticleField />

          <div className="max-w-5xl mx-auto px-6 py-28 md:py-40 relative text-center z-10">
            <Badge variant="outline" className="mb-6 no-default-active-elevate gap-1.5 px-4 py-1.5 text-xs animate-in fade-in duration-500 rounded-full border-primary/40 bg-primary/10 text-primary shadow-[0_0_20px_rgba(16,185,129,0.2)] backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="font-semibold tracking-wide">AI-Powered E-Commerce Listing Tool</span>
            </Badge>

            <h1 id="hero-heading" className="text-5xl md:text-6xl lg:text-7xl font-display font-extrabold tracking-tight leading-[1.08] mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
              From Photo to Product{" "}
              <span className="relative inline-block mt-2 md:mt-0">
                <span className="bg-gradient-to-r from-emerald-400 via-lime-500 to-primary bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(16,185,129,0.4)]">
                  in Seconds
                </span>
                <Sparkles className="absolute -top-4 -right-8 w-8 h-8 text-lime-400 opacity-60 animate-pulse" />
              </span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              Upload product images and let AI instantly generate complete{" "}
              <strong className="text-foreground font-medium">Shopify, Etsy, and Amazon listings</strong> —
              titles, descriptions, pricing, SEO metadata, and AEO content. One click to publish everywhere.
            </p>

            <p className="text-sm text-muted-foreground mb-10 animate-in fade-in duration-700 delay-150">
              Trusted by e-commerce sellers in the UK. No credit card required to start.
            </p>

            <div className="flex items-center justify-center gap-4 flex-wrap mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
              <Button size="lg" className="h-14 px-8 text-base gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_30px_-5px_hsl(var(--primary))] hover:shadow-[0_0_45px_-5px_hsl(var(--primary))] transition-all duration-300 hover:scale-105 group" data-testid="button-get-started" onClick={() => openSignIn()}>
                Get Started Free
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-8 text-base rounded-xl border-border/60 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })} data-testid="button-learn-more">
                See How It Works
              </Button>
            </div>

            <p className="text-xs text-muted-foreground animate-in fade-in duration-700 delay-300">
              Free AI preview for every image · £30/month for full AI analysis · Cancel anytime
            </p>

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
                  <SiAmazon className="w-6 h-6 text-[#FF9900] group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Amazon</span>
                </div>
              </div>
            </div>

            {/* Scroll Down Indicator */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center animate-bounce opacity-70 z-10 cursor-pointer hover:opacity-100 transition-opacity" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Scroll to explore</span>
                <div className="w-5 h-8 border-2 border-muted-foreground/50 rounded-full flex justify-center pt-1.5 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    <div className="w-1 h-2 bg-primary rounded-full animate-pulse" />
                </div>
            </div>
          </div>
        </section>

        {/* ── STATS BAR ── */}
        <div className="relative border-y border-white/10 bg-black/30 backdrop-blur-xl overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-lime-500/10 opacity-60" />
          <div className="max-w-5xl mx-auto px-6 py-12 relative z-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {STATS.map((stat, i) => (
                <div key={i} className={`space-y-1 reveal delay-${i + 1}`}>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <stat.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-3xl font-display font-bold text-foreground">{stat.value}</div>
                  <div className="text-xs text-muted-foreground leading-tight">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── FEATURES ── */}
        <section id="features" className="max-w-6xl mx-auto px-6 py-24" aria-labelledby="features-heading">
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
              <Card key={i} className={`hover-elevate relative overflow-hidden group border-white/10 hover:border-primary/40 bg-background/50 backdrop-blur-sm transition-all duration-500 reveal delay-${i + 1} hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:-translate-y-1`} data-testid={`card-feature-${i}`}>
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
        <section className="max-w-6xl mx-auto px-6 py-24 border-t border-border" aria-labelledby="ai-editing-heading">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 relative reveal">
              <div className="absolute -inset-4 bg-gradient-to-tr from-emerald-600/30 to-lime-500/30 blur-3xl rounded-[3rem] opacity-70 animate-pulse-glow" />
              <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(16,185,129,0.15)] bg-black/40 backdrop-blur-xl aspect-[4/3] flex items-center justify-center animate-float">
                {/* IMPORTANT: Placeholder for the dashboard image uploaded by the user */}
                <img
                  src="https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1200&auto=format&fit=crop"
                  alt="AI Image Editing Dashboard"
                  className="w-full h-full object-cover mix-blend-overlay opacity-80 scale-105"
                  id="ai-editor-hero-image"
                />
                
                {/* Floating UI Element to add premium feel */}
                <div className="absolute bottom-6 left-6 right-6 p-5 rounded-2xl bg-background/80 backdrop-blur-xl border border-white/10 animate-float-delayed shadow-2xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-500 via-lime-500 to-primary flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(132,204,22,0.4)]">
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
                <Sparkles className="w-3 h-3" /> New Feature
              </Badge>
              <h2 id="ai-editing-heading" className="text-4xl font-display font-bold tracking-tight">
                Edit Images with AI &amp; Generate Stunning Variants
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Take your product photography to the next level. Our new AI Image Editor allows you to instantly generate beautiful lifestyle variants for your products—all without leaving the SnapSync AI workspace.
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
        <section className="relative bg-black/40 py-24 border-y border-white/10 overflow-hidden" aria-labelledby="seo-aeo-heading">
          <div className="absolute inset-0 bg-gradient-to-br from-lime-500/5 via-transparent to-primary/5 pointer-events-none" />
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
                <Card key={i} className={`hover-elevate group border-white/5 hover:border-primary/40 bg-background/40 backdrop-blur-sm transition-all duration-300 reveal delay-${(i % 3) + 1} hover:shadow-[0_8px_30px_rgba(16,185,129,0.15)]`} data-testid={`card-seo-${i}`}>
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
              <div key={i} className={`flex flex-col items-center text-center group reveal delay-${i + 1}`} data-testid={`step-${i}`}>
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
        <section id="pricing" className="relative bg-black/40 border-y border-white/10 py-24 overflow-hidden" aria-labelledby="pricing-heading">
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-background to-emerald-900/10 pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-lime-500/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="max-w-4xl mx-auto px-6 relative z-10">
            <div className="text-center mb-16 reveal">
              <Badge variant="outline" className="mb-4 no-default-active-elevate">Pricing</Badge>
              <h2 id="pricing-heading" className="text-4xl font-display font-bold tracking-tight mb-4">
                Simple, Transparent Pricing
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto text-lg">
                Start completely free. Upgrade when you're ready for full AI-powered listings.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto items-center">
              <Card className="flex flex-col reveal delay-1 bg-background/50 backdrop-blur-md border border-white/10 hover:border-white/20 transition-all duration-300 shadow-xl" data-testid="card-pricing-free">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">Free</CardTitle>
                  <CardDescription>AI previews for every image</CardDescription>
                  <div className="pt-3">
                    <span className="text-4xl font-display font-bold">£0</span>
                    <span className="text-muted-foreground text-sm ml-2">forever</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <Separator className="mb-5 border-white/10" />
                  <ul className="space-y-3">
                    {["Upload up to 100 images per batch", "AI-generated titles & categories", "Auto-tagging for every product", "Connect Shopify, Etsy & Amazon", "No credit card required"].map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 className="w-5 h-5 text-muted-foreground mt-0 flex-shrink-0" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Button variant="outline" className="w-full mt-8 rounded-xl border-border/60 hover:bg-primary/5 hover:border-primary/50 transition-all duration-300" onClick={() => openSignIn()} data-testid="button-pricing-free-start">Start Free</Button>
                </CardContent>
              </Card>

              <Card className="flex flex-col border-primary/50 shadow-[0_0_50px_rgba(16,185,129,0.15)] relative overflow-hidden reveal delay-2 bg-background/60 backdrop-blur-xl hover:shadow-[0_0_60px_rgba(16,185,129,0.25)] transition-all duration-300 md:scale-105 z-10" data-testid="card-pricing-pro">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent opacity-50 pointer-events-none" />
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-lime-500 via-emerald-500 to-primary" />
                <CardHeader className="pb-4 relative z-10">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-xl">Pro</CardTitle>
                    <Badge className="text-[10px]">Most Popular</Badge>
                  </div>
                  <CardDescription>Full AI analysis, unlimited</CardDescription>
                  <div className="pt-3">
                    <span className="text-4xl font-display font-bold">£30</span>
                    <span className="text-muted-foreground text-sm ml-2">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <Separator className="mb-5" />
                  <ul className="space-y-3 mb-6">
                    {["Everything in Free", "Full AI-generated product descriptions", "AI-suggested pricing & variants", "SEO title, meta description & alt text", "AEO FAQ pairs & conversational snippets", "Unlimited image analysis", "Built-in review queue", "Bulk publish to all platforms", "Priority support"].map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full h-11 shadow-md shadow-primary/20" data-testid="button-pricing-get-pro" onClick={() => openSignIn()}>
                    Get Started — £30/mo
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <p className="text-xs text-center text-muted-foreground mt-3">Cancel anytime. No lock-in.</p>
                </CardContent>
              </Card>
            </div>
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
            <Accordion type="single" collapsible className="w-full space-y-3" data-testid="faq-list">
              {FAQ_DATA.map((faq, index) => (
                <AccordionItem key={index} value={`faq-${index}`} data-testid={`faq-item-${index}`} className="border border-white/10 bg-background/30 backdrop-blur-md rounded-xl px-4 md:px-6 shadow-sm data-[state=open]:border-primary/40 data-[state=open]:bg-primary/5 transition-colors overflow-hidden">
                  <AccordionTrigger className="text-left text-sm md:text-base font-semibold py-5 hover:no-underline hover:text-primary transition-colors">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed text-sm md:text-base pb-5">{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* ── BOTTOM CTA ── */}
        <section className="max-w-6xl mx-auto px-6 pb-24" aria-labelledby="cta-heading">
          <div className="relative rounded-3xl border border-white/10 bg-black/40 backdrop-blur-md p-12 md:p-20 text-center overflow-hidden reveal shadow-2xl" data-testid="card-cta-bottom">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-lime-900/20" />
            <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-lime-500/20 blur-[120px] rounded-full pointer-events-none" />
            
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
                <Button size="lg" className="h-14 px-10 text-base shadow-[0_0_30px_-5px_hsl(var(--primary))] hover:shadow-[0_0_45px_-5px_hsl(var(--primary))] gap-3 rounded-xl hover:scale-105 transition-all duration-300 group" data-testid="button-cta-bottom" onClick={() => openSignIn()}>
                  Get Started Free
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button size="lg" variant="outline" className="h-14 px-8 text-base rounded-xl border-border/60 hover:bg-primary/5 hover:border-primary/50 transition-all duration-300" onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}>
                  View Pricing
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-8 font-medium">No credit card required · Cancel anytime · Free AI previews included</p>
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
