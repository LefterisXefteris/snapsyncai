# Self-hosted website agent harnesses

**Researched:** 2026-10-05  
**Question:** Which open-source harnesses can build a small multi-page storefront (layout plus product content) and run on hardware the seller hosts, so SnapSync could hand one a brief plus confirmed product facts and get a site back?  
**Confidence:** HIGH on licenses, last-commit dates, and interfaces that a README or docs page states. MEDIUM where the documented interface is a desktop or browser app and no library contract showed up in those pages.  
**Sources:** GitHub repos, READMEs, LICENSE files, and first-party docs linked below. Commit dates are the latest commit on the default branch. Hosted builders (Lovable, Replit, v0, Bolt.new) are out of scope.

## Bottom line

Two different jobs showed up, and SnapSync needs one of them.

**Prompt → website.** [Dyad](https://github.com/dyad-sh/dyad) and [bolt.diy](https://github.com/stackblitz-labs/bolt.diy) take a plain-language brief and write a real web project (Vite/React, or a choice of Node templates). Both are actively maintained. Both are apps the user runs (Electron, or a browser with a WebContainer). Neither documents a library call a FastAPI process can make.

**Point a coding agent at a template.** [OpenHands SDK](https://github.com/OpenHands/software-agent-sdk), [OpenCode](https://github.com/anomalyco/opencode), and [Cline](https://github.com/cline/cline) edit files in a directory you choose. OpenHands is a Python library. OpenCode is a headless HTTP server. Cline ships a TypeScript SDK and a one-shot CLI. They do not know what a storefront is. The host writes the brief, including listing copy, photo URLs, and confirmed facts.

SnapSync’s published Website is a JSON snapshot rendered by the existing Vite app at `{handle}.sites.snapsyncai.co.uk` (`docs/research/website-creation-state.md`). Every harness below emits something else: a generated project on disk, code in a preview pane, or edits inside a repo. Using one means a new path from “brief + facts” to “files SnapSync hosts.”

## What “serious” meant

Kept for a full card when, on 2026-10-05, the project was still committing, the license is a normal open-source license (or a split that is spelled out), and either it generates a web app from a prompt or it can be aimed at a directory and will write files. Everything else is in the last section.

## 1. Dyad

**What it is.** A local desktop app: the user describes an app, Dyad generates the code, and a live preview runs on that machine ([README](https://github.com/dyad-sh/dyad/blob/main/README.md), [product note](https://github.com/dyad-sh/dyad/blob/main/PRODUCT.md)).

**GitHub.** https://github.com/dyad-sh/dyad — last commit 2026-10-04 (`Bump to v1.18.0`).

**License.** Split. Everything outside `src/pro` is Apache-2.0 ([LICENSE](https://github.com/dyad-sh/dyad/blob/main/LICENSE)). Everything inside `src/pro` is [Functional Source License 1.1, Apache-2.0 future](https://github.com/dyad-sh/dyad/blob/main/src/pro/LICENSE) (FSL-1.1-ALv2). FSL permits internal use, non-commercial education, and non-commercial research. A competing use is offering the software, or substantially similar functionality, as a commercial product ([`src/pro/LICENSE`](https://github.com/dyad-sh/dyad/blob/main/src/pro/LICENSE)). The current local agent loop is documented under `src/pro` ([`docs/agent_architecture.md`](https://github.com/dyad-sh/dyad/blob/main/docs/agent_architecture.md)).

**Self-hosted.** Yes, as a desktop app on Mac or Windows ([README](https://github.com/dyad-sh/dyad/blob/main/README.md)). It is an Electron app: a sandboxed renderer and a Node main process that can touch the filesystem ([`docs/architecture.md`](https://github.com/dyad-sh/dyad/blob/main/docs/architecture.md)). No HTTP API or Python/JS library for a host app is described there.

**What it emits.** Files on disk, then a local Vite preview. New apps start from `scaffold/`, a Vite + React + TypeScript + React Router + Tailwind + shadcn project (`scaffold/package.json` has `react-router-dom`; [`scaffold/AI_RULES.md`](https://github.com/dyad-sh/dyad/blob/main/scaffold/AI_RULES.md) tells the model to keep routes in `src/App.tsx` and pages in `src/pages/`). The homepage uses “Ask Dyad to build an ecommerce store” as an example prompt ([dyad.sh](https://www.dyad.sh/)).

**How a host would hand it a brief.** The documented path is the chat box. The model sees the prompt plus, by default, the whole codebase, and replies with file writes. An older architecture note says the user approves, then the main process applies writes, deletes, and npm adds ([`docs/architecture.md`](https://github.com/dyad-sh/dyad/blob/main/docs/architecture.md)). The newer agent note says the loop now lives in `src/pro/main/ipc/handlers/local_agent/` and keeps calling the model until it stops using tools ([`docs/agent_architecture.md`](https://github.com/dyad-sh/dyad/blob/main/docs/agent_architecture.md)). A host app would have to drive that desktop UI, or reimplement the prompt against the scaffold. There is no documented “POST a brief, receive a directory.”

**Models.** Bring your own keys ([README](https://github.com/dyad-sh/dyad/blob/main/README.md)). The in-repo catalog keys include `openai`, `anthropic`, `google`, `vertex`, `openrouter`, `azure`, `xai`, `bedrock`, and `minimax` ([`src/ipc/shared/language_model_constants.ts`](https://github.com/dyad-sh/dyad/blob/main/src/ipc/shared/language_model_constants.ts)). An Ollama provider file is in the tree (`src/ipc/utils/ollama_provider.ts`). The marketing site also names LM Studio ([dyad.sh](https://www.dyad.sh/)).

**Fit.** Closest thing to “brief in, multi-page React app out” that stays on the seller’s machine. It does not plug into FastAPI. The agent loop SnapSync would be relying on is the FSL tree, which is the wrong license to copy into a commercial product that offers the same kind of app builder. The Apache-2.0 scaffold and file-apply path are a reference for the shape of the output, not a drop-in library.

## 2. bolt.diy

**What it is.** The open-source Bolt.new: prompt, run, edit, and deploy full-stack web apps, with a choice of LLM ([README](https://github.com/stackblitz-labs/bolt.diy/blob/main/README.md)).

**GitHub.** https://github.com/stackblitz-labs/bolt.diy — last commit 2026-10-05. (The older `coleam00/bolt.new-any-llm` name resolves to this repo.)

**License.** MIT ([GitHub license API](https://github.com/stackblitz-labs/bolt.diy/blob/main/LICENSE)).

**Self-hosted.** Yes, as an application: Node (`pnpm run dev`), Docker, or a desktop binary ([README](https://github.com/stackblitz-labs/bolt.diy/blob/main/README.md), [docs](https://stackblitz-labs.github.io/bolt.diy/)). The generation runs in the browser. The docs describe an integrated terminal “with WebContainer sandbox” and a live preview ([docs](https://stackblitz-labs.github.io/bolt.diy/)). That is a self-hosted UI, not a library inside another process.

**What it emits.** A Node project in the browser preview. Templates named in the docs include React, Vue, Angular, Next.js, and Astro. The user can download a ZIP, push to GitHub, or deploy to Netlify, Vercel, or GitHub Pages ([README](https://github.com/stackblitz-labs/bolt.diy/blob/main/README.md), [docs](https://stackblitz-labs.github.io/bolt.diy/)).

**How a host would hand it a brief.** The documented interface is the prompt box, including image attachments ([README](https://github.com/stackblitz-labs/bolt.diy/blob/main/README.md)). API keys go in `.env.local` or the in-app settings ([docs](https://stackblitz-labs.github.io/bolt.diy/)). No host-app endpoint for “submit brief, return files” is described on the README or the docs welcome page. A surrounding app would collect the ZIP or the GitHub push after a person uses the UI.

**Models.** Bring a key. The README lists OpenAI, Anthropic, Ollama, OpenRouter, Gemini, LM Studio, Mistral, xAI, Hugging Face, DeepSeek, Groq, Cohere, Together, Perplexity, Moonshot, Hyperbolic, GitHub Models, Amazon Bedrock, and OpenAI-compatible endpoints, via the Vercel AI SDK ([README](https://github.com/stackblitz-labs/bolt.diy/blob/main/README.md)).

**Fit.** MIT and active, and it really does turn a prompt into a multi-page web project. The runtime is a second web app with a browser sandbox, beside the Vite workspace. FastAPI cannot call it as a function. The artifact is a generated Node app, which the current `{handle}.sites.snapsyncai.co.uk` renderer does not serve.

## 3. OpenHands (SDK, not a website builder)

**What it is.** A coding agent. The Python SDK builds agents that edit files and run commands. The OpenHands repo itself is Agent Canvas, a self-hosted control panel for that agent and for other ACP agents ([SDK README](https://github.com/OpenHands/software-agent-sdk/blob/main/README.md), [OpenHands README](https://github.com/OpenHands/OpenHands/blob/main/README.md)). No separate “website builder” product is described in either README.

**GitHub.** https://github.com/OpenHands/software-agent-sdk and https://github.com/OpenHands/OpenHands — both pushed 2026-10-05. License MIT on both ([SDK](https://github.com/OpenHands/software-agent-sdk/blob/main/LICENSE), [canvas](https://github.com/OpenHands/OpenHands/blob/main/LICENSE)).

**Self-hosted.** Yes, as a library or as a service. `Conversation(agent=agent, workspace=cwd)` runs against a directory on the machine ([getting started](https://docs.openhands.dev/sdk/getting-started)). Optional packages run the same agent in Docker or on a remote Agent Server (`openhands-workspace`, `openhands-agent-server`). Agent Canvas is a separate UI: `npx`/`agent-canvas` on port 8000, or a Docker image, with projects mounted from a host directory ([OpenHands README](https://github.com/OpenHands/OpenHands/blob/main/README.md)). Canvas can also point at OpenHands Cloud; that path is optional.

**What it emits.** Whatever the prompt asks it to write in the workspace: files on disk, plus terminal output. The hello-world example writes `FACTS.txt` ([getting started](https://docs.openhands.dev/sdk/getting-started)). Pointed at a site template, the same tools can edit that template. It does not emit a preview URL by itself.

**How a host would hand it a brief.** In-process from Python:

```python
conversation = Conversation(agent=agent, workspace=cwd)
conversation.send_message("...")
conversation.run()
```

The message can include the brief, listing copy, photo URLs, and confirmed facts. The workspace should already contain the storefront template. Tools in the documented example are `TerminalTool`, `FileEditorTool`, and `TaskTrackerTool`. When the call returns, the host reads the workspace.

**Models.** An API key for any LiteLLM provider. Docs name Anthropic and OpenAI as the bring-your-own examples, and also an OpenHands Cloud key and a ChatGPT subscription login ([getting started](https://docs.openhands.dev/sdk/getting-started), [LLM architecture](https://docs.openhands.dev/sdk/arch/llm)).

**Fit.** The only candidate that is a Python library next to FastAPI. The host owns the prompt and the template directory. The agent is general-purpose, so page structure, palette, and “use these facts, invent nothing else” have to be in the message and the template. Agent Canvas is a developer UI, not the integration point.

## 4. OpenCode

**What it is.** A terminal coding agent with a headless HTTP server and a TypeScript SDK ([README](https://github.com/anomalyco/opencode/blob/dev/README.md), [server docs](https://opencode.ai/docs/server), [SDK docs](https://opencode.ai/docs/sdk)). The older `opencode-ai/opencode` repo is archived (last push 2025-09-18).

**GitHub.** https://github.com/anomalyco/opencode — pushed 2026-10-05. MIT ([LICENSE on `dev`](https://github.com/anomalyco/opencode/blob/dev/LICENSE)).

**Self-hosted.** Yes. `opencode serve` listens on `127.0.0.1:4096` by default and exposes OpenAPI at `/doc` ([server docs](https://opencode.ai/docs/server)). `createOpencode()` from `@opencode-ai/sdk` starts that server and a client ([SDK docs](https://opencode.ai/docs/sdk)). `opencode run --attach http://localhost:4096 "..."` sends one prompt to a server that is already up ([CLI docs](https://opencode.ai/docs/cli)).

**What it emits.** Edits in the working directory of the server. The built-in `build` agent is the full-access development agent; `plan` is read-only ([README](https://github.com/anomalyco/opencode/blob/dev/README.md)). The server can list and read files (`GET /file`, `GET /file/content`) and return the session diff (`GET /session/:id/diff`) ([server docs](https://opencode.ai/docs/server)).

**How a host would hand it a brief.** One-shot: `opencode run --dir <template-copy> --agent build "…brief…"`. `--dir` is “Directory to run in, or path on the remote server when attaching” ([CLI docs](https://opencode.ai/docs/cli)). Or start `opencode serve` in that directory and `POST /session`, then `POST /session/:id/message` with `{ model?, agent?, system?, parts }` and a text part ([server docs](https://opencode.ai/docs/server)). The documented `serve` flags are port, hostname, mDNS, and CORS, not a directory flag, so the process cwd is what selects the project. The host waits, then reads the directory. Optional HTTP basic auth is `OPENCODE_SERVER_PASSWORD`.

**Models.** A provider key in `provider/model` form. The providers page lists Anthropic, OpenAI, Google Vertex, Groq, Ollama, LM Studio, OpenRouter, Bedrock, Azure, and many others ([providers](https://opencode.ai/docs/providers)). The SDK config example sets `model: "anthropic/claude-3-5-sonnet-20241022"` ([SDK docs](https://opencode.ai/docs/sdk)).

**Fit.** A Node sidecar beside FastAPI, with a real HTTP contract. Same template-and-brief pattern as OpenHands. The process is Bun/Node, not an import inside `api-py`.

## 5. Cline

**What it is.** The same coding-agent core as an SDK, a CLI, a desktop app, and IDE extensions ([README](https://github.com/cline/cline/blob/main/README.md)).

**GitHub.** https://github.com/cline/cline — pushed 2026-10-05. Apache-2.0 ([LICENSE](https://github.com/cline/cline/blob/main/LICENSE)).

**Self-hosted.** Yes. `@cline/sdk` is described as the runtime to embed in your own products, CI, or automations ([SDK overview](https://docs.cline.bot/cline-sdk/overview)). The CLI is “fully headless for CI/CD and scripting” ([CLI README](https://github.com/cline/cline/blob/main/apps/cli/README.md)). Node.js 22 or later for the SDK. The CLI package ships platform binaries.

**What it emits.** File edits and shell commands in the project it is pointed at. The product README says it creates files and runs commands across the repo ([README](https://github.com/cline/cline/blob/main/README.md)). The SDK’s first sample only prints text (`agent.run("Explain what an SDK is...")`) ([SDK overview](https://docs.cline.bot/cline-sdk/overview)); file tools are the same core the CLI uses, not a separate website exporter.

**How a host would hand it a brief.** CLI, from the template directory: `cline "…brief and product facts…"`, or pipe a file (`cat brief.md | cline "…"`) ([CLI README](https://github.com/cline/cline/blob/main/apps/cli/README.md)). Or construct `new Agent({ providerId, modelId, apiKey })` and `agent.run(brief)` in a Node worker ([SDK overview](https://docs.cline.bot/cline-sdk/overview)). Auth can be an API key: `cline auth --provider anthropic --apikey … --modelid claude-sonnet-4-6`.

**Models.** Anthropic, OpenAI, Google, OpenRouter, Bedrock, Vertex, Cerebras, Groq, OpenAI-compatible endpoints, plus optional sign-in to Cline or a ChatGPT subscription ([CLI README](https://github.com/cline/cline/blob/main/apps/cli/README.md), [README](https://github.com/cline/cline/blob/main/README.md)).

**Fit.** Same job as OpenCode: a Node worker pointed at a template. The SDK page is the most direct “embed this in a product” statement of the three coding agents. It still does not return a SnapSync storefront snapshot.

## Worth a second look

These five are the ones that are alive, licensed in a way a host can read, and either generate a web project or accept a directory plus a prompt.

| Candidate | License | Output | Self-hosted as |
| --- | --- | --- | --- |
| [Dyad](https://github.com/dyad-sh/dyad) | Apache-2.0 outside `src/pro`; FSL-1.1-ALv2 inside `src/pro`, which is where the current agent loop is documented | Vite/React app on disk, local preview | Desktop app |
| [bolt.diy](https://github.com/stackblitz-labs/bolt.diy) | MIT | Node web project (React, Next.js, and other templates), ZIP or GitHub | Browser app you run yourself |
| [OpenHands SDK](https://github.com/OpenHands/software-agent-sdk) | MIT | Files in a workspace directory | Python library or Agent Server |
| [OpenCode](https://github.com/anomalyco/opencode) | MIT | Files in the server’s working directory | Headless HTTP server |
| [Cline](https://github.com/cline/cline) | Apache-2.0 | Files in the project directory | TypeScript SDK or one-shot CLI |

Dyad and bolt.diy are the prompt-to-website tools. OpenHands, OpenCode, and Cline are the ones a host process can call, if SnapSync is willing to own a template and a brief. No winner follows from the docs alone: the first pair matches the job and misses the embedding shape; the second pair matches the embedding shape and will build a site only if the prompt and template say so.

## Looked at, and why they dropped

**Wrong input or wrong artifact.**

- **screenshot-to-code** ([abi/screenshot-to-code](https://github.com/abi/screenshot-to-code), MIT, pushed 2026-09-29). Self-hosts as FastAPI plus a Vite frontend and returns HTML, React, Vue, Bootstrap, or Ionic from a screenshot, mockup, Figma frame, or screen recording ([README](https://github.com/abi/screenshot-to-code/blob/main/README.md)). Needs one of `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY`. SnapSync’s input is listing copy and confirmed facts, not a picture of a finished site. The result stays in the app UI.
- **OpenUI** ([wandb/openui](https://github.com/wandb/openui), Apache-2.0, last commit 2026-06-30, a dependency-pin merge). `python -m openui` or the Docker image on port 7878. You describe a UI and see HTML, then convert to React, Svelte, or Web Components ([README](https://github.com/wandb/openui/blob/main/README.md)). Keys: OpenAI, Groq, Gemini, Anthropic, Cohere, Mistral, an OpenAI-compatible endpoint, or Ollama. That is a component preview, not a multi-page site written to disk.
- **Onlook** ([onlook-dev/onlook](https://github.com/onlook-dev/onlook), Apache-2.0, last commit 2026-07-22). A visual editor for Next.js + Tailwind. Creating an app loads code into a web container; AI chat can edit it ([README](https://github.com/onlook-dev/onlook/blob/main/README.md)). The stack listed there includes Supabase, OpenRouter, and CodeSandbox. The README points new users at a hosted waitlist. It is an editor with cloud pieces, not a library that returns files to FastAPI.
- **stagewise** ([stagewise-io/stagewise](https://github.com/stagewise-io/stagewise), AGPL-3.0, release commit 2026-09-30). An agentic IDE you download. Bring a provider key or a stagewise account ([README](https://github.com/stagewise-io/stagewise/blob/main/README.md)). AGPL plus a desktop IDE is a poor fit for code linked into a closed FastAPI/Vite product.

**Needs someone else’s sandbox or crawler, so the agent is not only on the seller’s machine.**

- **Open Lovable** ([firecrawl/open-lovable](https://github.com/firecrawl/open-lovable), MIT, last commit 2025-11-19). A Firecrawl example app: chat to build React apps. Setup requires `FIRECRAWL_API_KEY` and a sandbox of either Vercel or E2B ([README](https://github.com/firecrawl/open-lovable/blob/main/README.md)). The name is a clone. The run path still calls Firecrawl and a hosted sandbox. Stale since November 2025.
- **Fragments** ([e2b-dev/fragments](https://github.com/e2b-dev/fragments), Apache-2.0, last commit 2026-09-30). A Next.js template that generates small apps (Next.js, Vue, Streamlit, Gradio, or a Python interpreter) with the E2B code-interpreter SDK. `E2B_API_KEY` is required ([README](https://github.com/e2b-dev/fragments/blob/main/README.md)). The UI can be self-hosted; execution is E2B’s cloud.
- **Llama Coder** ([Nutlope/llamacoder](https://github.com/Nutlope/llamacoder), MIT, last commit 2026-09-15). One prompt to a small app, previewed in the browser with esbuild-wasm. Requires a Together AI key and a Postgres URL ([README](https://github.com/Nutlope/llamacoder/blob/main/README.md)). Inference is Together’s, and the output is an in-browser artifact.

**Coding agents that do the same job as OpenHands, OpenCode, or Cline, without a clearer embed path.**

- **goose** ([aaif-goose/goose](https://github.com/aaif-goose/goose), Apache-2.0 per the [GitHub license API](https://github.com/aaif-goose/goose/blob/main/LICENSE); the docs index says both “MIT” in its feature list and Apache-2.0 in its About section). Pushed 2026-10-05. Desktop app, CLI, and a README line that says “an API to embed it anywhere” ([README](https://github.com/aaif-goose/goose/blob/main/README.md)). The verified one-shot is `goose run --instructions plan.md` ([CLI docs](https://goose-docs.ai/docs/guides/goose-cli-commands)). Providers include Anthropic, OpenAI, Google, Ollama, OpenRouter, Azure, and Bedrock. It edits files. It was dropped from the five because the embed contract that was actually specified is the CLI, which OpenCode and Cline already cover with HTTP and an SDK.
- **Codex CLI** ([openai/codex](https://github.com/openai/codex), Apache-2.0, pushed 2026-10-05). A local terminal agent. The README recommends signing in with ChatGPT; an API key is extra setup ([README](https://github.com/openai/codex/blob/main/README.md)). The cloud agent at chatgpt.com/codex is a different product. Dropped as another repo-editing CLI, with the recommended auth on a ChatGPT plan.
- **Gemini CLI** ([google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli), Apache-2.0, pushed 2026-10-05). Terminal agent for Gemini, with file and shell tools ([README](https://github.com/google-gemini/gemini-cli/blob/main/README.md)). Same class.
- **Kilo Code** ([Kilo-Org/kilocode](https://github.com/Kilo-Org/kilocode), MIT, pushed 2026-10-05). VS Code, JetBrains, and a CLI. The README says you can start without bringing an API key, against 500+ models at provider rates ([README](https://github.com/Kilo-Org/kilocode/blob/main/README.md)). IDE-and-CLI coding agent.
- **Aider** ([Aider-AI/aider](https://github.com/Aider-AI/aider), Apache-2.0). Last commit 2026-05-22. `aider --message "…"` edits files and exits, and there is a Python `Coder.create()` example ([scripting](https://aider.chat/docs/scripting.html)). That page says the Python scripting API is not officially supported. Many providers, including Ollama ([README](https://github.com/Aider-AI/aider/blob/main/README.md)). Dropped for the stall and the unsupported library surface.
- **Continue** ([continuedev/continue](https://github.com/continuedev/continue), Apache-2.0). The README states the repository is no longer actively maintained. Last commit found was 2026-07-21, a docs change. CLI, VS Code, and JetBrains only ([README](https://github.com/continuedev/continue/blob/main/README.md)).
- **Roo Code** ([RooCodeInc/Roo-Code](https://github.com/RooCodeInc/Roo-Code), Apache-2.0) is archived. Last push 2026-05-15.
- **SWE-agent** ([SWE-agent/SWE-agent](https://github.com/SWE-agent/SWE-agent), MIT, pushed 2026-09-28). Takes a GitHub issue and tries to fix it ([repo description](https://github.com/SWE-agent/SWE-agent)). Issue fixer, not a site generator.

**Stale, archived, or pointed at a hosted successor.**

- **gpt-engineer** ([AntonOsika/gpt-engineer](https://github.com/AntonOsika/gpt-engineer), MIT) is archived. Last commit 2024-11-17. The README tells readers to use the managed service at gptengineer.app, or Aider for a hackable CLI. The GitHub description calls it the precursor to lovable.dev. It did take a `prompt` file in an empty directory and write code (`gpte <project_dir>`), with `OPENAI_API_KEY` ([README](https://github.com/AntonOsika/gpt-engineer/blob/main/README.md)). The open-source line stopped there. Lovable, the company’s hosted product, is out of scope.
- **GPT Pilot** ([Pythagora-io/gpt-pilot](https://github.com/Pythagora-io/gpt-pilot)). FSL-1.1-MIT ([LICENSE](https://github.com/Pythagora-io/gpt-pilot/blob/main/LICENSE)). The README says it is no longer maintained, and that a credential-stealing payload was in the tree from August 2025 until 11 June 2026. Last commit 2026-06-12 is the cleanup, not new development.
- **Devika** ([stitionai/devika](https://github.com/stitionai/devika), MIT). Last commit 2025-09-25. The README calls it early/experimental and points at opcode.sh as the next iteration.
- **smol-developer** ([smol-ai/developer](https://github.com/smol-ai/developer)). Last commit 2023-09-25. The old pitch was an embeddable developer agent. Nothing current.
- **MetaGPT** ([FoundationAgents/MetaGPT](https://github.com/FoundationAgents/MetaGPT), MIT). Last commit 2026-01-21. A multi-agent “software company” framework. The README’s 2025 news is the hosted product at mgx.dev. Not a website generator you call from FastAPI.

## Unknowns

- Dyad and bolt.diy may have an undocumented IPC or internal route a determined embedder could call. It is not in the README, the Dyad architecture notes, or the bolt.diy docs welcome page.
- Dyad’s older architecture note still describes file application in `src/ipc/processors/response_processor.ts` (outside `src/pro`). The newer agent note says the loop that decides those calls lives under `src/pro`. Which path the default chat uses was not re-traced past those two docs.
- goose’s README says “API.” The page that was checked specifies `goose run`, not a library import.
- None of these projects write SnapSync’s `websites` row. A second look still has to decide what the storefront host would serve.
