# Tokenoptimierte Agenten-Setups für Software-, Web- und Spieleentwicklung

## Zielbild: Was “maximale Token-Effizienz” bei Agenten wirklich bedeutet

Token-Effizienz ist in der Praxis **nicht** nur “günstige Tokens”, sondern der Quotient aus **(gelöster Arbeit / Tokens / Zeit / Fehlerrate)**. In Agent-Workflows entstehen die größten Token-Kosten typischerweise nicht durch ein einzelnes “großes” Modell, sondern durch wiederholte Wiederholungen: zu viel Kontext im Prompt, unnötige Reflexions-/Kritikschleifen, und das erneute “Erklären” der Codebase in jeder Session.

Ein tokenoptimiertes Setup erreicht deshalb drei Kernziele:

Erstens: **Context-Hygiene**. Tools müssen aus Repo/Logs/Docs nur das Relevante ziehen. Cline macht genau das explizit: Es analysiert Projektstruktur und ASTs, sucht via Regex und liest gezielt relevante Dateien, um den Kontext klein zu halten und trotzdem große Projekte bedienen zu können. citeturn20view0 Aider verfolgt denselben Zweck über eine “Repository map”, die die wichtigsten Klassen/Funktionen und Signaturen komprimiert und in ein Token-Budget packt (Standard-Budget u. a. über `--map-tokens`). citeturn3search1turn3search5

Zweitens: **Verifikation statt Selbstgespräche**. Token-effiziente “Selbstkorrektur” heißt: erst deterministische Checks (Build/Tests/Lint), dann gezielte Review-Prompts über Diffs. Codex ist dafür konzipiert, in isolierten Umgebungen Befehle wie Tests, Lint und Type-Checks auszuführen und Belege (Terminal-Logs/Test-Outputs) zur Nachvollziehbarkeit zu liefern. citeturn17view0 Auch CI-nahe Tools wie Continue lassen Agents als GitHub-Statuschecks auf PRs laufen (grün/rot + Diff-Vorschlag), was “kritische Gegenmeinung” mit minimalem Kontext (PR-Diff) ermöglicht. citeturn18view1

Drittens: **Modell-Routing und Preisfeatures**. Tokenpreise, Caching und Batch-Funktionen werden erst “spürbar”, wenn man Aufgaben strikt in kleine Rollen segmentiert und billige Modelle den Default machen lässt. OpenAI und Google bieten hier harte Hebel: OpenAI hat z. B. stark vergünstigte “cached input”-Rates (bei GPT‑5.4: $2.50/M Input vs. $0.25/M Cached Input; bei GPT‑5.4 nano: $0.20/M vs. $0.02/M). citeturn13view0 Google benennt Gemini 3.1 Flash‑Lite sogar als “most cost-efficient model” für high-volume agentic tasks und weist Standard-/Batch-Preise aus. citeturn10view1

## Tool-Landschaft: IDE-/Editor-Agenten, die Kontext & Tokens gut managen

Wenn du “Software/Web/Spiele” abdeckst, brauchst du typischerweise **zwei Schienen**: (a) In-IDE Agenten für schnelle Iteration und (b) asynchrone/CI-Agenten für Review, Security, Docs, Regression.

**OpenAI Codex (IDE/CLI/Cloud)** ist attraktiv, wenn du bereits ChatGPT Business hast. Offiziell ist Codex in ChatGPT Plus/Pro/Business/Edu/Enterprise enthalten; die IDE-Extension erlaubt es, mit Editor-Kontext (offene Dateien, Selektionen, `@file`) kürzere Prompts zu schreiben, Modelle zu wechseln und den “Reasoning effort” (low/medium/high) zu steuern. citeturn5view1turn5view2 In der Cloud-Variante läuft jede Aufgabe in einer isolierten Sandbox, in der das Repo vorliegt und Commands/Tests ausführbar sind. Zusätzlich kann Codex über eine repo-lokale **AGENTS.md** gesteuert werden (z. B. Navigationshinweise, Testkommandos). citeturn17view0

**Cline (VS Code Extension)** ist stark, wenn du maximale Provider-Flexibilität willst (OpenAI, Gemini, OpenRouter, lokale Modelle über LM Studio/Ollama etc.) und strikt “human-in-the-loop” bleiben möchtest. Es betont explizit, dass es Kontext gezielt einspeist (AST/Regex/Dateilesen) und Token-/Kosten pro Task-Loop trackt. Es bringt zudem Browser-Automation für Web-Debugging (Screenshots/Console logs) und MCP-Tooling mit. citeturn20view0

