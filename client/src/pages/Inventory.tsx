import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  Bell,
  Boxes,
  Check,
  ChevronRight,
  History,
  Layers3,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api-origin";
import { api } from "@/lib/api-routes";
import { useShopifyStatus } from "@/hooks/use-images";
import {
  type InventoryItemDto,
  useAdjustInventory,
  useDeleteInventoryBundle,
  useEnableInventory,
  useInventoryBundles,
  useInventoryImport,
  useInventoryItems,
  useInventoryLedger,
  useInventoryLocations,
  useInventoryNotifications,
  useInventoryOverview,
  useReadInventoryNotification,
  useReconcileInventory,
  useSaveInventoryBundle,
  useStartInventorySetup,
  useUpdateInventoryPolicy,
} from "@/hooks/use-inventory";

export default function Inventory() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const overview = useInventoryOverview();
  const shopify = useShopifyStatus();
  const settings = overview.data?.settings;
  const [importId, setImportId] = useState<number | null>(null);

  useEffect(() => {
    if (!importId && overview.data?.latestImport?.id && !settings?.enabled) {
      setImportId(overview.data.latestImport.id);
    }
  }, [importId, overview.data?.latestImport?.id, settings?.enabled]);

  if (overview.isLoading) {
    return <InventoryLoading />;
  }

  if (overview.error) {
    const message = overview.error instanceof Error ? overview.error.message : "Inventory Autopilot is unavailable";
    return (
      <PageShell>
        <Card className="max-w-xl mx-auto mt-20 border-amber-500/20 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> Inventory Autopilot</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={() => navigate("/")}>Return to workspace</Button>
            <Button variant="outline" onClick={() => overview.refetch()}>Try again</Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (!settings?.enabled) {
    if (!shopify.isLoading && !shopify.data?.inventoryReady) {
      const reconnect = () => {
        if (shopify.data?.shopDomain) {
          const params = new URLSearchParams({ shop: shopify.data.shopDomain });
          window.location.assign(`${apiUrl(api.shopify.oauthStart.path)}?${params.toString()}`);
        } else {
          navigate("/");
        }
      };
      return (
        <PageShell>
          <Card className="max-w-xl mx-auto mt-20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#96BF48]" />
                {shopify.data?.connected ? "Reconnect Shopify" : "Connect Shopify"}
              </CardTitle>
              <CardDescription>
                Inventory Autopilot needs product, inventory, and location access. Existing connections must approve the expanded permissions once.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={reconnect}>
                {shopify.data?.connected ? "Approve inventory permissions" : "Return to Shopify connection"}
              </Button>
            </CardContent>
          </Card>
        </PageShell>
      );
    }
    return (
      <PageShell>
        <InventoryOnboarding
          existingImportId={importId}
          onImportStarted={setImportId}
          onEnabled={async () => {
            await overview.refetch();
            toast({ title: "Inventory Autopilot is live", description: "Your safety buffers are now syncing to Shopify." });
          }}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <InventoryDashboard overview={overview.data!} />
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-transparent text-foreground pb-28">
      <header className="h-16 px-5 md:px-8 flex items-center justify-between border-b border-border/50 bg-background/50 backdrop-blur-xl sticky top-0 z-30">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ChevronRight className="w-4 h-4 rotate-180" />
          Workspace
        </button>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <span className="font-display font-semibold">Inventory Autopilot</span>
        </div>
        <Badge variant="outline" className="border-primary/30 text-primary">Pro</Badge>
      </header>
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">{children}</main>
    </div>
  );
}

function InventoryLoading() {
  return (
    <PageShell>
      <div className="space-y-6">
        <Skeleton className="h-12 w-72" />
        <div className="grid md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28" />)}
        </div>
        <Skeleton className="h-[440px]" />
      </div>
    </PageShell>
  );
}

