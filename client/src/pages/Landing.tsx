import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Upload, Store, FileText, ArrowRight, CheckCircle2, Coins,
  ShieldCheck, LayoutGrid, Boxes, Search,
} from "lucide-react";
import { SiShopify } from "react-icons/si";
import { LandingLiveDemo, prefersReducedMotion } from "@/components/landing-live-demo";
import snapsyncaiLogo from "../assets/snapsyncai-logo.png";
import { workspaceNavItem } from "@/lib/workspace-nav";
import {
  CLOSING_HEADING,
  CLOSING_SUBHEAD,
  CREDIT_PACKS,
  FAQ_DATA,
  FAQ_SUBHEAD,
  FOOTER_BLURB,
  JOBS,
  JOBS_HEADING,
  JOBS_SUBHEAD,
  LANDING_BRAND,
  LANDING_CHANNELS,
  LANDING_DOCUMENT_TITLE,
  LANDING_EYEBROW,
  LANDING_H1,
  LANDING_H1_LEAD,
  LANDING_META_DESCRIPTION,
  LANDING_MICRO,
  LANDING_PRIMARY_CTA,
  LANDING_SECONDARY_CTA,
  LANDING_SUBHEAD,
  PRICING_BULLETS,
  PRICING_FINE_PRINT,
  PRICING_HEADING,
  PRICING_SUBHEAD,
  STEPS,
  STEPS_HEADING,
  STEPS_SUBHEAD,
} from "@/lib/landing-copy";

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
    document.querySelectorAll(".reveal, .reveal-draw").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

const JOB_ICONS = [LayoutGrid, Boxes, Search] as const;
const STEP_ICONS = [Upload, ShieldCheck, FileText, Store] as const;

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#jobs", label: "What it does" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
] as const;

type SignInRedirect = { forceRedirectUrl: string; signUpForceRedirectUrl: string };

function openClerkSignIn(redirectPath?: string) {
  // Preview at /page can render without ClerkProvider (dev auth bypass).
  // When Clerk is mounted it puts `Clerk` on window; otherwise this is a no-op.
  const clerk = (window as unknown as { Clerk?: { openSignIn?: (props?: SignInRedirect) => void } }).Clerk;
  clerk?.openSignIn?.(
    redirectPath ? { forceRedirectUrl: redirectPath, signUpForceRedirectUrl: redirectPath } : undefined,
  );
}

// Button onClick passes the click event; keep it out of openClerkSignIn.
function openLandingSignIn() {
  openClerkSignIn();
}

function openSignInToNewListing() {
  openClerkSignIn(workspaceNavItem("new-listing").path);
}

