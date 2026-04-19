# Health Integrate — Handoff

Handoff notes for picking this project back up. Paste into Notion or read here.

---

## TL;DR

- **What**: A per-user Windows desktop app (Tauri + React + Monaco) that consolidates five radiology-informatics workflows: **Template Mapper**, **HL7 Viewer**, **String Generator**, **Tool Launcher**, **Integrated Terminal**.
- **Where**: [github.com/presspausegarage/health-integrate](https://github.com/presspausegarage/health-integrate) — public, MIT-licensed.
- **How far**: Scaffolded end-to-end; Template Mapper is the only workflow with real functionality beyond placeholder views; the lint ruleset for it is in place but needs refinement against real templates.
- **Next**: Harden the lint ruleset, then move on to inline pending-diffs + save-as export (Phase 3b-4). After that, PHI masker and HL7 viewer.

---

## Project goal

A toolkit for the niche workflows a radiology informatics / integration specialist actually does day-to-day: normalizing dictation templates against a vendor integration configuration, debugging HL7 messages safely, generating repetitive command strings, launching other tools, and running CLI sessions — all in one signed installer with no admin rights required.

See [PLAN.md](../PLAN.md) for the full phased plan, architecture rationale, and not-doing list.

---

## Architecture at a glance

```
health-integrate/
  packages/
    core/                 Pure TS library: parsers, serializer, linter
    app/                  Vite + React + TS frontend
      src/
        ps360/            Template Mapper workflow
        hl7/              HL7 Viewer placeholder
        string-gen/       String Generator placeholder
        tools/            Tool Launcher placeholder
        terminal/         Terminal placeholder
        shared/           Sidebar, Monaco setup, fs wrappers, workflow metadata
      src-tauri/          Tauri 2 Rust shell (minimal; file I/O, dialog, clipboard)
  docs/
    HANDOFF.md            This file
  PLAN.md                 Phased development plan
  README.md               Public landing page
  NOTICES.md              Third-party attributions
  LICENSE                 MIT
```

Key architectural decisions:

- **Single app, not VS Code extension.** Consolidated because the threat model for HL7 paste (other editor extensions could exfiltrate PHI) argued against living inside an IDE.
- **Tauri per-user install (`installMode: "currentUser"`).** No admin rights, no UAC, installs to `%LOCALAPPDATA%\Programs\`.
- **TypeScript core with Rust shell.** Core library is TS for editor-latency reasons (live diagnostics, hover, completion run on every keypress and benefit from zero IPC). Rust shell handles file I/O, clipboard, pty bridge, and Phase 11 DPAPI storage.
- **Monaco bundled locally** (no CDN fetches) with only the core editor API — language modes registered per workflow as needed. Tauri's strict CSP blocks external script loads.

---

## Development setup

```bash
# Prerequisites (Windows):
#  - Node 20+
#  - rustup (https://rustup.rs)
#  - Visual Studio Build Tools with "Desktop development with C++" workload
#  - WebView2 (preinstalled on Win10 21H2+/Win11)

git clone https://github.com/presspausegarage/health-integrate.git
cd health-integrate
npm install

# Run core tests (no Rust needed)
npm test --workspace=@health-integrate/core

# Typecheck everything
npm run typecheck

# Launch the Tauri dev app
npm run dev

# Build the signed installer (needs signing cert configured; unsigned works too)
npm run dist
```

First `cargo build` takes 5–10 minutes (300+ crates). Subsequent builds are seconds.

---

## Current state

### What works end-to-end

- **Repo scaffolding**: npm workspaces monorepo, typecheck + test scripts, gitignore tuned for Tauri + Vite outputs, public GitHub + MIT license, three-commit history pushed.
- **Tauri shell**: launches a 1280×800 window titled "Health Integrate", renders the Vite frontend, no network capabilities beyond IPC.
- **Sidebar**: grouped into Radiology (Template Mapper, HL7 Viewer) and Utilities (String Generator, Tools, Terminal). Five workflow entries; four render placeholder views.
- **Template Mapper (Phase 3a)**:
  - Load DataValue XML via file dialog → parses via `parseDataValue` → displays metadata (integration type, config name) plus expandable per-domain sections with inline editable external-value inputs.
  - Load one or more template XML files → parses via `parsePortalAutoText` → left-pane list grouped by file + group name, searchable by name/description.
  - Selecting a template renders: editable Monaco editor (top 3/4) + picklist panel (bottom 1/4) with per-field tabs.
  - Picklist field view shows editable subheader name, type/position metadata, merge/autotext reference info, and a two-column choices table (spoken key → editable dictation text).
  - **Bracket decoration**: picklist regions in the editor render as `[FieldName:choices]` with a click-to-pick popup listing all choices. Selecting a choice replaces the picklist text with the chosen dictation string.
  - **Lint diagnostics**: Monaco squiggles + an inline "N issues" panel below the editor with per-diagnostic Fix buttons and a Fix-all action. Clicking a diagnostic jumps the editor to its location.

### What's partial

- **Lint ruleset**: this is the main TBD. Current rules:
  - `header/case` — section header case/spacing mismatch against `ReportHeaders` external value. Skips picklist field titles.
  - `choice/case`, `choice/unknown` — picklist choice name validation against the inferred DataValue domain (Recommendation, Assessment, Laterality, TissueDensity, Pathology, etc.). Recommendation domain uses compound-grammar peeling for trailing laterality (Left/Right/Bilateral) and timeframe (`in X months`, `in 1-2 years`, `at age N`, abbreviated forms).
  - `statement/recommendation-case`, `statement/recommendation-unknown` — full-line smoke test for `RECOMMENDATION: <rec> [lat] [time].` in static template text.

  **Known gaps**: the ruleset was tested against the minimal scrubbed fixture and partially validated against one real template. Specific areas that likely need attention:

  1. **False-positive tuning for `header/case`**. Any `Word:` at start-of-line with a case-insensitive match in ReportHeaders is flagged — including some that are legitimately not section headers in context (e.g. inline prose headers within narrative paragraphs).
  2. **Domain-inference gaps**. Picklist fields whose name doesn't match `DOMAIN_INFERENCE` regexes (e.g. custom field names specific to a site) are silently skipped. A user-overridable mapping from field-name to DataValue domain would be safer.
  3. **Timeframe patterns too narrow**. Real templates may use forms like "6 mo", "6-month follow-up", "in one year" that the current regex set doesn't recognize.
  4. **Assessment / BI-RADS compound parsing**. Currently `choice/*` rules treat BI-RADS choices as plain strings (`"BI-RADS 2"`, `"BI RADS 2"`, `"2"`). The real matching semantics include alternate spellings and ordinal stripping.
  5. **No rule for merge-field validation**. Type-4 merge fields (`Patient MRN`, `Accession Numbers`) aren't validated against the `Patient` / `Procedure` mapping lists yet.
  6. **No rule for autotext-reference orphans**. Type-5 fields reference other autotexts by `autotextId`; we don't currently flag references to autotexts that aren't loaded in the workspace.
  7. **Post-rename lint staleness**. When the user renames a subheader via the editable input, the AST's field name lags until reload. The live choice extraction follows the text (correct), but any diagnostic keyed on the AST `name` becomes stale.

- **Template export / save-as**: not implemented. The current flow lets you edit but there's no "Save normalized copy" button yet.
- **Round-trip on edit**: when the user edits the Monaco text, our offset-recalculator module from Phase 1 isn't yet invoked to fix up `start`/`length` attributes before re-serialization. Editing then saving would produce a file with misaligned field offsets. **Do not ship export without this fix.**

### What's not started

- Phase 3b: code actions beyond Fix (e.g. "Insert missing `FINDINGS:` header").
- Phase 3c: inline pending-diffs model with per-hunk accept/reject.
- Phase 3d: bulk-normalize workspace + smoke-test-all-templates command.
- Phase 4: save-as diff export via Monaco DiffEditor.
- Phase 5: PHI masker (field map + fake-identity substitution).
- Phase 6: HL7 Viewer (paste-and-observe, vendored vscode-hl7 grammar).
- Phase 7: API fields integration.
- Phase 8: String Generator.
- Phase 9: Tool Launcher.
- Phase 10: Integrated Terminal (xterm.js + portable-pty).
- Phase 11: Security hardening (DPAPI-encrypted app data, Windows Credential Manager, tamper detection, capability scoping, encrypted export bundles, code signing).

---

## Known issues / caveats

- **Code signing is not set up.** Unsigned installer works fine on unmanaged Windows (one-time SmartScreen "Run anyway" click). SignPath Foundation's free EV signing now requires a repo-reputation threshold the project doesn't meet. Options documented in [PLAN.md](../PLAN.md) and earlier conversation: ship unsigned; ask IT for an internal cert; paid Certum OSS cert (~$30/yr); or SSL.com eSigner for instant-rep EV (~$349/yr).
- **Tauri build needs the C++ workload.** Initial Rust build will fail with `link: extra operand` errors if VS Build Tools don't include "Desktop development with C++" — that error means `link.exe` is falling through the PATH to coreutils `link` from Git Bash.
- **Monaco bundle size is 5.8 MB.** Acceptable for a local app but worth trimming before ship. Moving from `monaco-editor/esm/vs/editor/editor.api` to a custom barrel that only imports the exact editor features in use would cut it further.
- **Dev server port** is fixed at 1420 (Tauri convention). If another process holds it, `npm run dev` fails with "Port 1420 is already in use".
- **Windows line endings**: git shows CRLF warnings on every commit because the repo is on a Windows file system and CRLF conversion is enabled. Harmless.

---

## How to continue

### Recommended next 2–3 hours

1. **Validate the lint ruleset against more real templates.** Open the scrubbed template fixture and a couple of real customer exports, load them with the real DataValue, and record which diagnostics are correct, which are false positives, which are missed. Use that punch list to drive rule refinement.
2. **Add a rule-disable UI**. Users will want to silence noisy rules per-template or per-workspace. Small settings panel with checkboxes for rule codes; persist to `localStorage` for now (upgrade to DPAPI storage in Phase 11).
3. **Fix offset recalculation before any save-as export.** The existing `offset-recalculator.ts` scaffold is in `packages/core/src/` — it needs implementing before export can safely round-trip edits. Property-based test in `packages/core/test/roundtrip.test.ts` already covers the AST-level round-trip; add one that exercises text edits.

### Then (Phase 3b–4)

4. **Save normalized template**. Add a button that: invokes offset-recalculator on the edited AST, runs `serializePortalAutoText`, writes to `<original>.normalized.xml` via a new Rust command, opens a Monaco `DiffEditor` for review.
5. **Bulk normalize**. Command that runs normalize-and-save across every loaded template, producing a multi-file diff tree.
6. **Standalone smoke test**. A command (not just passive lint) that produces a formatted report of all diagnostics per template, exportable to a text file for sharing.

### Then

7. **Phase 5 + 6: PHI masker + HL7 Viewer.** The HL7 viewer is probably the second-most valuable workflow for the target audience. PHI masker is a prerequisite. Start with the HIPAA field map doc (Phase 5a) and the fake-identity JSON.
8. Utilities (Phases 8–10) can run in parallel — the String Generator is a ~2-3 day task, Tool Launcher ~2 days, Terminal ~1–2 weeks.

---

## Repo cheatsheet

| Task | Command / file |
|---|---|
| Run core tests | `npm test --workspace=@health-integrate/core` |
| Typecheck everything | `npm run typecheck` |
| Launch dev app | `npm run dev` |
| Build signed installer | `npm run dist` (after Rust + signing setup) |
| Core library source | `packages/core/src/` |
| Linter rules | `packages/core/src/linter.ts` |
| PS360 UI | `packages/app/src/ps360/` |
| Monaco setup | `packages/app/src/shared/monaco.ts` |
| Tauri commands | `packages/app/src-tauri/src/lib.rs` |
| Tauri config | `packages/app/src-tauri/tauri.conf.json` |
| Sidebar metadata | `packages/app/src/shared/workflows.ts` |
| Scrubbed test fixtures | `packages/core/test/fixtures/` |

---

## Decisions made (for future reference)

- **Naming**: "Health Integrate" is the public product name and repo name. "ISE Toolkit" was the working name early in conversation; renamed throughout after the public repo was created.
- **No vendor branding in UI/repo.** Standard radiology terms (BI-RADS, FINDINGS, etc.) are fine — they're industry-standard. Specific vendor product names, version strings, customer-site identifiers, and owner names are excluded per earlier conversation.
- **DataValue files are user-supplied.** The repo documents the schema and ships a synthetic fixture for testing, but the actual customer-specific configuration file never enters the repo.
- **Monaco over CodeMirror** for the editor primitive. Best tooling for multi-workflow (PS360 + HL7 + String Gen all use Monaco), best React integration via `@monaco-editor/react`, and we already budgeted the bundle-size cost.
- **React over Preact/Solid/Svelte**. `@monaco-editor/react` is mature; the ecosystem fit is strong; bundle size is not the dominant constraint.
- **One Tauri app over VS Code extension.** Decided early; threat model for HL7 paste ruled out the multi-extension VS Code environment.
- **Rust version tolerance.** DataValue parser matches vendor assembly strings structurally via regex — any `MRS.Aspen.Business... Version=*, Culture=*, PublicKeyToken=*` parses regardless of specific version numbers.

---

## Open questions to resolve next time

1. Do we ship the unsigned installer for a pilot group now, or wait for signing to be sorted?
2. Does the target team's IT have an enterprise code-signing cert we can use, or are we buying our own?
3. Which real template files should become the "golden set" that the lint ruleset is tuned against? (Pick 3–5 representative exports from different site configurations.)
4. Is any of the lint ruleset work already a duplicate of functionality that exists in vendor tooling? Worth a quick look before investing more — we want to catch gaps the vendor tools miss, not reimplement them.