**Continue (VS Code + CI Checks)** ist besonders für Token-Effizienz interessant, weil es Kontextanbieter (`@codebase`, `@diff`, `@folder`, `@terminal`, `@url`) und MCP-Server (z. B. Memory) als “standardisierte Kontextzufuhr” nutzt. citeturn18view0 Der zweite Hebel: Continue kann Agents auf jedem Pull Request als Statuscheck ausführen; jeder Agent ist eine Markdown-Datei im Repo (`.continue/checks/`). Das ist extrem token-sparend, weil Review auf Diffs und klare Checklisten fokussiert werden kann. citeturn18view1

**Kilo Code (VS Code, Multi-Model, Agent Manager)** fokussiert sich auf Multi-Modell-Workflows + Governance. Laut Doku basiert die neue Extension auf einem CLI-Core, startet `kilo serve` im Hintergrund (HTTP+SSE), nutzt JSONC-Konfig, bietet granular permissions, Agents als Markdown (`.kilo/agents/*.md`) und explizit “multi-model comparison” im Agent Manager. citeturn19view0 Der Marketplace-Text betont außerdem Dinge wie “checks its own work”, MCP-Server-Marketplace und “API keys optional”. citeturn19view1 Für Token-Effizienz ist das interessant, weil du A/B-Tests zwischen Modellen in **kleinen** Rollen fahren kannst, statt alles auf ein teures Modell zu werfen.

**GitHub Copilot Agents (VS Code / Visual Studio / Cloud/PR)** ist relevant, wenn du ohnehin GitHub-zentriert arbeitest. Microsoft beschreibt, dass Agents lokal in VS Code, im Hintergrund für autonome Tasks oder in der Cloud für PR-basierte Kollaboration laufen können; außerdem werden explizit Third-Party Agents (u. a. Anthropic/OpenAI) erwähnt. citeturn15search0 Für MCP-Ökosysteme ist wichtig: GitHub meldete zuletzt, dass MCP-Server, die in VS Code konfiguriert sind, auch in Copilot CLI und Claude-Agent-Sessions funktionieren. citeturn15search4

**AI-native VS Code Forks (Cursor, Windsurf) und Codebase Indexing**: Für Tokens spielt Codebase Indexing eine große Rolle, weil es “nur relevante Snippets” in den Prompt injiziert. Cursor nennt Semantic Search als starken Performance-Treiber und berichtet über messbare Verbesserungen (u. a. höhere Accuracy/Retention) durch Indexing. citeturn15search2 Für Token-Effizienz heißt das: weniger “paste the repo”-Prompts, mehr Retrieval.

## Agenten-Frameworks und Context-Management: Bausteine für echte Multi-Agent-Systeme

Für “Agenten, die sich gegenseitig korrigieren” brauchst du Orchestrierung, State/Memories, und standardisierte Tool-Anbindung.

**MCP (Model Context Protocol)** ist hierfür mittlerweile ein zentraler Standard: Anthropic hat MCP als Standard zur Verbindung von Assistants mit Daten/Tools open-sourced; Spezifikation und Referenzschema werden über modelcontextprotocol.io und GitHub gepflegt. citeturn3search4turn3search0turn3search8 In der Praxis ist MCP wertvoll, weil du Connector-Logik (z. B. Jira/GitHub/Notion/Files/Search) als **Tool-Server** kapselst und dieselbe Tool-Schicht in VS Code Agenten, CI-Agenten und Chat-Agents wiederverwenden kannst (Cline/Continue/Copilot erwähnen MCP-Integration direkt). citeturn20view0turn18view0turn15search4

**OpenAI Agents SDK**: Wenn du eigene Orchestrierung in Code willst (Handoffs, Tools, Guardrails, State), ist das Agents SDK explizit dafür gedacht, dass deine App die Orchestrierung und Tool-Ausführung besitzt. citeturn13view2turn1search0 Für Multi-Agent-Routing ist die Doku klar: man kann Outputs strukturieren (Routing) oder Agenten chainen (“research → outline → write → critique → improve”). citeturn1search4 Außerdem ist das SDK laut Repo “provider-agnostic” und unterstützt OpenAI APIs sowie viele andere LLMs über Adapter. citeturn1search8

