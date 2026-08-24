# Agentic UX — Research Notes

**Researched:** 2026-08-24
**Question:** What is agentic UX, and what papers or first-party work exist?
**Confidence:** MEDIUM-HIGH — the underlying HCI field is well documented from primary papers and lab publications; the exact phrase “agentic UX” is sparse in peer-reviewed venues and mostly industry-coined, so definitional claims are weaker than claims about mixed-initiative / human-agent interaction.
**Sources:** ACM/CHI/UIST papers and open PDFs; arXiv preprints (flagged); Microsoft Research, Amazon Science, Anthropic, OpenAI, Google PAIR, Apple HIG, NN/g original research pages, web.dev.

## Summary

Yes: there is substantial primary work on the *problem* of agentic UX, even though the **exact phrase is new and thin**. Academia almost never titles papers “agentic UX.” It studies the same design space under older names: interface agents, mixed-initiative UI, human–AI interaction, coactive/human-agent teamwork, and (since ~2024) human-in-the-loop computer-using agents. Industry 2025–2026 uses “agentic UX / agentic experience / Agent UX / AX” more loosely — and **two different meanings are in circulation**: (1) the *human* experience of delegating work to AI agents, and (2) Mathias Biilmann / Netlify’s **AX = agent experience**, the experience *agents* have as users of APIs and platforms.

The recurring design problem is coordination, not chat chrome: who has initiative, how visible the agent is, when the human must approve or take over, how to recover when the agent is wrong, and how to evaluate systems that act over minutes/hours rather than a single response. First-party lab work (Microsoft Magentic-UI and HAX, Amazon coordination zones, Anthropic computer use, OpenAI Operator/CUA and Codex, Google PAIR, Apple Generative AI HIG) is more concrete about product patterns than most academic surveys. Nothing found is specifically about listing-from-photos seller workspaces; the closest analogues are HITL agents that execute multi-step jobs (web tasks, booking, coordination email, coding) with plan review, takeover, and action gates.

## What "agentic UX" refers to

**Exact-phrase status.** Web search for `"agentic UX"` / `"agentic user experience"` returns mostly agency blogs, Salesforce/EY marketing, and Medium. Those are **not** treated as evidence below except where they point at a first-party source that was then fetched. Peer-reviewed HCI still prefers “human–agent interaction,” “human–AI interaction,” “mixed-initiative,” and “human-in-the-loop agentic systems.”

Three named usages that *do* have an owner:

