import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sparkles, Upload, Store, Zap, Shield, BrainCircuit, Image, Tags, FileText, Search, Bot, ArrowRight, CheckCircle2, Clock, Globe } from "lucide-react";
import { useClerk } from "@clerk/clerk-react";
import snapsyncaiLogo from "../assets/snapsyncai-logo.png";

const FAQ_DATA = [
  {
    question: "What is SnapSync AI and how does it work?",
    answer: "SnapSync AI is an AI-powered product listing generator. You upload product photos, and our AI analyses each image to generate complete e-commerce listings — including titles, descriptions, pricing, categories, SEO metadata, and AEO content. You can then review, edit, and push listings to Shopify, Etsy, or Amazon with one click."
  },
  {
    question: "How do I create product listings from photos?",
    answer: "Simply drag and drop up to 100 product images into SnapSync AI. The AI instantly generates a free preview with titles, categories, and tags. Subscribe to SnapSync AI Pro (£30/month) to unlock full AI analysis including detailed descriptions, pricing suggestions, SEO metadata, FAQ content, and variant options for every product."
  },
  {
    question: "Which e-commerce platforms does SnapSync AI support?",
    answer: "SnapSync AI supports Shopify, Etsy, and Amazon. Connect your store credentials, review your AI-generated listings in the built-in review queue, then push approved products to any or all three platforms simultaneously."
  },
  {
    question: "What is AEO (Answer Engine Optimisation)?",
    answer: "AEO stands for Answer Engine Optimisation. SnapSync AI generates FAQ pairs and conversational snippets for each product, designed to be picked up by AI assistants like ChatGPT, Google AI Overviews, and voice search. This helps your products appear in AI-powered search results alongside traditional SEO."
  },
  {
    question: "How much does SnapSync AI cost?",
    answer: "Uploading images and getting AI previews is completely free. To unlock full AI-generated descriptions, pricing, SEO, AEO content, and variants, subscribe to SnapSync AI Pro for £30 per month. This gives you unlimited image analysis with no per-image charges."
  },
  {
    question: "Can I edit AI-generated product listings before publishing?",
    answer: "Yes. SnapSync AI includes a built-in review queue where you can edit every field — title, description, price, category, tags, SEO metadata, and more — before pushing products to your connected stores. You have full control over what gets published."
  },
  {
    question: "How is SnapSync AI different from writing product descriptions manually?",
    answer: "SnapSync AI reduces product listing time by up to 90%. Instead of spending 15-30 minutes per product writing titles, descriptions, and SEO content, SnapSync AI generates everything in seconds from a single photo. It also handles tasks most sellers skip, like AEO content, alt text, and variant suggestions."
  },
  {
    question: "Does SnapSync AI generate SEO-optimised listings?",
    answer: "Yes. Every listing includes an SEO title, meta description, alt text for images, keyword-rich product descriptions, and structured category taxonomy. SnapSync AI also generates AEO content (FAQs and conversational snippets) to maximise visibility across both traditional search engines and AI assistants."
  }
];

const FEATURES = [
  {
    icon: Upload,
    title: "Batch Upload 100 Images",
    description: "Drag and drop up to 100 product photos at once. Get free AI-generated previews with titles, categories, and tags instantly."
  },
  {
    icon: BrainCircuit,
    title: "AI-Generated Listings",
    description: "Complete product descriptions, suggested pricing, variant options, and category taxonomy — all generated from a single photo."
  },
  {
    icon: Store,
    title: "Push to 3 Marketplaces",
    description: "Connect Shopify, Etsy, and Amazon. Review and edit in the built-in queue, then publish to all platforms with one click."
  }
];

const SEO_AEO_FEATURES = [
  { icon: Search, title: "SEO Titles & Descriptions", description: "Keyword-optimised meta titles and descriptions for every product" },
  { icon: Image, title: "Image Alt Text", description: "Descriptive alt text for accessibility and image search ranking" },
  { icon: Tags, title: "Smart Categories & Tags", description: "Auto-categorisation with Shopify-compatible taxonomy paths" },
  { icon: Bot, title: "AEO FAQ Pairs", description: "AI-generated Q&A content picked up by ChatGPT and Google AI" },
  { icon: FileText, title: "Conversational Snippets", description: "Natural-language product summaries for voice and AI search" },
  { icon: Zap, title: "90% Faster Listing", description: "What takes 30 minutes manually is done in seconds with AI" }
];