**LangGraph** ist nützlich, wenn du “dauerhafte” Agent-Workflows, Schleifen, State und Human-in-the-loop auf Graphen abbilden willst. LangChain beschreibt LangGraph als Framework für stateful, multi-actor Anwendungen und betont Memory/Persistenz. citeturn1search5turn1search1 Token-Effizienz entsteht hier oft durch **kontrollierte Loops**: du baust Schleifen, die nur dann weitere Tokens verbrennen, wenn Tests fehlschlagen oder Review-Checks rote Flags setzen.

**Microsoft Semantic Kernel / Microsoft Agent Framework**: Wenn du im Microsoft-Ökosystem bist, ist Semantic Kernel explizit “model-agnostic” für Agenten/Multi-Agent-Systeme. citeturn1search14 Microsoft beschreibt Agent Orchestration als abstrahierend über Kommunikation/Koordination/Aggregation, um zwischen Orchestrationsmustern zu wechseln. citeturn1search10 (Nebenbei: In SK werden ältere “Planner” zugunsten von Function Calling eher zurückgestellt.) citeturn1search2

**CrewAI / AutoGen**: CrewAI positioniert sich als schlankes Framework für role-based Multi-Agent-Automation. citeturn3search3turn3search15 AutoGen ist laut Microsoft GitHub inzwischen “maintenance mode”, und Microsoft empfiehlt für neue Projekte das “Microsoft Agent Framework”. citeturn1search3

**Coding-Agent Plattformen (OpenHands, Aider)**: OpenHands positioniert sich als offene, modellagnostische Plattform für (Cloud-)Coding-Agents und bietet SDK/CLI. citeturn3search2turn3search6 Aider ist besonders spannend für Token-Effizienz im Terminal, weil es über Repo-Map (graph-basiert) Kontext in ein Tokenbudget optimiert. citeturn3search1turn3search5

## Modelle und Provider: Kosten-/Token-Realität und ein Routing-Ansatz, der wirklich spart

### Preisanker für “billige Arbeiter” vs. “teure Denker”

Wenn du “maximale Token-Effizienz” willst, musst du die Basiskosten pro Rolle kennen und zusätzlich Caching/Batch nutzen.

Auf OpenAI-Seite sind die list prices (Standard) sehr klar: GPT‑5.4 $2.50/M Input, $15/M Output; GPT‑5.4 mini $0.75/M Input, $4.50/M Output; GPT‑5.4 nano $0.20/M Input, $1.25/M Output. Cached input ist jeweils grob 10× günstiger (z. B. $0.25/M bei GPT‑5.4). citeturn13view0 Zusätzlich gibt es Batch mit 50% Ersparnis und Flex/Priority Tiers im offiziellen Pricing-Dokument. citeturn13view0turn26view1

Auf Google-Seite ist Gemini 3.1 Flash‑Lite Preview explizit als “most cost-efficient model” für high-volume agentic tasks beschrieben und hat sehr niedrige Tokenpreise, inkl. Batch-Variante. citeturn10view1 Gemini 3.1 Pro Preview ist deutlich teurer und staffelt sogar nach Promptgröße (≤200k vs. >200k Tokens) – ein Hinweis, dass du Kontext über Retrieval klein halten solltest. citeturn11view1

Wichtig: Du hast zusätzlich **Google AI Pro** in den Gemini Apps. Google beschreibt, dass Gemini Apps Modelle/Funktionen je nach Plan limitieren; Limits können sich ändern, und es gibt u. a. Limits für Deep Research und Scheduled actions. citeturn8view0 Das ist super für “gratis” Heavy-Reasoning in der UI, aber weniger planbar für Automationen (APIs sind besser steuerbar).

### “Pi ist token-effektiv” – Ein Reality-Check

Du hast gehört, Pi sei token-effektiv. Aus Kostensicht ist Pi (Inflection 3 Pi) über OpenRouter **nicht** besonders günstig: $2.50/M Input und $10/M Output bei 8k Kontext. citeturn24view0 Inflection positioniert Pi außerdem eher als Modell mit Backstory/Emotional Intelligence/Productivity; für robuste Instruktions- und JSON-Tasks gibt es bei Inflection separat “Productivity (3.0)”. citeturn22view0 Für reine Coding-Agent-Rollen (Patch/Refactor/Test-Loop) sind daher meist günstigere “mini/nano/flash-lite” Modelle die effizienteren Default-Arbeiter.

### Kostenlose Kontingente / “Small Tasks” legal abgreifen

Für kleine Aufgaben kannst du (legal) mehrere “Free Paths” kombinieren:

