import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Upload, Store, FileText, ArrowRight, CheckCircle2, Coins, Crown,
  ShieldCheck, LayoutGrid, Boxes,
} from "lucide-react";
import { SiShopify } from "react-icons/si";
import snapsyncaiLogo from "../assets/snapsyncai-logo.png";
import {
  ANNUAL_BULLETS,
  DEMO,
  FAQ_DATA,
  FOOTER_BLURB,
  JOBS,
  LANDING_BRAND,
  LANDING_DOCUMENT_TITLE,
  LANDING_EYEBROW,
  LANDING_FINE_PRINT,
  LANDING_H1,
  LANDING_META_DESCRIPTION,
  LANDING_MICRO,
  LANDING_NON_TEXTILE,
  LANDING_PRIMARY_CTA,
  LANDING_SECONDARY_CTA,
  LANDING_SUBHEAD,
  STEPS,
  WEEKLY_BULLETS,
} from "@/lib/landing-copy";

type DemoPhase = "photo" | "facts" | "write" | "publish";

const PHASE_LABEL: Record<DemoPhase, string> = {
  photo: "photo",
  facts: "confirming facts",
  write: "listing copy",
  publish: "shopify",
};

function HeroLiveDemo() {
  const [phase, setPhase] = useState<DemoPhase>("photo");
  const [chars, setChars] = useState(0);

  useEffect(() => {
    let writeTimer: ReturnType<typeof setInterval> | undefined;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      setPhase("photo");
      setChars(0);
      timers.push(setTimeout(() => setPhase("facts"), 2000));
      timers.push(setTimeout(() => {
        setPhase("write");
        writeTimer = setInterval(() => {
          setChars((c) => {
            if (c >= DEMO.title.length + DEMO.description.length) {
              clearInterval(writeTimer);
              return c;
            }
            return c + 2;
          });
        }, 35);
      }, 4500));
      timers.push(setTimeout(() => setPhase("publish"), 8500));
      timers.push(setTimeout(() => run(), 11500));
    };
    run();
    return () => {
      timers.forEach(clearTimeout);
      if (writeTimer) clearInterval(writeTimer);
    };
  }, []);

  const titleChars = Math.min(chars, DEMO.title.length);
  const descChars = Math.max(0, chars - DEMO.title.length);
  const writing = phase === "write" || phase === "publish";

  return (
    <div className="glass-panel rounded-3xl p-5 md:p-6 max-w-2xl mx-auto text-left">
      <div className="flex items-center justify-between mb-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          merino · facts before copy
        </span>
        <span className={`font-mono text-[10px] uppercase tracking-[0.2em] transition-colors duration-500 ${
          phase === "photo" ? "text-aurora-2" : phase === "facts" ? "text-primary" : phase === "write" ? "text-primary" : "text-aurora-1"
        }`}>
          {PHASE_LABEL[phase]}
        </span>
      </div>

      <div className="flex gap-5 items-stretch">
        <div className="relative w-28 h-28 md:w-36 md:h-36 shrink-0 rounded-2xl overflow-hidden shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.08)]">
          <div
            className="absolute inset-0"
            style={{
              background:
                "repeating-linear-gradient(90deg, hsl(0 0% 22%) 0 3px, hsl(0 0% 16%) 3px 6px), radial-gradient(circle at 40% 30%, hsl(30 12% 38%), hsl(0 0% 12%) 70%)",
            }}
          />
          <div className="absolute inset-x-4 top-6 bottom-5 rounded-sm bg-foreground/10 shadow-[inset_0_0_0_1px_hsl(0_0%_100%/0.08)]" />
          <div className="absolute inset-x-8 top-8 h-10 rounded-b-[40%] bg-background/30" />
          {phase === "photo" && <div className="scan-line" />}
          {phase === "publish" && (
            <div className="absolute inset-0 animate-bloom rounded-2xl" />
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          {phase === "facts" && (
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li><span className="text-foreground/80">Fibre composition</span> · {DEMO.fibre}</li>
              <li><span className="text-foreground/80">Care instructions</span> · {DEMO.care}</li>
              <li><span className="text-foreground/80">GPSR identity</span> · {DEMO.gpsr}</li>
            </ul>
          )}
          {writing && (
            <>
              <p className="font-display font-semibold text-sm md:text-base leading-snug min-h-[1.4em]">
                {DEMO.title.slice(0, titleChars)}
                {phase === "write" && titleChars < DEMO.title.length && (
                  <span className="inline-block w-1.5 h-3.5 bg-aurora-2 animate-pulse ml-0.5 align-baseline" />
                )}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1.5 min-h-[3em]">
                {DEMO.description.slice(0, descChars)}
                {phase === "write" && titleChars >= DEMO.title.length && descChars < DEMO.description.length && (
                  <span className="inline-block w-1.5 h-3 bg-aurora-2 animate-pulse ml-0.5 align-baseline" />
                )}
              </p>
            </>
          )}
          {phase === "photo" && (
            <div className="space-y-1.5 mt-0.5">
              <div className="h-3.5 w-4/5 rounded animate-shimmer" />
              <div className="h-2.5 w-full rounded animate-shimmer" />
              <div className="h-2.5 w-2/3 rounded animate-shimmer" />
            </div>
          )}

          <div className="mt-auto pt-3 flex items-center gap-3">
            <motion.span
              animate={
                phase === "publish"
                  ? { opacity: 1, scale: [1, 1.25, 1] }
                  : { opacity: 0.25, scale: 1 }
              }
              transition={{ duration: 0.5 }}
              className="inline-flex"
            >
              <SiShopify className="w-4 h-4 md:w-5 md:h-5" style={{ color: "#96BF48" }} />
            </motion.span>
            <AnimatePresence>
              {phase === "publish" && (
                <motion.span
                  initial={{ opacity: 0, x: -6, filter: "blur(4px)" }}
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0 }}
                  className="font-mono text-[10px] uppercase tracking-[0.15em] text-primary"
                >
                  live on Shopify
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

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

const JOB_ICONS = [Upload, ShieldCheck, LayoutGrid, Boxes] as const;
const STEP_ICONS = [Upload, ShieldCheck, FileText, Store] as const;

function openLandingSignIn() {
  // Preview at /page can render without ClerkProvider (dev auth bypass).
  // When Clerk is mounted it puts `Clerk` on window; otherwise this is a no-op.
  const clerk = (window as unknown as { Clerk?: { openSignIn?: () => void } }).Clerk;
  clerk?.openSignIn?.();
}

export default function Landing() {
  useScrollReveal();

  useEffect(() => {
    document.title = LANDING_DOCUMENT_TITLE;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", LANDING_META_DESCRIPTION);
    }
  }, []);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": FAQ_DATA.map((faq) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": { "@type": "Answer", "text": faq.answer },
    })),
  };

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": LANDING_BRAND,
    "url": "https://snapsyncai.co.uk",
    "logo": "https://snapsyncai.co.uk/favicon.png",
    "description": LANDING_META_DESCRIPTION,
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "inLanguage": "en-GB",
    "offers": [
      { "@type": "Offer", "price": "4.00", "priceCurrency": "GBP", "name": "Weekly subscription — up to 30 products/week", "priceSpecification": { "@type": "UnitPriceSpecification", "price": "4.00", "priceCurrency": "GBP", "billingIncrement": 1, "unitCode": "WEE" } },
      { "@type": "Offer", "price": "173.00", "priceCurrency": "GBP", "name": "Annual subscription — up to 30 products/week", "priceSpecification": { "@type": "UnitPriceSpecification", "price": "173.00", "priceCurrency": "GBP", "billingIncrement": 1, "unitCode": "ANN" } },
    ],
    "featureList": [
      "New listing from photos",
      "Confirmed product facts before listing copy",
      "Fibre composition, care instructions, and GPSR identity",
      "Push to Shopify",
      "Inventory Autopilot",
    ],
  };

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": LANDING_BRAND,
    "url": "https://snapsyncai.co.uk",
    "logo": "https://snapsyncai.co.uk/favicon.png",
  };

  return (
    <div className="min-h-screen bg-transparent text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />

      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-lg hairline-b transition-all duration-300" aria-label="Main navigation">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src={snapsyncaiLogo} alt={`${LANDING_BRAND} logo`} className="w-8 h-8 rounded-md" width="32" height="32" />
            <span className="font-display text-lg font-bold tracking-tight">{LANDING_BRAND}</span>
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            <a href="#workspace" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">Workspace</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">How it works</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">Pricing</a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">FAQ</a>
            <Button variant="outline" size="sm" onClick={openLandingSignIn}>Sign In</Button>
            <Button size="sm" className="hidden sm:flex" onClick={openLandingSignIn}>{LANDING_PRIMARY_CTA}</Button>
          </div>
        </div>
      </nav>

      <main className="pt-14">
        <section className="relative overflow-hidden" aria-labelledby="hero-heading">
          <div className="max-w-5xl mx-auto px-6 py-24 md:py-32 relative text-center z-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-primary/80 mb-6 animate-in fade-in duration-500">
              {LANDING_EYEBROW}
            </p>

            <h1 id="hero-heading" className="text-4xl md:text-6xl lg:text-7xl font-display font-extrabold tracking-tight leading-[1.05] mb-6 animate-settle">
              <span className="text-gradient-animated">
                {LANDING_H1}
              </span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              {LANDING_SUBHEAD}
            </p>
            <p className="text-sm text-muted-foreground/80 max-w-xl mx-auto mb-4">
              {LANDING_NON_TEXTILE}
            </p>

            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground/70 mb-10 animate-in fade-in duration-700 delay-150">
              {LANDING_MICRO}
            </p>

            <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
              <HeroLiveDemo />
            </div>

            <div className="flex items-center justify-center gap-4 flex-wrap mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
              <Button size="lg" className="h-14 px-8 text-base gap-2 rounded-2xl hover:scale-105 transition-all duration-300 group" onClick={openLandingSignIn}>
                {LANDING_PRIMARY_CTA}
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-8 text-base rounded-2xl" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}>
                {LANDING_SECONDARY_CTA}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground animate-in fade-in duration-700 delay-300">
              {LANDING_FINE_PRINT}
            </p>

            <div className="mt-16 flex items-center justify-center gap-8 flex-wrap animate-in fade-in duration-700 delay-300 relative z-10 p-6 rounded-2xl bg-black/20 backdrop-blur-md border border-white/5 shadow-xl max-w-3xl mx-auto">
              <span className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Publishes to</span>
              <div className="flex items-center gap-2">
                <SiShopify className="w-6 h-6 text-[#96BF48]" />
                <span className="text-sm font-medium text-muted-foreground">Shopify</span>
              </div>
            </div>
          </div>
        </section>

        <section id="workspace" className="max-w-6xl mx-auto px-6 py-24 border-t border-border/50" aria-labelledby="workspace-heading">
          <div className="text-center mb-16 reveal">
            <Badge variant="outline" className="mb-4 no-default-active-elevate">Workspace</Badge>
            <h2 id="workspace-heading" className="text-4xl font-display font-bold tracking-tight mb-4">
              Four jobs. Listing from photos is one of them.
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-lg">
              What ships today on Shopify — not a roadmap.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[300px] bg-primary/5 blur-[100px] rounded-full pointer-events-none" />
            {JOBS.map((job, i) => {
              const Icon = JOB_ICONS[i];
              return (
                <Card key={job.title} className={`hover-elevate relative overflow-hidden group border-white/10 hover:border-primary/40 bg-background/75 transition-all duration-500 reveal delay-${(i % 2) + 1} hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:-translate-y-1`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <CardHeader className="relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl font-bold">{job.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <CardDescription className="leading-relaxed text-sm text-muted-foreground group-hover:text-foreground/80 transition-colors">
                      {job.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section id="how-it-works" className="relative max-w-6xl mx-auto px-6 py-24" aria-labelledby="how-heading">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
          <div className="text-center mb-16 reveal relative z-10">
            <Badge variant="outline" className="mb-4 no-default-active-elevate">How it works</Badge>
            <h2 id="how-heading" className="text-4xl font-display font-bold tracking-tight mb-4">
              Photo, facts, copy, Shopify
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-lg">
              Inventory Autopilot sits alongside this path. It is not a fifth listing step.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
            {STEPS.map((step, i) => {
              const Icon = STEP_ICONS[i];
              return (
                <div key={step.number} className={`flex flex-col items-center text-center group reveal delay-${(i % 3) + 1}`}>
                  <div className="w-14 h-14 rounded-2xl bg-muted group-hover:bg-primary/10 border border-border group-hover:border-primary/30 flex items-center justify-center mb-5 transition-all duration-300 relative z-10">
                    <Icon className="w-6 h-6 group-hover:text-primary transition-colors" />
                  </div>
                  <div className="inline-block mb-3">
                    <Badge variant="outline" className="no-default-active-elevate font-mono text-xs">{step.number}</Badge>
                  </div>
                  <h3 className="font-display font-bold text-xl mb-3">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{step.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="pricing" className="relative bg-card/60 py-24 overflow-hidden" aria-labelledby="pricing-heading">
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-background to-amber-900/10 pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-amber-400/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="max-w-6xl mx-auto px-6 relative z-10">
            <div className="text-center mb-16 reveal">
              <Badge variant="outline" className="mb-4 no-default-active-elevate gap-1.5">
                <Coins className="w-3 h-3" /> Pricing
              </Badge>
              <h2 id="pricing-heading" className="text-4xl font-display font-bold tracking-tight mb-4">
                Simple, transparent pricing
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto text-lg">
                Weekly or annual. The four live jobs, on Shopify.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 text-sm text-primary font-medium bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Up to 30 products/week · Cancel anytime
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10 max-w-2xl mx-auto">
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
                    {WEEKLY_BULLETS.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Button variant="outline" className="w-full mt-auto rounded-xl border-border/60 hover:bg-primary/5 hover:border-primary/50 transition-all duration-300" onClick={openLandingSignIn}>
                    {LANDING_PRIMARY_CTA} — £4/wk
                  </Button>
                </CardContent>
              </Card>

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
                    {ANNUAL_BULLETS.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full mt-auto rounded-xl shadow-md shadow-primary/20" onClick={openLandingSignIn}>
                    {LANDING_PRIMARY_CTA} — £173/yr
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

        <section id="faq" className="max-w-3xl mx-auto px-6 py-24" aria-labelledby="faq-heading">
          <div className="text-center mb-14 reveal">
            <Badge variant="outline" className="mb-4 no-default-active-elevate">FAQ</Badge>
            <h2 id="faq-heading" className="text-4xl font-display font-bold tracking-tight mb-4">
              Questions
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              The workspace, the facts gate, Shopify, and pricing.
            </p>
          </div>
          <div className="reveal">
            <Accordion type="single" collapsible className="w-full space-y-3">
              {FAQ_DATA.map((faq, index) => (
                <AccordionItem key={faq.question} value={`faq-${index}`} className="border border-white/10 bg-background/60 rounded-xl px-4 md:px-6 shadow-sm data-[state=open]:border-primary/40 data-[state=open]:bg-primary/5 transition-colors overflow-hidden">
                  <AccordionTrigger className="text-left text-sm md:text-base font-semibold py-5 hover:no-underline hover:text-primary transition-colors">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed text-sm md:text-base pb-5">{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 pb-24" aria-labelledby="cta-heading">
          <div className="relative rounded-3xl border border-white/10 bg-black/40 backdrop-blur-md p-12 md:p-20 text-center overflow-hidden reveal shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-amber-900/20" />
            <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-amber-400/20 blur-[120px] rounded-full pointer-events-none" />
            <div className="relative z-10">
              <h2 id="cta-heading" className="text-4xl md:text-5xl font-display font-extrabold tracking-tight mb-6">
                Start with a New listing
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto mb-10 text-lg leading-relaxed">
                Photos in, facts confirmed, listing copy, then Shopify. No card required to open the workspace.
              </p>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <Button size="lg" className="h-14 px-10 text-base shadow-[0_0_30px_-5px_hsl(var(--primary))] hover:shadow-[0_0_45px_-5px_hsl(var(--primary))] gap-3 rounded-xl hover:scale-105 transition-all duration-300 group" onClick={openLandingSignIn}>
                  {LANDING_PRIMARY_CTA}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button size="lg" variant="outline" className="h-14 px-8 text-base rounded-xl border-border/60 hover:bg-primary/5 hover:border-primary/50 transition-all duration-300" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}>
                  {LANDING_SECONDARY_CTA}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Separator />

      <footer className="py-12" role="contentinfo">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <img src={snapsyncaiLogo} alt={LANDING_BRAND} className="w-7 h-7 rounded-md" width="28" height="28" />
                <span className="font-display text-base font-bold">{LANDING_BRAND}</span>
              </div>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                {FOOTER_BLURB}
              </p>
            </div>
            <div className="flex flex-wrap gap-8 text-sm text-muted-foreground">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Product</p>
                <a href="#workspace" className="block hover:text-foreground transition-colors">Workspace</a>
                <a href="#how-it-works" className="block hover:text-foreground transition-colors">How it works</a>
                <a href="#pricing" className="block hover:text-foreground transition-colors">Pricing</a>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Channel</p>
                <span className="block">Shopify</span>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Contact</p>
                <a href="mailto:lefteris@tribeagent.co.uk" className="block hover:text-foreground transition-colors">lefteris@tribeagent.co.uk</a>
              </div>
            </div>
          </div>
          <Separator className="my-8" />
          <p className="text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} {LANDING_BRAND}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