const STEPS = [
  { number: "1", title: "Upload Photos", description: "Drag and drop up to 100 product images. Add optional context about your products and choose a brand voice.", icon: Upload },
  { number: "2", title: "AI Generates Listings", description: "AI analyses each image and generates titles, descriptions, pricing, categories, SEO metadata, AEO content, and variant suggestions.", icon: Sparkles },
  { number: "3", title: "Review & Publish", description: "Edit any field in the review queue. Then push approved products to Shopify, Etsy, and Amazon with one click.", icon: CheckCircle2 }
];

export default function Landing() {
  const { openSignIn } = useClerk();

  useEffect(() => {
    document.title = "SnapSync AI — AI Product Listing Generator for Shopify, Etsy & Amazon";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", "Upload product photos and let AI generate complete e-commerce listings in seconds. Titles, descriptions, pricing, SEO metadata, and AEO content — then push to Shopify, Etsy, or Amazon with one click.");
    }
  }, []);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": FAQ_DATA.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "SnapSync AI",
    "description": "AI-powered product listing generator for Shopify, Etsy, and Amazon. Upload product photos and get complete e-commerce listings with SEO and AEO content in seconds.",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "30.00",
      "priceCurrency": "GBP",
      "priceValidUntil": "2027-12-31",
      "description": "SnapSync AI Pro — unlimited AI product analysis"
    },
    "featureList": [
      "AI product image analysis",
      "Batch upload up to 100 images",
      "Auto-generated product titles and descriptions",
      "SEO metadata generation",
      "AEO (Answer Engine Optimisation) content",
      "Shopify integration",
      "Etsy integration",
      "Amazon integration",
      "Built-in review queue",
      "One-click multi-platform publishing"
    ]
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />

      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 backdrop-blur-xl bg-background/80" aria-label="Main navigation">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src={snapsyncaiLogo} alt="SnapSync AI logo" className="w-8 h-8 rounded-md" width="32" height="32" />
            <span className="font-display text-lg font-bold tracking-tight">SnapSync AI</span>
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            <a href="#features" className="text-sm text-muted-foreground transition-colors hidden sm:inline" data-testid="link-features">Features</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground transition-colors hidden sm:inline" data-testid="link-how-it-works">How It Works</a>
            <a href="#pricing" className="text-sm text-muted-foreground transition-colors hidden sm:inline" data-testid="link-pricing">Pricing</a>
            <a href="#faq" className="text-sm text-muted-foreground transition-colors hidden sm:inline" data-testid="link-faq">FAQ</a>
            <Button variant="outline" size="sm" data-testid="button-login-nav" onClick={() => openSignIn()}>
              Sign In
            </Button>
          </div>
        </div>
      </nav>

      <main className="pt-14">
        <section className="relative" aria-labelledby="hero-heading">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent" />
          <div className="max-w-4xl mx-auto px-6 py-28 md:py-36 relative text-center">
            <Badge variant="outline" className="mb-6 no-default-active-elevate">
              AI-Powered E-Commerce Listing Tool
            </Badge>
            <h1 id="hero-heading" className="text-4xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight leading-[1.1] mb-6">
              From Photo to Product{" "}
              <span className="bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">in Seconds</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed mb-8">
              Upload product images and let AI generate complete Shopify, Etsy, and Amazon listings — titles, descriptions, pricing, SEO, and AEO content.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap mb-4">
              <Button size="lg" data-testid="button-get-started" onClick={() => openSignIn()}>
                Get Started Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })} data-testid="button-learn-more">
                See How It Works
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Free preview for every image. £30/month for full AI analysis.</p>
          </div>
        </section>

        <Separator />

        <section className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-center gap-8 md:gap-16 flex-wrap text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="text-sm">90% faster listing</span>
            </div>
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              <span className="text-sm">100 images per batch</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <span className="text-sm">3 marketplaces</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="text-sm">Secure & private</span>
            </div>
          </div>
        </section>

        <Separator />

        <section id="features" className="max-w-6xl mx-auto px-6 py-20" aria-labelledby="features-heading">
          <div className="text-center mb-14">
            <Badge variant="outline" className="mb-4 no-default-active-elevate">Features</Badge>
            <h2 id="features-heading" className="text-3xl font-display font-bold tracking-tight mb-3">Everything You Need to List Products Faster</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">AI handles the heavy lifting so you can focus on selling.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <Card key={i} className="hover-elevate" data-testid={`card-feature-${i}`}>
                <CardHeader>
                  <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center mb-2">
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="leading-relaxed">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="bg-muted/30 py-20" aria-labelledby="seo-aeo-heading">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-14">
              <Badge variant="outline" className="mb-4 no-default-active-elevate">SEO & AEO</Badge>
              <h2 id="seo-aeo-heading" className="text-3xl font-display font-bold tracking-tight mb-3">Built-in SEO & AEO for Every Listing</h2>
              <p className="text-muted-foreground max-w-lg mx-auto">Your products get found on Google, Bing, ChatGPT, and AI assistants — automatically.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {SEO_AEO_FEATURES.map((feature, i) => (
                <Card key={i} className="hover-elevate" data-testid={`card-seo-${i}`}>
                  <CardContent className="flex items-start gap-3 pt-6">
                    <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                      <feature.icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm mb-1">{feature.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-20" aria-labelledby="how-heading">
          <div className="text-center mb-14">
            <Badge variant="outline" className="mb-4 no-default-active-elevate">How It Works</Badge>
            <h2 id="how-heading" className="text-3xl font-display font-bold tracking-tight mb-3">Three Steps to Live Listings</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">From product photo to published listing in under a minute.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <div key={i} className="text-center" data-testid={`step-${i}`}>
                <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center mx-auto mb-4">
                  <step.icon className="w-6 h-6" />
                </div>
                <div className="inline-block mb-2">
                  <Badge variant="secondary" className="no-default-active-elevate">Step {step.number}</Badge>
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="bg-muted/30 py-20" aria-labelledby="pricing-heading">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-14">
              <Badge variant="outline" className="mb-4 no-default-active-elevate">Pricing</Badge>
              <h2 id="pricing-heading" className="text-3xl font-display font-bold tracking-tight mb-3">Simple, Transparent Pricing</h2>
              <p className="text-muted-foreground max-w-lg mx-auto">Start free. Upgrade when you're ready for full AI analysis.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              <Card data-testid="card-pricing-free">
                <CardHeader>
                  <CardTitle className="text-lg">Free</CardTitle>
                  <CardDescription>Get started with AI previews</CardDescription>
                  <div className="pt-2">
                    <span className="text-3xl font-display font-bold">£0</span>
                    <span className="text-muted-foreground text-sm ml-1">forever</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <Separator className="mb-4" />
                  <ul className="space-y-3">
                    {[
                      "Upload up to 100 images per batch",
                      "AI-generated titles & categories",
                      "Auto-tagging for every product",
                      "Connect Shopify, Etsy, Amazon"
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-primary/50" data-testid="card-pricing-pro">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-lg">Pro</CardTitle>
                    <Badge>Recommended</Badge>
                  </div>
                  <CardDescription>Full AI analysis, unlimited</CardDescription>
                  <div className="pt-2">
                    <span className="text-3xl font-display font-bold">£30</span>
                    <span className="text-muted-foreground text-sm ml-1">/month</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <Separator className="mb-4" />
                  <ul className="space-y-3 mb-6">
                    {[
                      "Everything in Free",
                      "Full AI-generated descriptions",
                      "Suggested pricing & variants",
                      "SEO metadata & alt text",
                      "AEO FAQ pairs & snippets",
                      "Unlimited image analysis",
                      "Review queue & bulk publish"
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full" data-testid="button-pricing-get-pro" onClick={() => openSignIn()}>
                    Get Started
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section id="faq" className="max-w-3xl mx-auto px-6 py-20" aria-labelledby="faq-heading">
          <div className="text-center mb-14">
            <Badge variant="outline" className="mb-4 no-default-active-elevate">FAQ</Badge>
            <h2 id="faq-heading" className="text-3xl font-display font-bold tracking-tight mb-3">Frequently Asked Questions</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">Everything you need to know about SnapSync AI and AI-powered product listings.</p>
          </div>
          <Accordion type="single" collapsible className="w-full" data-testid="faq-list">
            {FAQ_DATA.map((faq, index) => (
              <AccordionItem key={index} value={`faq-${index}`} data-testid={`faq-item-${index}`}>
                <AccordionTrigger className="text-left text-sm">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-20" aria-labelledby="cta-heading">
          <Card className="text-center p-10 md:p-14" data-testid="card-cta-bottom">
            <h2 id="cta-heading" className="text-3xl font-display font-bold tracking-tight mb-3">Start Listing Products with AI Today</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">Upload your first product photos for free. See how AI transforms images into complete, SEO-optimised listings in seconds.</p>
            <Button size="lg" data-testid="button-cta-bottom" onClick={() => openSignIn()}>
              Get Started Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Card>
        </section>
      </main>

      <Separator />

      <footer className="py-10" role="contentinfo">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <img src={snapsyncaiLogo} alt="SnapSync AI" className="w-6 h-6 rounded" width="24" height="24" />
              <span className="font-display text-sm font-semibold">SnapSync AI</span>
            </div>
            <p className="text-xs text-muted-foreground text-center">AI-powered product listing generator for Shopify, Etsy, and Amazon. From Photo to Product in Seconds.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