OpenRouter betreibt eine offizielle “Free Models”-Collection; Rankings werden (laut Seite) in April 2026 aktualisiert und es gibt mit `openrouter/free` sogar einen Router, der automatisch ein passendes Free-Modell auswählt. citeturn23view0 Das eignet sich für Klassifikation, Umformulierungen, Commit-Message-Entwürfe, triviale Regex-Generierung etc. (alles, wo Fehler billig sind).

Für Web-Recherche/Extraction kannst du Freikontingente von Scraping/Research APIs nutzen statt LLM-Tokens zu verbrennen. Firecrawl nennt z. B. 500 kostenlose “scraped pages” als Einstieg. citeturn14search3 Tavily beschreibt eine Free-Plan-Option und zeigt in den Docs ein Credit-Modell (u. a. Mini/Pro). citeturn14search4turn14search8 Exa hat zuletzt (März 2026) das Pricing gebündelt und Content für 10 Resultate pro Request inkludiert, was die “Search→Fetch”-Tokenlast reduziert. citeturn14search1

Für embeddings/indexing (Context-Retrieval) ist außerdem die Gemini API auffällig hilfreich: Gemini Embedding und Gemini Embedding 2 Preview zeigen explizit “Free of charge” im Free Tier. citeturn8view1

## Vier “perfekte” tokenoptimierte Setups mit Rollen, Tools und Modellzuweisung

Die Setups sind bewusst **komplementär**. Du kannst auch hybrid arbeiten (z. B. Setup A in der IDE + Setup C in CI).

### Setup mit maximaler Token-Effizienz in VS Code: Cline als Executor, Continue als Context-/CI-Schiene

**Warum das token-effizient ist:** Cline reduziert Kontext aktiv (AST/Regex/selektives Lesen) und trackt Tokens/Kosten pro Task; Continue liefert “Context Providers” und eine CI-basierte Kritiker-Schicht über PR-Diffs. citeturn20view0turn18view0turn18view1

**Tooling-Kern**
Cline (Act/Plan) für “machen” (Terminal, Browser, multi-step) + Continue für “fragen/auto-complete/retrieval/PR-checks”. citeturn20view0turn18view1 MCP als gemeinsame Tool-Schicht (Memory, Jira, GitHub, Doku). citeturn3search0turn18view0turn20view0

**Agenten-Rollen und Modellzuweisung (tokenoptimiert)**
Der Trick ist: **teure Modelle nur dann**, wenn Budget-Modelle scheitern (Tests rot, Reviewer findet harte Logikfehler).

- **Router/Task-Triage (Default):** Gemini 3.1 Flash‑Lite (billig, explizit für high-volume agentic tasks) oder OpenAI GPT‑5.4 nano (sehr günstig). citeturn10view1turn13view0  
- **Coder/Implementer:** OpenAI GPT‑5.4 mini (Coding/Subagents) oder bei “riesigen” Codebasen/Long Context: hochkontextfähige Modelle im Continue-Ökosystem (Continue listet z. B. Gemini 2.5 Pro/ OpenAI GPT‑4.1 als Optionen). citeturn13view0turn18view0  
- **Reviewer/Critic (anders als Coder):** Wenn Coder OpenAI ist, Reviewer Gemini (Flash‑Lite) oder umgekehrt, um Fehlerkorrelation zu senken.  
- **Docs-Agent:** wieder Flash‑Lite oder GPT‑5.4 nano; arbeitet nur auf Diff + Doc-TOC statt vollem Repo.

**Recherche-Stack (tokenarm)**
Für Web-Recherche statt “LLM hallucination”: Tavily oder Exa fürs strukturierte Fetching; Firecrawl wenn du viele Seiten extrahieren willst und das Freikontingent nutzen möchtest. citeturn14search1turn14search3turn14search8

**Proaktive Selbstkorrektur ohne Token-Explosion**
- “Coder” darf *nur* patchen + Tests starten.  
- Wenn Tests fehlschlagen, bekommt er **nur** relevante Logs + betroffene Dateien.  
- Erst wenn nach 2 Iterationen rot bleibt, schaltet der Router auf ein stärkeres Modell hoch.

### Setup mit niedrigster Komplexität und guter Governance: ChatGPT Business + Codex (IDE/Cloud) als Hauptagent, Continue als PR-Korrektiv

**Warum das token-effizient ist:** Du nutzt Codex innerhalb deiner Business-Umgebung (inkl. Datenschutz-Benefits) und gibst Codex eine **AGENTS.md** im Repo, damit er nicht jedes Mal “How to run tests” erfragen muss; Continue übernimmt PR-Checks als günstige, standardisierte “Zweitmeinung”. citeturn17view0turn18view1turn7view2

