# Health Integrate — Claude bootstrap

**If you are an AI assistant starting a new session on this project, read this file first, then read [docs/HANDOFF.md](docs/HANDOFF.md), then [PLAN.md](PLAN.md).** Those three files give you the full picture in under 10 minutes.

---

## One-paragraph context

Health Integrate is a Tauri + React + Monaco desktop app for radiology informatics: a **Template Mapper** that normalizes dictation templates against a user-supplied integration configuration, an **HL7 Viewer** for paste-and-observe with de-identification, and three utilities (**String Generator**, **Tool Launcher**, **Integrated Terminal**). Per-user Windows installer, no admin rights. Public MIT on GitHub at `presspausegarage/health-integrate`. Phase 1–2 + 3a are done; the Template Mapper lint ruleset is the next thing to refine. HL7 viewer, utilities, and security hardening are scheduled but not started.

## Resume ritual

```bash
cd F:/dev/ISE\ Toolkit   # the working directory name is "ISE Toolkit"
                         # (early project name); the repo + product name is "Health Integrate"
npm test --workspace=@health-integrate/core   # confirm 50/50 tests green
npm run dev              # launch the Tauri app (first run ~30s; cached after)
```

Then read `docs/HANDOFF.md` in full before making changes.

## Working conventions already agreed

- **MIT license, public GitHub**, no vendor branding in UI or docs, no Claude attribution in commits or code comments.
- **Do not commit DataValue XML** exports (gitignored). The repo ships a scrubbed synthetic fixture; users supply real files at runtime.
- **Generic UI labels only**: "App Configuration", "Template Mapper". Never "PS360", "PowerScribe 360", "Patient Hub", or vendor version strings.
- **Code-level identifiers may keep `ps360` / `usePS360` etc.** — internal, user never sees them. Rename only if doing a holistic refactor.
- **Save-as, never overwrite.** Template export writes to `<original>.normalized.xml`; never mutates source files.
- **Never write HL7 content to disk.** Phase 6 onward — the viewer is memory-only by design.
- **Git commits are direct** (no Claude footer). Author via `-c user.name="Andy Weston" -c user.email="andywestongaming@gmail.com"` unless configured otherwise.
- **CLRF warnings on every git operation are harmless** (Windows filesystem).

## Fast orientation by task

| Task | Primary file(s) |
|---|---|
| Add or refine a lint rule | `packages/core/src/linter.ts` + tests in `packages/core/test/linter.test.ts` |
| PS360 UI change | `packages/app/src/ps360/` |
| Add a Tauri command | `packages/app/src-tauri/src/lib.rs` |
| Tauri config (window, bundle, CSP) | `packages/app/src-tauri/tauri.conf.json` |
| Monaco setup / new language grammar | `packages/app/src/shared/monaco.ts` |
| New workflow view | `packages/app/src/<workflow>/` + register in `packages/app/src/shared/workflows.ts` + wire in `App.tsx` |

## Prerequisites

- Node 20+
- rustup (cargo on PATH; `export PATH="$HOME/.cargo/bin:$PATH"` in bash sessions as needed)
- Visual Studio Build Tools with **Desktop development with C++** workload (the Tauri build fails with confusing `link: extra operand` errors if this is missing — that's coreutils `link` from Git Bash being picked up instead of `link.exe`).
- WebView2 (already on Win10 21H2+/Win11).

## What not to do in a resumed session

- Don't rescaffold the repo — it's already set up.
- Don't revisit the "Tauri vs. VS Code extension" or "Rust vs. TypeScript core" decisions without reading the HANDOFF rationale; both were debated and decided.
- Don't add vendor branding or AI-assistant attribution.
- Don't implement `export normalized template` until `offset-recalculator.ts` is wired in — the round-trip isn't safe without it.

---

For anything not covered here: **`docs/HANDOFF.md`** has the detailed current state, known issues, and next-action priorities.
