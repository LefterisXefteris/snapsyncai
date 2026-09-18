# Channel adapters land with the second Channel, not as a plugin system

SnapSync has one live Channel (Shopify). The next Channel is an in-repo adapter, written when that Channel is a real ticket — not a plugin registry, and not a Protocol extracted from Shopify alone. Connect, push/sync, and Import are Channel jobs; publications, Draft/Active, Inventory Autopilot, Shop GPSR, and website handoff stay Shopify-shaped until a second Channel needs them. We rejected a loadable plugin system (no third-party authors) and a generic Channel UI (ADR 0009 / 0011).