**Tooling-Kern**
- Codex in VS Code via Codex IDE Extension; dort kannst du mit Editor-Kontext kurzer prompten und Reasoning effort steuern. citeturn5view1  
- Delegation größerer Tasks an Codex Cloud Sandbox (Repo vorhanden, Commands/Tests/Lint möglich). citeturn17view0turn5view2  
- Continue PR Checks (`.continue/checks/`) als “perfekter Reviewer”, weil er im Pull Request exakt die Checkliste abspult. citeturn18view1

**Agenten-Protokoll**
- **Spec-Agent:** schreibt eine kurze Spezifikation/Acceptance Criteria (AC) und legt sie im Repo (z. B. `/docs/specs/<ticket>.md`) ab.  
- **Implementer-Agent (Codex):** arbeitet strikt gegen die Spec und führt Tests aus; Codex kann Terminal-Logs/Test-Outputs als Nachweis liefern. citeturn17view0  
- **PR-Reviewer-Agent (Continue):** Security/Style/Regression Checks auf PR. citeturn18view1  
- **Doc-Agent:** aktualisiert README/API-Doku basierend auf Diff.

**Kosten-/Token-Hebel**
- Reasoning effort in Codex bewusst runterdrehen für “mechanische” Tasks (Rename/Refactor/Test-writing) und nur für Architektur hoch. (Die IDE-Doku beschreibt explizit low/medium/high als Trade-off.) citeturn5view1  
- Wenn du Codex zusätzlich über Credits nutzt: OpenAI stellt auf tokenbasierte Rates um (Business & New Enterprise) und zählt Input/Cached/Output getrennt; das belohnt konsequentes Caching/Context-Reuse. citeturn13view1  
- Business-Plan: “Content is used to train our models” ist laut Pricing für Business **No** (relevant, wenn du intern/kommerziell entwickelst). citeturn7view2

### Setup für Multi-Agent-Teams in Code: OpenAI Agents SDK oder LangGraph als Orchestrator, dazu MCP + CI-Agents

**Warum das token-effizient ist:** Du baust ein System, das Zustände und Artefakte (Summaries, Repo-Metadata, Checkergebnisse) persistiert, statt jedes Mal im Prompt neu aufzubauen. OpenAI Agents SDK ist dafür gedacht, dass du Orchestrierung/Tool-Ausführung/State in deiner App kontrollierst; LangGraph fokussiert stateful multi-actor Graphen. citeturn13view2turn1search5turn1search1

**Bausteine**
- Orchestrator: OpenAI Agents SDK (Handoffs, Guardrails, Tooling) oder LangGraph (Graph + Memory/Persistenz). citeturn13view2turn1search4turn1search5  
- Tool Layer: MCP Servers für Files, GitHub, Issue-Tracker, Doku-Speicher, Memory. citeturn3search0turn3search4  
- CI-Korrektiv: Continue Checks als “Zweitmeinung” und “Policy Enforcer” direkt im PR. citeturn18view1

**Agenten-Rollen (Beispiel für Software/Web/Spiele)**
- **Planner (billig):** erstellt Task-Graph, ordnet Tools zu, entscheidet Modell-Eskalation (Flash‑Lite oder GPT‑5.4 nano). citeturn10view1turn13view0  
- **Repo-Scout:** nutzt File-/Code Search + Embeddings, erstellt eine kompakte “Working Set Summary” (persistiert).  
- **Implementer:** GPT‑5.4 mini als Default für Code-Patches. citeturn13view0  
- **Verifier:** führt Tests/Build/Lint aus, extrahiert nur die relevanten Fehlstellen in ein kurzes “Failure Brief”.  
- **Critic:** prüft Patch + Failure Brief; nutzt anderes Modell als Implementer.  
- **Doc-Scribe:** aktualisiert Doku/Changelog/ADR.

**Token-Spartrick**
Statt “Critic loop forever”: Guardrail “max 1 critique pass”, danach deterministische Tests. OpenAI selbst beschreibt Multi-Agent-Chaining (inkl. Kritik und Verbesserung) als Pattern – du implementierst es aber konditional, nicht immer. citeturn1search4

### Setup für “Agent aus der Hosentasche” und Parallelisierung: OpenClaw Gateway + Routing zu billigen Modellen

