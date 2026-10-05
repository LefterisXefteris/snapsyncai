const STOREFRONT_SUFFIX = ".sites.snapsyncai.co.uk";

/** The shop handle when this host is a public storefront, otherwise null. */
export function storefrontHandleFromHost(hostname: string): string | null {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!host.endsWith(STOREFRONT_SUFFIX)) return null;
  const handle = host.slice(0, -STOREFRONT_SUFFIX.length);
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(handle)) return null;
  return handle;
}
