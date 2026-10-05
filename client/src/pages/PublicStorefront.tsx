import { useQuery } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { StorefrontView, type StorefrontDocument } from "@/components/storefront-view";
import { api, buildUrl } from "@/lib/api-routes";
import { apiUrl } from "@/lib/api-origin";

export default function PublicStorefront({ handle }: { handle: string }) {
  const storefront = useQuery({
    queryKey: [api.storefronts.read.path, handle],
    queryFn: async () => {
      const res = await fetch(apiUrl(buildUrl(api.storefronts.read.path, { handle })), {
        credentials: "omit",
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Could not open this website");
      return res.json() as Promise<StorefrontDocument>;
    },
  });

  if (storefront.isLoading) {
    return <p className="p-8 text-sm">Loading…</p>;
  }
  if (storefront.error) {
    return <p className="p-8 text-sm">Could not open this website.</p>;
  }
  if (!storefront.data) {
    return <p className="p-8 text-sm">This website is not published.</p>;
  }

  const site = storefront.data;
  return (
    <Switch>
      <Route path="/p/:id">
        {(params) => <StorefrontView storefront={site} productId={Number(params.id)} linked />}
      </Route>
      <Route>
        <StorefrontView storefront={site} linked />
      </Route>
    </Switch>
  );
}