1. **Human experience of using agents (lab + design orgs).** Microsoft Design defines an agent as “an AI assistant designed to execute tasks, working with or for humans,” and “agentic” systems as ones that “autonomously identify, plan, and take actions… with limited direct human supervision.” Their “Agent UX” principles are explicitly about that human-facing design problem ([Microsoft Design, undated page fetched 2026-08-24](https://microsoft.design/articles/ux-design-for-agents/)). Amazon Science frames the core UX challenge of agentic AI as **coordination**: “the interplay between what users do, what they experience, and what the AI is doing, both visibly and behind the scenes” ([Pierce, Gupta & Kalnikaitė, 2026](https://www.amazon.science/blog/designing-ai-agents-that-know-when-to-step-back)). NN/g defines an AI agent as “a system that pursues a goal by iteratively taking actions, evaluating progress, and deciding its own next steps” ([NN/g](https://www.nngroup.com/articles/definition-ai-agent/)).

2. **AX = agent-as-user (Biilmann / Netlify, Jan 2025).** Mathias Biilmann coined **AX / “agent experience”** as “the holistic experience AI agents will have as the user of a product or platform” — APIs, machine-readable docs, shortest path from agent call to outcome — analogous to UX then DX ([Biilmann](https://biilmann.blog/articles/introducing-ax/); [Netlify AX page](https://www.netlify.com/agent-experience/)). NN/g’s later “AI agents as users” article is the same idea from a usability-research org: “user” is no longer synonymous with human; agents parse screenshots, accessibility trees, or APIs ([NN/g](https://www.nngroup.com/articles/ai-agents-as-users/)). Google’s web.dev guidance is first-party engineering advice for that second audience ([web.dev](https://web.dev/articles/ai-agent-site-ux)).

3. **Academic “agentic AI” (architecture more than UX).** Surveys such as *Agentic AI: a comprehensive survey…* (Springer *Artificial Intelligence Review*, 2025) taxonomize symbolic vs neural agent architectures. That is AI-systems literature, not interaction design ([Springer](https://link.springer.com/article/10.1007/s10462-025-11422-4)). HCI papers that *do* attach “agentic” to interface design tend to be 2025–2026 preprints (e.g. Pierce et al. “Human-AI Coordination Zones”; Mozannar et al. Magentic-UI).

**Conflict to keep straight:** “Agentic UX” in product-design talk usually means *humans using agents*. “AX / agent experience” in the Netlify/NN/g/web.dev line means *designing products so agents can use them*. Both are real; they are not the same job.

## Academic lineage (pre-2023)

The 2023–2026 agent boom sits on a 25-year HCI argument: **delegation vs direct manipulation**, then **mixed initiative** as the attempted synthesis, then **guidelines for AI-infused products**.

| Work | Claim | URL |
| --- | --- | --- |
| Pattie Maes, *Agents that Reduce Work and Information Overload*, CACM 1994 | Interface agents should take over routine parts of tasks; users still need understanding and control. Foundational “delegation” side of the later debate. | [ACM](https://dl.acm.org/doi/10.1145/176789.176792) (paywalled; cite ACM abstract/DOI) |
| Shneiderman & Maes, *Direct Manipulation vs. Interface Agents*, *interactions* 1997; also CHI 97 / IUI 97 debate | Shneiderman: visual objects, rapid reversible operations, user control and predictability. Maes: complexity forces *some* delegation; agents must remain understandable, controllable, and bypassable — complementary to GUIs, not a replacement. This is still the live tension in agent products. | [UMD PDF](https://www.cs.umd.edu/~ben/papers/Shn-Maes-v4n6-1997.pdf); [CHI panel DOI](https://doi.org/10.1145/1120212.1120281) |
| Eric Horvitz, *Principles of Mixed-Initiative User Interfaces*, CHI 1999 | Neither pure agents nor pure direct manipulation. Problems with agents: bad guesses about goals, ignoring cost/benefit of acting, bad timing, no way to invoke/refine automation. LookOut (email → calendar) as the worked example. Principles include value-added automation, reasoning under uncertainty about goals, timing against attention, dialogue to resolve uncertainty, graceful degradation, user invocation/termination. | [Horvitz PDF](https://erichorvitz.com/chi99horvitz.pdf); [ACM DOI](https://doi.org/10.1145/302979.303030) |
| Johnson, Bradshaw, Feltovich et al., *Coactive Design*, *Journal of Human-Robot Interaction* 2014 | Autonomy/levels-of-automation is the wrong organizing principle. Design for **interdependence** in joint activity via observability, predictability, and directability. Distinguishes itself from mixed-initiative as “who initiates” rather than “how teammates depend on each other.” | [DOI](https://doi.org/10.5898/jhri.3.1.johnson) |
| Amershi et al., *Guidelines for Human-AI Interaction*, CHI 2019 | 18 guidelines, validated with 49 practitioners against 20 AI-infused products. Phases: initially / during / when wrong / over time. Still the most-cited practitioner set; authors themselves later note it was built for discrete AI features (recommenders, search), not long-running tool-using agents. | [MSR project](https://www.microsoft.com/en-us/research/project/guidelines-for-human-ai-interaction/); [Horvitz PDF](http://www.erichorvitz.com/Guidelines_Human_AI_Interaction.pdf); [ACM DOI](https://doi.org/10.1145/3290605.3300233) |
| Yang, Steinfeld, Rosé & Zimmerman, *Re-examining Whether, Why, and How Human-AI Interaction Is Uniquely Difficult to Design*, CHI 2020 | Distinctive design difficulty is not “AI makes errors” (HCI always deals with that) but **capability uncertainty** + **output complexity**. Four levels of AI systems; current UX methods work worst for evolving, adaptive systems with outputs that resist simulation (closest analogue to generative agents). | [ACM](https://dl.acm.org/doi/10.1145/3313831.3376301); [open PDF](https://www.cs.nccu.edu.tw/~whliao/hci2024/HAIIchallenges.pdf) |
| Ben Shneiderman, HCAI papers 2020 + book 2022 | Rejects a 1-D “more autonomy is better” scale. Two-dimensional frame: **high human control AND high automation** is possible (and desirable). Language of “teammates” vs “tools” is itself a design choice. | [IJHCI 2020](https://www.hcil.umd.edu/human-centered-ai/); [AIS THCI](https://aisel.aisnet.org/cgi/viewcontent.cgi?article=1136&context=thci); [OUP book](https://doi.org/10.1093/oso/9780192845290.001.0001) |

**Why this lineage matters for “agentic UX”:** every 2024–2026 computer-use product (Operator, Claude computer use, Magentic-UI) is re-litigating Shneiderman vs Maes with better models. Horvitz’s timing/uncertainty principles and Amershi’s “efficient invocation / dismissal / correction” still describe the UI work. Shneiderman’s HCAI frame conflicts with marketing that treats full autonomy as the goal.

## Papers and first-party work (2023–2026)

Grouped by theme. Preprints are marked.

### A. Defining the agent, and treating agents as a new kind of user

**A Concrete Definition of an AI Agent** — Nielsen Norman Group (industry-primary research page, not a CHI paper). [URL](https://www.nngroup.com/articles/definition-ai-agent/). Claim: an agent pursues a goal by iterating, acting, evaluating, and choosing next steps; an LLM alone is not an agent; usefulness is a separate question (reliability, adaptation, acceptable supervision). Relevance: gives product teams a test (“does it iterate and act, or just reply?”) instead of marketing labels.

**AI Agents as Users** — NN/g. [URL](https://www.nngroup.com/articles/ai-agents-as-users/). Claim: agents already use the same UIs as humans (crudely); near-term design for both humans and agents collapses onto accessibility (semantic HTML, labels, predictable patterns); longer-term, human UI and agent API diverge. Also states when *not* to welcome agents (ad-supported visits, regulatory friction, competitive pricing opacity). Relevance: the AX meaning of the phrase, with explicit product caveats.

**Introducing AX: Why Agent Experience Matters** — Mathias Biilmann, Jan 2025. [URL](https://biilmann.blog/articles/introducing-ax/). Claim: craft platform/API/docs for LLM agents as a persona; closed in-product copilots vs open “bring your own agent.” Relevance: first-party coinage of AX; **not** a paper on human-facing agent UI.

**Build agent-friendly websites** — Kasper Kulikowski & Omkar More, web.dev (Google). [URL](https://web.dev/articles/ai-agent-site-ux/). Claim: agents see sites via screenshots, HTML, and the accessibility tree; stable layout, semantic controls, labeled inputs, no ghost overlays. Relevance: concrete AX engineering; also notes WebMCP as an experimental Chrome standard.

### B. Human–AI coordination and HITL agent interfaces (closest to “agentic UX” as product design)

**Human-AI Coordination Zones: A Framework for Designing Human-in-the-Loop Experiences with Agentic AI** — James Pierce, Vaiva Kalnikaitė, Siddharth Gupta, Brian Granger. arXiv:2606.09848, submitted 1 May 2026, cs.HC. **Preprint; venue not yet a CHI proceedings page.** [URL](https://arxiv.org/abs/2606.09848). Claim: gap between high-level principles (“be transparent”) and widgets; mid-level framework of salience × involvement × activity; zones **done-for-me / done-under-me / done-with-me / done-without-me**; input types (prompted, sparked, inferred, layered); coordination curves; patterns including responsive salience, workplan gating, attribution markers, progressive autonomy. Based on analysis of 60 commercial AI apps. Relevance: currently the most explicit academic framing of “agentic” product UX. Companion Amazon Science article (11 Mar 2026) is the practitioner write-up of the same ideas, with a three-zone version (omits done-without-me in the blog) and a user-study quote that high-salience “approve everything” modes fatigue some users ([Amazon Science](https://www.amazon.science/blog/designing-ai-agents-that-know-when-to-step-back)). **Abstract-level access on arXiv; full PDF not independently re-read here beyond the abs page and Amazon blog.**

**Magentic-UI: Towards Human-in-the-loop Agentic Systems** — Hussein Mozannar, Gagan Bansal, Cheng Tan, Adam Fourney, Victor Dibia, Jingya Chen, Jack Gerrits, Tyler Payne, Matheus Kunzler Maldaner, Madeleine Grunde-McLaughlin, Eric Zhu, Griffin Bassman, Jacob Alber, Peter Chang, Ricky Loynd, Friederike Niedtner, Ece Kamar, Maya Murad, Rafah Hosn, Saleema Amershi. Microsoft Research, MSR-TR-2025-40 / arXiv:2507.22358, July 2025. [arXiv](https://arxiv.org/abs/2507.22358); [MSR report](https://www.microsoft.com/en-us/research/publication/magentic-ui-report/); [MSR blog](https://www.microsoft.com/en-us/research/blog/magentic-ui-an-experimental-human-centered-web-agent/); [GitHub](https://github.com/microsoft/magentic-ui). Claim: today’s computer-use / coding / research agents are below human performance *and* create safety risk; HITL is how you get productivity from imperfect systems. Six mechanisms: **co-planning, co-tasking (takeover/handback), action guards/approval, answer verification, memory, multi-tasking**. Human is modeled as a special agent on a Magentic-One-style orchestrator team. Evaluated on WebVoyager/GAIA/AssistantBench/WebGames plus qualitative users and adversarial safety tests. Explicitly contrasts with Operator-style “aim for full autonomy.” Relevance: the strongest first-party *interface* artifact for agentic UX; the shuttle-booking walkthrough is a multi-step job with plan edit, mid-task takeover, payment gate, and saved workflow.

**UX design for agents (Agent UX Design Principles)** — Microsoft Design (Ruokan He, Jen Fox, Amanda Snellinger et al., including Saleema Amershi). [URL](https://microsoft.design/articles/ux-design-for-agents/). Claim: three buckets — Agent Space (connecting not collapsing; accessible yet mostly invisible; background actions still inspectable), Agent Time (memory beyond last state; nudge more than notify; adapt), Agent Core (show uncertainty; transparency, control, consistency; status always visible). Relevance: first-party design system for agents; more product-language than Magentic-UI’s empirical report. Some capabilities (e.g. memory) are marked as still under development.

**The HAX Toolkit** — Microsoft Research / Aether. [Toolkit](https://www.microsoft.com/en-us/haxtoolkit/); [project](https://www.microsoft.com/en-us/research/project/hax-toolkit/). Claim: operationalize Amershi 2019 via Guidelines, Design Library, Workbook, and NLP failure Playbook (the Playbook is itself a CHI 2021 paper: *Planning for Natural Language Failures with the AI Playbook*). Relevance: best existing practitioner kit for AI-infused UX; **not written for long-horizon computer-use agents**, which Magentic-UI and Zhu et al. 2026 treat as a gap.

**Design Principles for Human-Agent Interaction** — Haiyi Zhu, Canwen Wang, Qing Xiao, Hong Shen (CMU). arXiv:2606.20630, 2026. **Position paper / preprint.** [URL](https://arxiv.org/abs/2606.20630). Claim: agent adoption is blocked by interaction design, not only benchmarks. Systematic ACM DL search 2019–2026 → 106 papers → **14 principles** in Amershi’s four stages, extended for sustained shared control, memory, unhealthy dependency, and shared repair. Applied as heuristics to nine live agents. Relevance: the 2026 attempt to update Amershi specifically for agents. **Not yet a CHI proceedings citation.**

**People + AI Guidebook** — Google PAIR. [URL](https://pair.withgoogle.com/guidebook/). Claim (from the official PDF chapter *User Needs + Defining Success*): automate tasks that are unpleasant/scalable and have agreed-upon correctness; **augment** tasks people enjoy, that carry social capital, or where “correct” is contested. Also: onboard for calibrated (not maximal) trust; explain; support recovery. Latest edition adds generative-AI patterns. Relevance: first-party Google design guidance; automation-vs-augmentation is the decision Magentic-UI and Pierce later operationalize as coordination zones.

### C. Direct manipulation coming back (steering generative/agent output without only chat)

**DirectGPT: A Direct Manipulation Interface to Interact with Large Language Models** — Damien Masson, Sylvain Malacria, Géry Casiez, Daniel Vogel. CHI 2024. [arXiv](https://arxiv.org/abs/2310.03691); [ACM](https://doi.org/10.1145/3613904.3642462). Claim: chat-prompt UIs undo 40 years of direct-manipulation gains (indirect engagement, semantic/articulatory distance). DirectGPT maps selection/manipulation/undo to engineered prompts. Study: ~50% faster, 50% fewer and 72% shorter prompts vs ChatGPT for text/code/vector edits. Relevance: evidence that “agentic” work product (the artifact) should be the interface, not the transcript.

**AI-Instruments: Embodying Prompts as Instruments…** — CHI 2025. [arXiv HTML](https://arxiv.org/html/2502.18736v1); DOI 10.1145/3706598.3714259. Claim: reify prompts as reusable direct-manipulation instruments; reflection-in-intent and reflection-in-response; grounding from examples. 12-participant study on image generation. Relevance: same lineage as DirectGPT; relevant if an agent proposes listing copy/photos that the seller then *instruments* rather than re-prompts.

**Generative Agents: Interactive Simulacra of Human Behavior** — Joon Sung Park, Joseph C. O’Brien, Carrie J. Cai, Meredith Ringel Morris, Percy Liang, Michael S. Bernstein. UIST 2023. [arXiv](https://arxiv.org/abs/2304.03442); [ACM](https://doi.org/10.1145/3586183.3606763). Claim: LLM agents with memory stream, reflection, and planning produce believable individual and *emergent group* behavior in a Sims-like sandbox; users observe and intervene in natural language. Relevance: landmark for *agent behavior* and social prototyping, **not** for workplace job-agent UX. Stanford HAI write-up: [hai.stanford.edu](https://hai.stanford.edu/news/computational-agents-exhibit-believable-humanlike-behavior). Often cited in industry “agentic UX” roundups; the paper itself is about simulacra, not product UI patterns.

### D. Computer-using agents: lab publications (capability + safety UX, thin on visual design)

**Developing a computer use model** — Anthropic, 22 Oct 2024. [URL](https://www.anthropic.com/research/developing-computer-use). Claim: Claude uses screenshots + pixel-accurate cursor/keyboard like a person; trained on simple apps then generalized; OSWorld 14.9% vs ~7.7% next model vs ~70–75% human (those numbers are 2024; later papers report higher OSWorld scores). Safety: prompt injection via screen content; they argue shipping CUA at ASL-2 is better than waiting for higher-stakes models. UX-relevant failure modes they *show*: accidentally stopping a screen recording; wandering off a coding demo into Yellowstone photos; “flipbook” screenshots miss transient UI. API docs: [platform.claude.com computer use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool).

**Computer-Using Agent / Introducing Operator** — OpenAI, 2025. [CUA](https://openai.com/index/computer-using-agent/); [Operator](https://openai.com/index/introducing-operator/); [Operator System Card](https://openai.com/index/operator-system-card/). Claim: CUA combines GPT-4o vision + RL to operate GUIs without site-specific APIs. Operator is a research preview that **proactively asks the user to take over** for logins, payment details, CAPTCHAs. System card: user direction and oversight; supervised learning for perception/clicking, RL for reasoning/error correction. **CUA/Operator pages are first-party but product/research-preview prose, not CHI studies.** Later: ChatGPT agent unifies Operator’s GUI control with deep research ([OpenAI](https://openai.com/index/introducing-chatgpt-agent/)). Developer computer-use loop: [OpenAI docs](https://developers.openai.com/api/docs/guides/tools-computer-use).

**How agents are transforming work** — OpenAI, 2026. [URL](https://openai.com/index/how-agents-are-transforming-work/). Claim (internal deployment study): work unit shifts from single chat turns to **delegated, long-horizon, parallel agent runs**; at OpenAI, Codex overtook ChatGPT as the default work tool including non-engineering; p99 users generated >60 hours of Codex agent turns/day by June 2026. UX implication they describe rather than prescribe: people need UI for many concurrent jobs (status, review, archive) — consistent with Magentic-UI multi-tasking and Codex App Server event streams ([Codex harness](https://openai.com/index/unlocking-the-codex-harness/)). **Company research blog, not an independent RCT.**

### E. Workspace-like HITL (jobs with a human still on the hook)

**DoubleAgents: Human-Agent Alignment in a Socially Embedded Workflow** — arXiv:2509.12626 (2025, v3). [URL](https://arxiv.org/html/2509.12626v3). Claim: for tasks like organizing a seminar series (email, follow-ups, social stakes, hard-to-unsend), alignment is not a one-shot prompt. System: coordination agent + **dashboard that makes reasoning legible** + policy module that turns user edits into reusable policies, templates, and stop hooks. Lab (n=10, two days) + three live deployments: comfort offloading increased, but users still wanted control at uncertainty and context-dependent actions. Relevance: closest academic analogue to “agent does a job in a professional workspace, human stays accountable.” Not e-commerce listing, but the coordination/dashboard/stop-hook pattern is the transferable bit they actually measured.

**CHI 2026 Workshop: From Human-Human Collaboration to Human-Agent Collaboration** — SIGCHI program. [URL](https://programs.sigchi.org/chi/2026/program/content/214818); [workshop site](https://chi26workshop-human-agent-collaboration.hailab.io/). Claim: treat LLM agents as *remote collaborators* so CSCW constructs (common ground, workspace awareness, articulation work, mixed initiative, shared accountability) apply. Not a findings paper; it is evidence the CHI community has named this as a 2026 research agenda.

### F. First-party platform HIG (control, disclosure — generative, not fully agentic)

**Apple Human Interface Guidelines — Generative AI.** [URL](https://developer.apple.com/design/human-interface-guidelines/generative-ai/). Official page requires JS in this fetch environment; claims below are from the live HIG text returned by search-index extraction of that same URL (treat as HIG, not a third-party recap). Claim: keep people in control of decision-making; dismiss / revert / retry; **clearly identify when and where AI is used**; do not infer sensitive personal/cultural attributes when generating people; inclusive testing. Apple Intelligence resources point at this HIG ([Apple Developer](https://developer.apple.com/apple-intelligence/resources/)). Relevance: strongest consumer-platform constraint set on **agency and labeling**; little on multi-step computer-use agents.

### G. Deliberately thin / adjacent

**The Prompt Report** (Schulhoff et al., arXiv:2406.06608, 2024) — systematic survey of prompting techniques. [URL](https://arxiv.org/abs/2406.06608). **Mostly out of scope for UX:** it taxonomizes how to write prompts, not how people and agents share a workspace. Included only to record that it is *not* an agentic-UX paper despite frequent co-citation in industry lists.

**The Agency-First Framework / GAIA Heuristics** — *Electronics* 2026, DOI [10.3390/electronics15040877](https://doi.org/10.3390/electronics15040877). Claim: an “Agency Gap” between intent and output; ten heuristics; “productive friction” (slower but higher sense of agency) vs seamless speed. **Fetched DOI landing page; journal article, not CHI.** Useful as a counterweight to “make the agent invisible.”

## Design principles and patterns that keep recurring

Only items with a named owner:

- **Show what the system can do, and how well** — Amershi G1–G2; Apple HIG “identify when/where AI is used”; Zhu “Set Accurate Expectations.”
- **Time initiative to attention and risk; default reactive** — Horvitz timing; Amershi G3; Zhu “Manage Proactive Initiative”; Microsoft Agent UX “nudging more than notifying,” “Do Not Disturb.”
- **Efficient invoke / dismiss / correct / scope when uncertain** — Amershi G7–G10; Horvitz user invocation and graceful degradation.
- **Make status, intent, and uncertainty visible; don’t maximize trust** — Amershi G11; Microsoft Agent Core; PAIR calibrated trust; Apple revert/retry; Zhu “Make Intent Transparent” + “Embrace uncertainty” (Microsoft).
- **Negotiate shared control; autonomy is not a static level** — Horvitz mixed initiative; Johnson coactive OPD (observability, predictability, directability); Pierce coordination zones + **responsive salience**; Magentic-UI **co-planning / co-tasking / action guards**; Zhu “Negotiate Shared Control”; Shneiderman high-control + high-automation.
- **Handoff carries state, not just a button** — Magentic-UI co-tasking (user manipulates the agent’s browser, agent resumes); Operator asks user to take over for payment/CAPTCHA; DoubleAgents stop hooks. (Industry pattern libraries on “graceful handoff” were not used as evidence.)
- **Friction proportional to irreversibility** — Magentic-UI action approval; PAIR: don’t automate high-cost-of-error or high-social-capital tasks; Operator takeover on payments.
- **Put the work object in the UI, not only the chat log** — DirectGPT; AI-Instruments; Magentic-UI split view (transcript + live browser); Codex-style thread/diff/status (OpenAI harness post).
- **Memory that is inspectable and policy-like, not only chat history** — Amershi G12–G14; DoubleAgents policies/templates; Magentic-UI saved workflows; Zhu “Capture User Goals and Values in Memory.”
- **Design the agent-facing surface (AX)** — Biilmann; NN/g agents-as-users; web.dev semantic/stable UI. Separate from human Agent UX, but it determines whether computer-use agents succeed.

## Open problems / disagreements

- **Autonomy as goal vs control as goal.** Microsoft Magentic-UI and Shneiderman argue HITL remains necessary even as capability rises (agency, ambiguity, a changing world). Operator/CUA marketing aims at independent execution with takeover as exception. Pierce’s responsive salience tries to *move* between those poles automatically; their own users split between “too much communication” and “I want to approve the plan first.”
- **Invisible agent vs salient collaborator.** Microsoft Agent UX wants agents “mostly invisible” (Weiser). Magentic-UI, DoubleAgents, and DirectGPT make the agent’s plan/browser/object highly visible. Amazon explicitly treats salience as a design dimension, not a virtue.
- **Anthropomorphism.** Zhu: more human-likeness is not universally better; calibrate to task. CHI 2026 abstract *Trust Formation in AI Delegation* (N=900 + eye-tracking N=57): anthropomorphism can **reduce** trust in an explainable agent online, but combine with XAI in the lab if cognitive engagement is secured first ([SIGCHI program](https://programs.sigchi.org/chi/2026/program/content/222852)). **Program abstract only; paper not fetched.**
- **HITL sometimes hurts.** Magentic-UI related work cites the well-known result that human–AI teams can underperform either party via over/under-reliance — then argues agents are different because tasks are long and actions have side effects. That difference is a hypothesis they are building tools to test, not a settled law.
- **Who is the user?** Human-facing Agent UX vs AX-for-agents. Optimizing a marketplace for computer-use agents can conflict with business models that need human dwell time, regulatory pauses, or opaque pricing (NN/g).
- **Evaluation.** Capability benchmarks (OSWorld, SWE-bench, WebVoyager, GAIA) are advancing fast; Magentic-UI and Zhu argue they are insufficient because they ignore intervention cost, trust calibration, and recovery. There is no agreed UX metric for “was this agent worth the supervision?” (NN/g poses that as the practical question).
- **Predictability vs adaptivity.** Zhu: users adapt to systematic errors better than random ones, but rigidity reduces likability. Yang 2020: Level-4 adaptive systems are exactly where current UX methods fail.

## Gaps

- **Exact phrase “agentic UX”** is not an established CHI/TOCHI term as of this dump. Searching it mostly hits secondary blogs. The field is real; the label is marketing-ahead-of-vocabulary.
- **No primary source found on seller/catalogue/listing-from-photos workspaces.** Do not treat Magentic-UI shuttle booking or DoubleAgents seminar email as product specs for SnapSync. They only show that HITL job-agents have been studied in *other* multi-step, high-accountability tasks.
- **Apple HIG Generative AI** official page did not render without JavaScript in this environment; cited from the same apple.com URL via indexed extraction. Not a substitute for a designer reading the live HIG.
- **Pierce et al. 2026** and **Zhu et al. 2026** are arXiv preprints (May/2026). Treat claims as *proposed* mid-level theory until a venue version exists.
- **OpenAI Operator / CUA and “how agents are transforming work”** are first-party; some openai.com fetches were bot-challenged. Claims taken from pages that did return (CUA, Operator, system card, ChatGPT agent) plus search extracts of the work paper. Not independent ethnography.
- **Amershi 2019 ACM DL** is paywalled for full HTML in some views; the authors’ PDF on Horvitz’s site was used.
- **Maes 1994 CACM** not re-fetched in full here; cited via ACM DOI as lineage.
- **Salesforce / EY / Notch “agentic experience” posts** were not used as evidence. They popularize the phrase; they do not own empirical findings.
- **The Prompt Report** is not UX research.
- Computer-use **safety UX** (prompt injection from the screen, confirmation of irreversible actions) is discussed by Anthropic and Magentic-UI more than visual-design papers. That literature is still thin relative to the capability papers.

## Source list

### Academic papers and open PDFs

- https://erichorvitz.com/chi99horvitz.pdf
- https://doi.org/10.1145/302979.303030
- http://www.erichorvitz.com/Guidelines_Human_AI_Interaction.pdf
- https://doi.org/10.1145/3290605.3300233
- https://www.microsoft.com/en-us/research/project/guidelines-for-human-ai-interaction/
- https://dl.acm.org/doi/10.1145/3313831.3376301
- https://www.cs.nccu.edu.tw/~whliao/hci2024/HAIIchallenges.pdf
- https://www.cs.umd.edu/~ben/papers/Shn-Maes-v4n6-1997.pdf
- https://doi.org/10.1145/1120212.1120281
- https://dl.acm.org/doi/10.1145/176789.176792
- https://doi.org/10.5898/jhri.3.1.johnson
- https://aisel.aisnet.org/cgi/viewcontent.cgi?article=1136&context=thci
- https://www.hcil.umd.edu/human-centered-ai/
- https://doi.org/10.1093/oso/9780192845290.001.0001
- https://arxiv.org/abs/2304.03442
- https://doi.org/10.1145/3586183.3606763
- https://arxiv.org/abs/2310.03691
- https://doi.org/10.1145/3613904.3642462
- https://arxiv.org/html/2502.18736v1
- https://doi.org/10.1145/3706598.3714259
- https://arxiv.org/abs/2507.22358
- https://arxiv.org/html/2507.22358
- https://arxiv.org/abs/2606.09848
- https://arxiv.org/abs/2606.20630
- https://arxiv.org/html/2606.20630
- https://arxiv.org/html/2509.12626v3
- https://arxiv.org/abs/2406.06608
- https://doi.org/10.3390/electronics15040877
- https://link.springer.com/article/10.1007/s10462-025-11422-4
- https://programs.sigchi.org/chi/2026/program/content/214818
- https://chi26workshop-human-agent-collaboration.hailab.io/
- https://programs.sigchi.org/chi/2026/program/content/222852

### Lab / first-party design and product research

- https://www.microsoft.com/en-us/haxtoolkit/
- https://www.microsoft.com/en-us/research/project/hax-toolkit/
- https://microsoft.design/articles/ux-design-for-agents/
- https://www.microsoft.com/en-us/research/publication/magentic-ui-report/
- https://www.microsoft.com/en-us/research/blog/magentic-ui-an-experimental-human-centered-web-agent/
- https://github.com/microsoft/magentic-ui
- https://pair.withgoogle.com/guidebook/
- https://pair.withgoogle.com/chapter/People%20+%20AI%20Guidebook%20-%20All%20Chapters.pdf
- https://developer.apple.com/design/human-interface-guidelines/generative-ai/
- https://developer.apple.com/apple-intelligence/resources/
- https://www.amazon.science/blog/designing-ai-agents-that-know-when-to-step-back
- https://www.anthropic.com/research/developing-computer-use
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool
- https://openai.com/index/computer-using-agent/
- https://openai.com/index/introducing-operator/
- https://openai.com/index/operator-system-card/
- https://openai.com/index/introducing-chatgpt-agent/
- https://openai.com/index/how-agents-are-transforming-work/
- https://openai.com/index/unlocking-the-codex-harness/
- https://developers.openai.com/api/docs/guides/tools-computer-use
- https://biilmann.blog/articles/introducing-ax/
- https://www.netlify.com/agent-experience/
- https://www.nngroup.com/articles/definition-ai-agent/
- https://www.nngroup.com/articles/ai-agents-as-users/
- https://web.dev/articles/ai-agent-site-ux
- https://hai.stanford.edu/news/computational-agents-exhibit-believable-humanlike-behavior