function InventoryOnboarding(props: {
  existingImportId: number | null;
  onImportStarted: (id: number) => void;
  onEnabled: () => void | Promise<void>;
}) {
  const { toast } = useToast();
  const locations = useInventoryLocations();
  const setup = useStartInventorySetup();
  const enable = useEnableInventory();
  const importJob = useInventoryImport(props.existingImportId);
  const [locationId, setLocationId] = useState("");
  const [buffer, setBuffer] = useState(2);
  const [threshold, setThreshold] = useState(5);
  const status = importJob.data?.status;

  const start = async () => {
    try {
      const job = await setup.mutateAsync({
        locationId,
        defaultSafetyBuffer: buffer,
        defaultLowStockThreshold: threshold,
      });
      props.onImportStarted(job.id);
    } catch (error) {
      toast({ title: "Setup failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  };

  const activate = async () => {
    if (!props.existingImportId) return;
    try {
      await enable.mutateAsync(props.existingImportId);
      await props.onEnabled();
    } catch (error) {
      toast({ title: "Could not enable inventory", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mx-auto flex items-center justify-center">
          <ShieldCheck className="w-7 h-7 text-primary" />
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold">Stop overselling before it starts</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Import your Shopify catalog, reserve a safety buffer, and let SnapSync keep every tracked variant protected.
        </p>
      </div>

      {!props.existingImportId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Connect your inventory</CardTitle>
            <CardDescription>Choose the single Shopify fulfilment location SnapSync should manage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Shopify location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder={locations.isLoading ? "Loading locations…" : "Choose a location"} />
                </SelectTrigger>
                <SelectContent>
                  {(locations.data || []).map((location) => (
                    <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {locations.error && (
                <p className="text-xs text-destructive">
                  {locations.error instanceof Error ? locations.error.message : "Reconnect Shopify with inventory permissions."}
                </p>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Default safety buffer</Label>
                <Input type="number" min={0} value={buffer} onChange={(event) => setBuffer(Math.max(0, Number(event.target.value)))} />
                <p className="text-xs text-muted-foreground">Units held back from Shopify availability.</p>
              </div>
              <div className="space-y-2">
                <Label>Low-stock alert</Label>
                <Input type="number" min={0} value={threshold} onChange={(event) => setThreshold(Math.max(0, Number(event.target.value)))} />
                <p className="text-xs text-muted-foreground">Alert when physical stock reaches this level.</p>
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground flex gap-2">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
              SnapSync first runs a read-only catalog import. You will preview the impact before any Shopify quantities change.
            </div>
            <Button className="w-full" onClick={start} disabled={!locationId || setup.isPending}>
              {setup.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Warehouse className="w-4 h-4 mr-2" />}
              Import Shopify catalog
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {status === "preview_ready" ? <Check className="w-5 h-5 text-emerald-400" /> : <Loader2 className="w-5 h-5 text-primary animate-spin" />}
              {status === "preview_ready" ? "Catalog preview ready" : status === "failed" ? "Import failed" : "Importing your catalog"}
            </CardTitle>
            <CardDescription>
              {status === "preview_ready"
                ? "Review the effect of your safety buffer, then activate syncing."
                : "Shopify is preparing a bulk export. You can leave this page and return later."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!["preview_ready", "failed"].includes(status) && <Progress value={status === "processing" ? 80 : 45} />}
            {status === "failed" && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {importJob.data?.error || "Shopify could not export the catalog."}
              </div>
            )}
            {status === "preview_ready" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <PreviewStat label="Variants" value={importJob.data?.preview?.totalVariants ?? 0} />
                  <PreviewStat label="Tracked" value={importJob.data?.preview?.trackedVariants ?? 0} />
                  <PreviewStat label="Missing SKU" value={importJob.data?.preview?.missingSku ?? 0} />
                  <PreviewStat label="Units reserved" value={importJob.data?.preview?.unitsReservedByBuffer ?? 0} />
                </div>
                <Button className="w-full" onClick={activate} disabled={enable.isPending}>
                  {enable.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                  Enable Inventory Autopilot
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card/50 p-3">
      <div className="font-mono text-xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function InventoryDashboard({ overview }: { overview: NonNullable<ReturnType<typeof useInventoryOverview>["data"]> }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [state, setState] = useState("all");
  const [adjustItem, setAdjustItem] = useState<InventoryItemDto | null>(null);
  const [ledgerItem, setLedgerItem] = useState<InventoryItemDto | null>(null);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showBundles, setShowBundles] = useState(false);
  const items = useInventoryItems(search, state);
  const reconcile = useReconcileInventory();
  const readOnly = overview.settings?.status === "grace";

  const runReconcile = async () => {
    try {
      const result = await reconcile.mutateAsync(undefined);
      toast({ title: "Reconciliation queued", description: `${result.queued ?? 0} inventory items will be checked.` });
    } catch (error) {
      toast({ title: "Reconciliation failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {readOnly && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-medium">Seven-day Pro safety grace</p>
            <p className="text-xs text-muted-foreground mt-1">
              Automatic protection continues, but seller changes are read-only until Pro is restored
              {overview.settings?.graceEndsAt ? ` before ${new Date(overview.settings.graceEndsAt).toLocaleString()}` : ""}.
            </p>
          </div>
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">Live</Badge>
            <span className="text-xs text-muted-foreground">{overview.settings?.locationName}</span>
          </div>
          <h1 className="font-display text-3xl font-bold">Inventory control centre</h1>
          <p className="text-sm text-muted-foreground mt-1">Physical stock, safety buffers, and Shopify availability in one ledger.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBundles(true)}><Layers3 className="w-4 h-4 mr-2" /> Bundles</Button>
          <Button variant="outline" onClick={() => setShowAlerts(true)} className="relative">
            <Bell className="w-4 h-4 mr-2" /> Alerts
            {overview.unreadAlerts > 0 && <span className="ml-2 text-[10px] bg-destructive text-destructive-foreground rounded-full px-1.5">{overview.unreadAlerts}</span>}
          </Button>
          <Button onClick={runReconcile} disabled={readOnly || reconcile.isPending}>
            <RefreshCw className={`w-4 h-4 mr-2 ${reconcile.isPending ? "animate-spin" : ""}`} /> Reconcile
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard icon={Boxes} label="Tracked variants" value={overview.totalItems} />
        <MetricCard icon={Warehouse} label="Physical units" value={overview.totalUnits} />
        <MetricCard icon={AlertTriangle} label="Low stock" value={overview.lowStockItems} tone={overview.lowStockItems ? "warning" : undefined} />
        <MetricCard icon={ShoppingBag} label="Sold out" value={overview.soldOutItems} />
        <MetricCard icon={ShieldCheck} label="Sync conflicts" value={overview.syncFailures} tone={overview.syncFailures ? "danger" : undefined} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
            <div>
              <CardTitle className="text-lg">Inventory</CardTitle>
              <CardDescription>Changes are written to the audit ledger before Shopify is updated.</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product or SKU" className="pl-9 w-full md:w-64" />
              </div>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All states</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="sold_out">Sold out</SelectItem>
                  <SelectItem value="conflict">Conflicts</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[560px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Product</TableHead>
                  <TableHead>Physical</TableHead>
                  <TableHead>Buffer</TableHead>
                  <TableHead>Alert at</TableHead>
                  <TableHead>Shopify</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.isLoading && Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={index}><TableCell colSpan={7}><Skeleton className="h-10" /></TableCell></TableRow>
                ))}
                {(items.data?.items || []).map((item) => (
                  <InventoryRow
                    key={item.id}
                    item={item}
                    defaultBuffer={overview.settings?.defaultSafetyBuffer ?? 2}
                    defaultThreshold={overview.settings?.defaultLowStockThreshold ?? 5}
                    readOnly={readOnly}
                    onAdjust={() => !readOnly && setAdjustItem(item)}
                    onLedger={() => setLedgerItem(item)}
                  />
                ))}
                {!items.isLoading && items.data?.items.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No inventory items match this view.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <AdjustmentDialog item={adjustItem} onOpenChange={(open) => !open && setAdjustItem(null)} />
      <LedgerDialog item={ledgerItem} onOpenChange={(open) => !open && setLedgerItem(null)} />
      <AlertsDialog open={showAlerts} onOpenChange={setShowAlerts} />
      <BundlesDialog open={showBundles} onOpenChange={setShowBundles} items={items.data?.items || []} readOnly={readOnly} />
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: typeof Boxes; label: string; value: number; tone?: "warning" | "danger" }) {
  return (
    <Card className={tone === "danger" ? "border-destructive/30" : tone === "warning" ? "border-amber-500/30" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <Icon className={`w-4 h-4 ${tone === "danger" ? "text-destructive" : tone === "warning" ? "text-amber-400" : "text-primary"}`} />
          <span className="font-mono text-2xl font-semibold">{value}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{label}</p>
      </CardContent>
    </Card>
  );
}

function InventoryRow(props: {
  item: InventoryItemDto;
  defaultBuffer: number;
  defaultThreshold: number;
  readOnly: boolean;
  onAdjust: () => void;
  onLedger: () => void;
}) {
  const { toast } = useToast();
  const updatePolicy = useUpdateInventoryPolicy();
  const [buffer, setBuffer] = useState(props.item.safetyBuffer ?? props.defaultBuffer);
  const [threshold, setThreshold] = useState(props.item.lowStockThreshold ?? props.defaultThreshold);
  const [tracked, setTracked] = useState(props.item.trackingEnabled);
  const policyDirty = buffer !== (props.item.safetyBuffer ?? props.defaultBuffer)
    || threshold !== (props.item.lowStockThreshold ?? props.defaultThreshold)
    || tracked !== props.item.trackingEnabled;

  const save = async () => {
    try {
      await updatePolicy.mutateAsync({
        itemId: props.item.id,
        safetyBuffer: buffer,
        lowStockThreshold: threshold,
        trackingEnabled: tracked,
      });
      toast({ title: "Inventory policy saved" });
    } catch (error) {
      toast({ title: "Policy update failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  };

  const statusVariant = props.item.state === "conflict" ? "destructive" : props.item.state === "sold_out" ? "secondary" : "outline";
  return (
    <TableRow>
      <TableCell className="pl-6 min-w-[240px]">
        <div className="font-medium text-sm">{props.item.title}</div>
        <div className="text-xs text-muted-foreground font-mono">
          {props.item.sku || "No SKU"}{props.item.variantTitle ? ` · ${props.item.variantTitle}` : ""}
          {props.item.kind === "bundle" && <Badge variant="outline" className="ml-2 h-4 text-[9px]">Bundle</Badge>}
        </div>
      </TableCell>
      <TableCell><button onClick={props.onAdjust} disabled={props.readOnly} className="font-mono font-semibold hover:text-primary disabled:hover:text-inherit">{props.item.ledgerQuantity}</button></TableCell>
      <TableCell>
        <Input type="number" min={0} value={buffer} onChange={(event) => setBuffer(Math.max(0, Number(event.target.value)))} className="w-20 h-8 font-mono" disabled={props.readOnly || props.item.kind === "bundle"} />
      </TableCell>
      <TableCell>
        <Input type="number" min={0} value={threshold} onChange={(event) => setThreshold(Math.max(0, Number(event.target.value)))} className="w-20 h-8 font-mono" disabled={props.readOnly || props.item.kind === "bundle"} />
      </TableCell>
      <TableCell><span className="font-mono">{props.item.sellableQuantity}</span></TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant as any} className="capitalize">{props.item.state.replace("_", " ")}</Badge>
          <Switch checked={tracked} onCheckedChange={setTracked} disabled={props.readOnly || props.item.kind === "bundle"} />
        </div>
      </TableCell>
      <TableCell className="text-right pr-6">
        <div className="inline-flex gap-1">
          {policyDirty && !props.readOnly && <Button size="icon" variant="ghost" onClick={save} disabled={updatePolicy.isPending}><Save className="w-4 h-4" /></Button>}
          <Button size="icon" variant="ghost" onClick={props.onLedger}><History className="w-4 h-4" /></Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function AdjustmentDialog({ item, onOpenChange }: { item: InventoryItemDto | null; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const adjust = useAdjustInventory();
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState("Stock count correction");
  useEffect(() => { if (item) setQuantity(item.ledgerQuantity); }, [item]);
  const save = async () => {
    if (!item) return;
    try {
      await adjust.mutateAsync({ itemId: item.id, mode: "set", quantity, reason });
      toast({ title: "Stock adjusted", description: `${item.title} now has ${quantity} physical units.` });
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Adjustment failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  };
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Adjust physical stock</DialogTitle><DialogDescription>{item?.title} · {item?.sku || "No SKU"}</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Quantity</Label><Input type="number" min={0} value={quantity} onChange={(event) => setQuantity(Math.max(0, Number(event.target.value)))} /></div>
          <div className="space-y-2"><Label>Reason</Label><Input value={reason} onChange={(event) => setReason(event.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save} disabled={reason.trim().length < 3 || adjust.isPending}>Save adjustment</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LedgerDialog({ item, onOpenChange }: { item: InventoryItemDto | null; onOpenChange: (open: boolean) => void }) {
  const ledger = useInventoryLedger(item?.id ?? null);
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Inventory ledger</DialogTitle><DialogDescription>{item?.title} · immutable adjustment history</DialogDescription></DialogHeader>
        <ScrollArea className="max-h-[480px]">
          <div className="space-y-2 pr-4">
            {(ledger.data || []).map((entry) => (
              <div key={entry.id} className="rounded-lg border p-3 flex items-start justify-between gap-4">
                <div><p className="text-sm font-medium">{entry.reason}</p><p className="text-xs text-muted-foreground">{entry.source} · {new Date(entry.createdAt).toLocaleString()}</p></div>
                <div className="text-right font-mono"><div className={entry.delta >= 0 ? "text-emerald-400" : "text-destructive"}>{entry.delta >= 0 ? "+" : ""}{entry.delta}</div><div className="text-xs text-muted-foreground">after {entry.quantityAfter}</div></div>
              </div>
            ))}
            {!ledger.isLoading && ledger.data?.length === 0 && <p className="text-sm text-muted-foreground text-center py-12">No adjustments yet.</p>}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function AlertsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const notifications = useInventoryNotifications();
  const markRead = useReadInventoryNotification();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Inventory alerts</DialogTitle><DialogDescription>Low stock, connection problems, and sync conflicts.</DialogDescription></DialogHeader>
        <ScrollArea className="max-h-[520px]">
          <div className="space-y-2 pr-4">
            {(notifications.data || []).map((notification) => (
              <button key={notification.id} onClick={() => !notification.readAt && markRead.mutate(notification.id)} className={`w-full text-left rounded-lg border p-3 ${notification.readAt ? "opacity-60" : notification.severity === "critical" ? "border-destructive/30 bg-destructive/5" : "border-amber-500/20 bg-amber-500/5"}`}>
                <div className="flex justify-between gap-3"><p className="text-sm font-medium">{notification.title}</p><Badge variant={notification.severity === "critical" ? "destructive" : "outline"}>{notification.severity}</Badge></div>
                <p className="text-xs text-muted-foreground mt-1">{notification.body}</p>
                <p className="text-[10px] text-muted-foreground mt-2">{new Date(notification.createdAt).toLocaleString()}</p>
              </button>
            ))}
            {!notifications.isLoading && notifications.data?.length === 0 && <p className="text-sm text-muted-foreground text-center py-12">No inventory alerts.</p>}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function BundlesDialog({ open, onOpenChange, items, readOnly }: { open: boolean; onOpenChange: (open: boolean) => void; items: InventoryItemDto[]; readOnly: boolean }) {
  const { toast } = useToast();
  const bundles = useInventoryBundles();
  const saveBundle = useSaveInventoryBundle();
  const deleteBundle = useDeleteInventoryBundle();
  const [parentId, setParentId] = useState("");
  const [componentId, setComponentId] = useState("");
  const [units, setUnits] = useState(1);
  const [components, setComponents] = useState<Array<{ itemId: number; units: number }>>([]);
  const availableComponents = useMemo(() => items.filter((item) => item.kind !== "bundle" && String(item.id) !== parentId), [items, parentId]);

  const addComponent = () => {
    const id = Number(componentId);
    if (!id || components.some((component) => component.itemId === id)) return;
    setComponents([...components, { itemId: id, units }]);
    setComponentId("");
    setUnits(1);
  };
  const save = async () => {
    try {
      await saveBundle.mutateAsync({ bundleItemId: Number(parentId), components });
      setParentId("");
      setComponents([]);
      toast({ title: "Native Shopify bundle saved", description: "Shopify now calculates availability from its components." });
    } catch (error) {
      toast({ title: "Bundle could not be saved", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  };
  const remove = async (id: number) => {
    try {
      await deleteBundle.mutateAsync(id);
      toast({ title: "Bundle relationship removed" });
    } catch (error) {
      toast({ title: "Bundle could not be removed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Bundle & component tracking</DialogTitle><DialogDescription>Recipes are written to Shopify’s native fixed-bundle model for checkout-level oversell protection.</DialogDescription></DialogHeader>
        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-4">
            <div className="space-y-2"><Label>Bundle parent</Label><Select value={parentId} onValueChange={setParentId}><SelectTrigger><SelectValue placeholder="Choose parent variant" /></SelectTrigger><SelectContent>{items.filter((item) => item.kind !== "bundle").map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.title} · {item.sku || "No SKU"}</SelectItem>)}</SelectContent></Select></div>
            <Separator />
            <div className="grid grid-cols-[1fr_80px_auto] gap-2 items-end">
              <div className="space-y-2"><Label>Component</Label><Select value={componentId} onValueChange={setComponentId}><SelectTrigger><SelectValue placeholder="Choose component" /></SelectTrigger><SelectContent>{availableComponents.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.title} · {item.sku || "No SKU"}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Units</Label><Input type="number" min={1} value={units} onChange={(event) => setUnits(Math.max(1, Number(event.target.value)))} /></div>
              <Button size="icon" variant="outline" onClick={addComponent} disabled={readOnly || !componentId}><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-2">
              {components.map((component) => {
                const item = items.find((candidate) => candidate.id === component.itemId);
                return <div key={component.itemId} className="flex items-center justify-between rounded-lg border p-2 text-sm"><span>{component.units} × {item?.title}</span><Button size="icon" variant="ghost" onClick={() => setComponents(components.filter((candidate) => candidate.itemId !== component.itemId))}><X className="w-4 h-4" /></Button></div>;
              })}
            </div>
            <Button className="w-full" onClick={save} disabled={readOnly || !parentId || components.length === 0 || saveBundle.isPending}>Save native bundle</Button>
          </div>
          <ScrollArea className="max-h-[430px]">
            <div className="space-y-3 pr-4">
              <h3 className="text-sm font-semibold">Active recipes</h3>
              {(bundles.data || []).map((bundle: any) => (
                <div key={bundle.id} className="rounded-lg border p-3">
                  <div className="flex justify-between gap-2"><div><p className="text-sm font-medium">{bundle.title}</p><p className="text-xs font-mono text-muted-foreground">{bundle.sku || "No SKU"}</p></div><Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(bundle.id)} disabled={readOnly}><Trash2 className="w-4 h-4" /></Button></div>
                  <div className="mt-2 text-xs text-muted-foreground">{bundle.components.map((component: any) => `${component.units}× ${component.title}`).join(" · ")}</div>
                  <div className="mt-2 text-xs font-mono text-primary">Computed availability: {bundle.computedAvailability}</div>
                </div>
              ))}
              {!bundles.isLoading && bundles.data?.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">No bundle recipes yet.</p>}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