function scrollToHowItWorks() {
  document.getElementById("how-it-works")?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
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
    "offers": CREDIT_PACKS.map((pack) => ({
      "@type": "Offer",
      "price": pack.price.replace("£", "") + ".00",
      "priceCurrency": "GBP",
      "name": `${pack.credits} Credits`,
      "description": "One Credit per Accept of AI listing copy",
    })),
    "featureList": [
      "AI listing copy from product photos",
      "Confirmed facts before listing copy",
      "Push to Shopify or Trendyol International",
      "Products",
      "Import",
      "Inventory",
      "Bulk SEO",
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

      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur border-b border-border" aria-label="Main navigation">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src={snapsyncaiLogo} alt={`${LANDING_BRAND} logo`} className="w-8 h-8 rounded-md" width="32" height="32" />
            <span className="font-display text-lg font-bold tracking-tight">{LANDING_BRAND}</span>
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:inline">
                {link.label}
              </a>
            ))}
            <Button variant="outline" size="sm" onClick={openLandingSignIn}>Sign In</Button>
            <Button size="sm" className="hidden sm:flex" onClick={openLandingSignIn}>{LANDING_PRIMARY_CTA}</Button>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        <section className="relative overflow-hidden" aria-labelledby="hero-heading">
          <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 md:py-24 lg:min-h-[calc(100svh-4rem)] grid gap-12 lg:grid-cols-[1.1fr_1fr] items-center">
            <div className="text-center lg:text-left">
              <div className="flex items-center justify-center lg:justify-start gap-3 mb-8 motion-safe:animate-in motion-safe:fade-in duration-700">
                <img src={snapsyncaiLogo} alt="" className="w-10 h-10 rounded-lg" width="40" height="40" />
                <span className="font-display text-3xl font-bold tracking-tight">{LANDING_BRAND}</span>
              </div>

              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-5">
                {LANDING_EYEBROW}
              </p>

              <h1 id="hero-heading" className="font-display text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 duration-700">
                <span className="text-primary">{LANDING_H1_LEAD}</span>
                {LANDING_H1.slice(LANDING_H1_LEAD.length)}
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed mb-8">
                {LANDING_SUBHEAD}
              </p>

              <div className="flex items-center justify-center lg:justify-start gap-4 flex-wrap mb-5">
                <Button size="lg" className="group h-14 px-8 text-base gap-2" onClick={openLandingSignIn}>
                  {LANDING_PRIMARY_CTA}
                  <ArrowRight className="w-4 h-4 ml-1 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:translate-x-1" />
                </Button>
                <Button size="lg" variant="outline" className="h-14 px-8 text-base" onClick={scrollToHowItWorks}>
                  {LANDING_SECONDARY_CTA}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mb-6">{LANDING_MICRO}</p>

              <div className="inline-flex items-center gap-2.5 rounded-full border border-border bg-card px-4 py-2">
                <SiShopify className="w-4 h-4 text-[#96BF48]" />
                <span className="text-sm text-muted-foreground">{LANDING_CHANNELS}</span>
              </div>
            </div>

            <div className="w-full max-w-xl mx-auto motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 duration-1000">
              <LandingLiveDemo />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-24 border-t border-border/50 scroll-mt-16" aria-labelledby="how-heading">
          <div className="text-center mb-16 reveal">
            <Badge variant="outline" className="mb-4 no-default-active-elevate">{LANDING_SECONDARY_CTA}</Badge>
            <h2 id="how-heading" className="text-4xl font-display font-bold tracking-tight mb-4">{STEPS_HEADING}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-lg">{STEPS_SUBHEAD}</p>
          </div>
          <div className="relative">
            <div
              aria-hidden="true"
              className="reveal-draw pointer-events-none absolute inset-x-0 top-[calc(50%-0.5px)] z-0 hidden h-px bg-primary/30 lg:block"
            />
            <ol className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {STEPS.map((step, i) => {
                const Icon = STEP_ICONS[i];
                return (
                  <li key={step.number} className="group h-full motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-1">
                    <div className={`relative z-10 flex h-full flex-col rounded-xl border border-border bg-card p-6 reveal delay-${i + 1}`}>
                      <div className="flex items-center justify-between mb-6">
                        <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:scale-[1.08]">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <span className="font-display text-3xl font-bold text-muted-foreground/40 tabular-nums">{step.number}</span>
                      </div>
                      <h3 className="font-display font-bold text-xl mb-2">{step.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section id="jobs" className="max-w-6xl mx-auto px-6 py-24 border-t border-border/50 scroll-mt-16" aria-labelledby="jobs-heading">
          <div className="text-center mb-16 reveal">
            <h2 id="jobs-heading" className="text-4xl font-display font-bold tracking-tight mb-4">{JOBS_HEADING}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-lg">{JOBS_SUBHEAD}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {JOBS.map((job, i) => {
              const Icon = JOB_ICONS[i];
              return (
                <div key={job.title} className="group h-full motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-1">
                  <Card className={`h-full reveal delay-${i + 1}`}>
                    <CardHeader>
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:scale-[1.08]">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <CardTitle className="text-xl font-bold">{job.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="leading-relaxed text-sm text-muted-foreground">
                        {job.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </section>

        <section id="pricing" className="border-t border-border py-24 scroll-mt-16" aria-labelledby="pricing-heading">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-14 reveal">
              <Badge variant="outline" className="mb-4 no-default-active-elevate gap-1.5">
                <Coins className="w-3 h-3" /> Pricing
              </Badge>
              <h2 id="pricing-heading" className="text-4xl font-display font-bold tracking-tight mb-4">{PRICING_HEADING}</h2>
              <p className="text-muted-foreground max-w-lg mx-auto text-lg">{PRICING_SUBHEAD}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
              {CREDIT_PACKS.map((pack, i) => (
                <div key={pack.credits} className="h-full motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-1">
                  <Card className={`h-full text-center reveal delay-${i + 1} hover:border-primary/60 transition-colors`}>
                    <CardHeader>
                      <CardDescription>{pack.credits} Credits</CardDescription>
                      <CardTitle className="text-5xl font-display font-bold pt-2">{pack.price}</CardTitle>
                    </CardHeader>
                  </Card>
                </div>
              ))}
            </div>

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl mx-auto mb-10 reveal">
              {PRICING_BULLETS.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="text-center reveal">
              <Button size="lg" className="group h-12 px-8 gap-2" onClick={openLandingSignIn}>
                {LANDING_PRIMARY_CTA}
                <ArrowRight className="w-4 h-4 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:translate-x-1" />
              </Button>
              <p className="text-xs text-muted-foreground mt-6">{PRICING_FINE_PRINT}</p>
            </div>
          </div>
        </section>

        <section id="faq" className="max-w-3xl mx-auto px-6 py-24 scroll-mt-16" aria-labelledby="faq-heading">
          <div className="text-center mb-14 reveal">
            <Badge variant="outline" className="mb-4 no-default-active-elevate">FAQ</Badge>
            <h2 id="faq-heading" className="text-4xl font-display font-bold tracking-tight mb-4">Questions</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">{FAQ_SUBHEAD}</p>
          </div>
          <div className="reveal">
            <Accordion type="single" collapsible className="w-full space-y-3">
              {FAQ_DATA.map((faq, index) => (
                <AccordionItem key={faq.question} value={`faq-${index}`} className="border border-border bg-card rounded-lg px-4 md:px-6 data-[state=open]:border-primary/40 overflow-hidden">
                  <AccordionTrigger className="text-left text-sm md:text-base font-semibold py-5 hover:no-underline hover:text-primary transition-colors">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed text-sm md:text-base pb-5">{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 pb-24" aria-labelledby="cta-heading">
          <div className="relative overflow-hidden rounded-xl border border-border bg-card p-12 md:p-20 text-center reveal">
            <div className="relative">
              <h2 id="cta-heading" className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-6">{CLOSING_HEADING}</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto mb-10 text-lg leading-relaxed">{CLOSING_SUBHEAD}</p>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <Button size="lg" className="group h-14 px-10 text-base gap-3" onClick={openSignInToNewListing}>
                  {LANDING_PRIMARY_CTA}
                  <ArrowRight className="w-5 h-5 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:translate-x-1" />
                </Button>
                <Button size="lg" variant="outline" className="h-14 px-8 text-base" onClick={scrollToHowItWorks}>
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
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">{FOOTER_BLURB}</p>
            </div>
            <div className="flex flex-wrap gap-8 text-sm text-muted-foreground">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Product</p>
                {NAV_LINKS.map((link) => (
                  <a key={link.href} href={link.href} className="block hover:text-foreground transition-colors">{link.label}</a>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Channels</p>
                <span className="block">Shopify</span>
                <span className="block">Trendyol International</span>
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
