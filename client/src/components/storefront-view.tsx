import { useEffect } from "react";
import { Link } from "wouter";

export type StorefrontProduct = {
  id: number;
  title: string | null;
  description: string | null;
  tags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  aeoSnippet: string | null;
  aeoFaqs: { q?: string; a?: string }[] | null;
  photoUrls: string[];
  confirmedFacts: {
    composition?: { name: string; percent: number }[];
    care?: Record<string, string>;
    gpsrIdentity?: {
      manufacturer?: { name?: string; postalAddress?: string; email?: string };
    };
  } | null;
};

export type StorefrontDocument = {
  handle: string;
  host: string;
  shopName: string;
  palette: string;
  typePairing: string;
  products: StorefrontProduct[];
};

const PALETTE_STYLE: Record<string, { background: string; color: string; muted: string }> = {
  ground: { background: "#f4efe6", color: "#1c1917", muted: "#57534e" },
  ink: { background: "#161616", color: "#f5f1ea", muted: "#a8a29e" },
  clay: { background: "#cbb9a8", color: "#1c140f", muted: "#44403c" },
};

function compositionLine(product: StorefrontProduct): string | null {
  const rows = product.confirmedFacts?.composition;
  if (!rows?.length) return null;
  return rows.map((row) => `${row.percent}% ${row.name}`).join(", ");
}

function careLine(product: StorefrontProduct): string | null {
  const care = product.confirmedFacts?.care;
  if (!care) return null;
  const parts = Object.values(care).filter((part) => part.trim());
  return parts.length ? parts.join(". ") : null;
}

function gpsrLines(product: StorefrontProduct): string[] {
  const maker = product.confirmedFacts?.gpsrIdentity?.manufacturer;
  if (!maker) return [];
  return [maker.name, maker.postalAddress, maker.email].filter((part): part is string => Boolean(part?.trim()));
}

function setMeta(selector: string, attr: string, value: string) {
  const node = document.querySelector(selector);
  if (!node) return;
  node.setAttribute(attr, value);
}

export function StorefrontView({
  storefront,
  productId = null,
  linked = false,
  onOpenProduct,
  onOpenHome,
}: {
  storefront: StorefrontDocument;
  productId?: number | null;
  linked?: boolean;
  onOpenProduct?: (id: number) => void;
  onOpenHome?: () => void;
}) {
  const palette = PALETTE_STYLE[storefront.palette] ?? PALETTE_STYLE.ground;
  const titleFont =
    storefront.typePairing === "serif"
      ? "Georgia, 'Times New Roman', serif"
      : "ui-sans-serif, system-ui, sans-serif";
  const product = storefront.products.find((item) => item.id === productId) ?? null;
  const fibre = product ? compositionLine(product) : null;
  const care = product ? careLine(product) : null;
  const gpsr = product ? gpsrLines(product) : [];

  useEffect(() => {
    if (!linked) return;
    const previousTitle = document.title;
    const nextTitle = product
      ? product.seoTitle || product.title || storefront.shopName
      : storefront.shopName;
    const nextDescription = product?.seoDescription ?? "";
    const nextUrl = `https://${storefront.host}${product ? `/p/${product.id}` : "/"}`;
    document.title = nextTitle;
    setMeta('meta[name="description"]', "content", nextDescription);
    setMeta('meta[property="og:title"]', "content", nextTitle);
    setMeta('meta[property="og:description"]', "content", nextDescription);
    setMeta('meta[property="og:url"]', "content", nextUrl);
    setMeta('meta[name="twitter:title"]', "content", nextTitle);
    setMeta('meta[name="twitter:description"]', "content", nextDescription);
    setMeta('link[rel="canonical"]', "href", nextUrl);
    return () => {
      document.title = previousTitle;
    };
  }, [linked, product, storefront.host, storefront.shopName]);

  return (
    <div
      className="min-h-full"
      style={{ background: palette.background, color: palette.color, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
      data-testid="storefront"
    >
      <header className="px-6 py-8 max-w-5xl mx-auto">
        {product ? (
          linked ? (
            <Link href="/" className="text-sm underline" style={{ color: palette.muted }}>
              {storefront.shopName}
            </Link>
          ) : (
            <button type="button" className="text-sm underline" style={{ color: palette.muted }} onClick={onOpenHome}>
              {storefront.shopName}
            </button>
          )
        ) : (
          <h1 className="text-4xl" style={{ fontFamily: titleFont }}>
            {storefront.shopName}
          </h1>
        )}
      </header>
      {product ? (
        <article className="px-6 pb-16 max-w-3xl mx-auto space-y-4">
          <h1 className="text-3xl" style={{ fontFamily: titleFont }}>
            {product.title}
          </h1>
          {product.photoUrls.map((url) => (
            <img key={url} src={url} alt="" className="w-full rounded" />
          ))}
          {product.description ? (
            <div className="text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: product.description }} />
          ) : null}
          {product.tags?.length ? <p>{product.tags.join(", ")}</p> : null}
          {product.aeoSnippet ? <p>{product.aeoSnippet}</p> : null}
          {Array.isArray(product.aeoFaqs) && product.aeoFaqs.length ? (
            <ul>
              {product.aeoFaqs.map((faq) => (
                <li key={`${faq.q}-${faq.a}`}>
                  {faq.q} {faq.a}
                </li>
              ))}
            </ul>
          ) : null}
          {fibre ? <p data-testid="text-fibre">{fibre}</p> : null}
          {care ? <p>{care}</p> : null}
          {gpsr.length ? <p>{gpsr.join(", ")}</p> : null}
        </article>
      ) : (
        <ul className="px-6 pb-16 max-w-5xl mx-auto grid gap-6 sm:grid-cols-2">
          {storefront.products.map((item) => {
            const card = (
              <>
                {item.photoUrls[0] ? (
                  <img src={item.photoUrls[0]} alt="" className="aspect-square w-full object-cover rounded" />
                ) : (
                  <div className="aspect-square w-full rounded" style={{ background: palette.muted, opacity: 0.25 }} />
                )}
                <span className="mt-2 block text-lg" style={{ fontFamily: titleFont }}>
                  {item.title}
                </span>
              </>
            );
            return (
              <li key={item.id}>
                {linked ? (
                  <Link href={`/p/${item.id}`} className="block">
                    {card}
                  </Link>
                ) : (
                  <button type="button" className="block w-full text-left" onClick={() => onOpenProduct?.(item.id)}>
                    {card}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
