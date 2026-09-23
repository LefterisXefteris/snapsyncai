# Plan overflow is £0.70 per extra Allowance use

ADR 0014 priced extra Plan uses at £1.50 on the invoice. Extra uses are now **£0.70** — still post-pay overflow on the Plan, still one Allowance use (listing-copy write or website), still not a pack and not credits. The Plan stays £19/month or £190/year with 20 included uses; leftover £4/week stays a 30/week hard stop with no overflow. 70p is the Stripe invoice-item amount, same tax treatment as today’s £1.50. Next extra use after this ships is 70p; invoice items already created at £1.50 stay until that invoice closes. Overflow cheaper than the included block (~95p) is the point: volume should cost less than the first 20.

**Considered:** prepaid packs or a credit balance (rejected — credits stay dead); 70p without a Plan (rejected — that kills £19); keeping overflow at or above included (rejected — busy months should be cheaper).