**Warum das token-effizient sein kann:** Du verschiebst Koordination/Quick-Triage in Chat-Kanäle (Telegram/WhatsApp/Slack etc.) und nutzt multi-agent routing und isolierte Sessions. OpenClaw beschreibt sich als self-hosted Gateway, “single source of truth” für Sessions/Routing/Connections und explizit “agent-native” (Tool use, memory, multi-agent routing). citeturn21view0

**Kernidee**
- OpenClaw als Gateway über mehrere Kanäle; du kannst je Sender/Workspace/Agent isolieren. citeturn21view0  
- Für “kleine Tasks” route standardmäßig auf günstige Modelle (Flash‑Lite / GPT‑5.4 nano) und nur bei “needs code patch” auf GPT‑5.4 mini oder Codex. citeturn10view1turn13view0turn5view2  
- Pi ist in OpenClaw explizit als Beispiel genannt (“AI coding agents like Pi”, OpenClaw nutzt sogar “bundled Pi binary” im Default). citeturn21view0  

**Wichtiger Realitätscheck: Plattformrisiko**
Gerade bei agentischen Workflows verschieben Anbieter gern Abrechnung/Policies. Aktuell (April 2026) gab es Berichte, dass Anthropic Claude-Subscriptions nicht mehr für Third-Party Agent Tools wie OpenClaw nutzbar sind (Stichwort hohe Compute-Kosten). citeturn2news47turn2news48 Selbst wenn du primär OpenAI/Google nutzt, ist das ein Hinweis: **Plane nicht** auf “Subscription-unlimited-agents”, sondern auf API- oder Credit-basierte Kalkulierbarkeit.

## Betriebsregeln: So sparst du Tokens im Alltag, ohne Qualität zu verlieren

Der wichtigste Hebel ist eine harte “Context Policy”: Wenn das System nicht erzwingt, dass nur relevante Snippets in Prompts kommen, wird jedes Setup teuer.

Nutze Context-Provider statt Copy-Paste. Continue hat dafür `@codebase`, `@diff`, `@folder`, `@terminal`, `@url`; Cline hat `@url`, `@file`, `@folder` (und ergänzt Workspace-Problems). Das verhindert 80%-Overhead durch manuelles Einfügen. citeturn18view0turn20view0

Arbeite diff-first. Bei Code-Änderungen sollen Agents grundsätzlich (a) Patch/Diff liefern, (b) Tests laufen lassen, (c) nur die relevanten Ausgaben zitieren. Codex ist genau auf dieses “edit + run tests + evidence via logs” ausgelegt. citeturn17view0turn5view2

Vermeide Long-Context-Preisfallen. OpenAI weist darauf hin, dass Standardpreise unter bestimmten Kontextlängen gelten und Long-Context teurer sein kann; Googles Gemini 3.1 Pro staffelt explizit nach Promptgröße (≤200k / >200k). Das ist ein klares Signal: Retrieval/Repo-Maps sind nicht “nice to have”, sondern reines Geld/Token-Engineering. citeturn13view0turn11view1turn3search5

Nutze Caching/Batches gezielt für “Wiederholer”. OpenAI führt cached-input-Rates und Batch (50% Ersparnis) als offizielle Service-Tiers; Google bewirbt ebenfalls Batch-Reduktion (und listet Batch-Preise). Packe darum System-Prompts, Repo-Summaries und große, wiederverwendete Artefakte in Cache-freundliche Requests. citeturn13view0turn26view1turn10view1

Baue “mutual correction” als Governance, nicht als Endlosschleife. Das effizienteste Muster ist **Implementer → deterministische Tests → Reviewer auf Diff/Logs → optional Eskalation**. Continue als PR-Check ist hierfür Musterschüler, weil es Review standardisiert und in CI erzwingbar macht. citeturn18view1

Dokumentation als Token-Senke vermeiden: Statt Doku “live zu erklären”, speichere kurze, versionierte Artefakte im Repo (AGENTS.md, ADRs, Specs). Codex kann explizit über AGENTS.md gelenkt werden; das reduziert Setup-Tokens in jeder neuen Agent-Session. citeturn17view0turn5view2

Wenn du diese Regeln mit einem der vier Setups kombinierst, bekommst du genau das, was du beschrieben hast: mehrere spezialisierte Agents, die sich gegenseitig korrigieren – aber so, dass **die Korrektur überwiegend durch Tests/CI/Constraints** passiert und LLM-Tokens nur dort fließen, wo sie tatsächliche Hebelwirkung haben.