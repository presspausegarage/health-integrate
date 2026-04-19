# Health Integrate — Plan

A single lightweight desktop application combining five workflows:

- **PS360 Template Mapper** — autocomplete, lint, preview, bulk-edit, smoke-test PS360 `PortalAutoTextExport` XML files against a user-supplied integration configuration file.
- **HL7 Viewer** — paste plain-text HL7 messages from logs/clipboard, see them tokenized and de-identified in real time.
- **String Generator** — form-driven builder for parameterized command strings (PowerShell, installer CLIs, etc.). Users pick a template, fill a form, copy the rendered string.
- **Tool Launcher** — dashboard of shortcuts to externally-installed tools (Weasis, VS Code, Notepad++, 7-Zip, etc.) with auto-detection of common install paths and user-configurable entries.
- **Integrated Terminal** — embedded terminal (PowerShell / cmd / WSL / bash) for running CLI installers, sendcommand/sre tools, and occasional shell work without context-switching.

All five workflows live inside the same Tauri app. They share a sidebar, settings, a PHI masker, and a consistent UI. Threat isolation (no third-party IDE extensions, no telemetry, no ambient network) applies uniformly. Terminal and tool-launcher integrations extend the trust surface only on explicit user action — see cross-cutting concerns.

## License + distribution

- **License**: MIT, public GitHub.
- **Code signing**: SignPath Foundation free EV cert (applied for in parallel with Phase 1).
- **Installer**: Tauri NSIS per-user (`installMode: "currentUser"`). Installs to `%LOCALAPPDATA%\Programs\`. No admin, no UAC.
- **Target**: Windows 10 21H2+ / Windows 11. WebView2 is preinstalled on all supported versions.
- **Updates**: Tauri built-in updater, fetching signed releases from GitHub Releases.

## Monorepo layout

```
health-integrate/
  packages/
    core/                 Pure TS: PS360 parsers, normalizer, smoke-tester (no UI, no Tauri deps)
    phi-masker/           PHI detection + fake-identity substitution
    app/                  Vite + TypeScript frontend (Monaco-based) + Tauri shell
      src/
        ps360/              Template mapper views
        hl7/                Paste-and-observe views
        string-gen/         Form-driven string builder
        tools/              External tool launcher dashboard
        terminal/           xterm.js integrated terminal
        shared/             Sidebar, settings, DataValue loader, theming
      src-tauri/          Tauri Rust backend: file I/O, clipboard, pty bridge, process launch
        src/                Rust source (main.rs, lib.rs, module-per-capability)
        capabilities/       Per-view IPC scoping (Phase 11d)
        icons/              Bundle icons (generated, not committed)
        Cargo.toml
        tauri.conf.json
  resources/
    fake-identities.json  50-100 themed fake name pairs
    api-fields.xml        Canned PS360 API fields (user to supply)
  docs/
    datavalue-schema.md   Our documented schema, NOT the file itself
    phi-field-map.md      HL7 v2 PHI field inventory
    threat-model.md       PHI leakage analysis + mitigations
  PLAN.md (this file)
  LICENSE (MIT)
  NOTICES.md              Third-party attributions (vscode-hl7 grammar, Monaco, etc.)
  README.md
```

**Package manager**: npm workspaces.
**Node**: latest LTS.
**Build**: Vite (frontend), Rust/Cargo (Tauri shell).

## DataValue.xml handling (what's in vs. out of the repo)

The mapping **values** in DataValue (BI-RADS categories, laterality, assessment terms, recommendation names, tissue density descriptors, pathology statuses) are **standard radiology terminology** — not proprietary. These can appear in test fixtures, documentation, and examples freely.

What **must be excluded** from the repo:

- Any vendor/product branding: "Patient Hub", "MRS Aspen", "MRS8", "PowerScribe" beyond neutral references needed to describe what the tool interfaces with.
- Assembly version strings (e.g. `MRS.Aspen.Business.Integration.Base...., MRS8.Business, Version=X.Y.Z.W, Culture=neutral, PublicKeyToken=null`). Parser must read these at runtime; the repo must not contain specific version values in fixtures or docs.
- Customer-specific identifiers: real `InternalGUID` values from any shipped file, workstation names (`AssignedWorkstation`), integration config names (`Name="..."`), owner first/last names, owner account IDs, autotext IDs from real exports.
- Anything that would identify a specific customer, site, or user.

What goes in the repo:

- Documented schema in `docs/datavalue-schema.md` describing structure generically — no vendor version strings quoted.
- TypeScript types + parser in `core`. Parser accepts **any** assembly version string via regex tolerance (structural patterns, not literal version matches).
- Test fixtures constructed from scratch: synthetic GUIDs, neutral owner names, generic integration config names (`"Test Config"`), fabricated workstation IDs. Fixture radiology terms can be realistic since they're industry-standard.
- Users supply their own `DataValue.xml` at runtime via the app's settings panel or drag-and-drop on the PS360 view.
- README: "This tool interfaces with XML integration configurations exported from radiology voice-recognition/dictation systems. Provide your own configuration file at runtime."

## PS360 template file handling

- **File extension**: always `.xml`. The app detects `PortalAutoTextExport` files by root element, not extension.
- **One `DataValue.xml` per session** — loaded via settings; persists across restarts via Tauri's app-data store.

---

## Phase 1 — `core` library

**Goal**: prove the round-trip before any UI exists.

- `parsers/datavalue.ts` — parse `IntegrationConfiguration` → typed mapping lists (Recommendation, Assessment, Laterality, TissueDensity, Pathology, Site, ReportHeaders, Patient, Procedure).
- `parsers/portal-autotext.ts` — parse `PortalAutoTextExport` → unescape the double-encoded inner `<autotext>` XML → AST of fields/choices/merge refs.
- `serializers/portal-autotext.ts` — AST → identical XML. **Byte-exact RTF preservation outside intentional edits.**
- `normalizer.ts` — given AST + DataValue maps, returns a diff: `{path, old, new, reason, confidence}`. Never mutates.
- `offset-recalculator.ts` — **the correctness-critical piece.** Any edit to text shifts `start`/`length` attributes on every downstream `<field>` and `<range>`. Must recompute from rendered-text positions after each change.
- `smoke-test.ts` — iterate every field, report orphan choices (not in DataValue), missing merge targets, duplicate field names, invalid `autotextId` references.
- `dep-graph.ts` — cross-autotext reference graph. Type-5 fields (`autotextId` references) create dependencies; editing a referenced autotext invalidates cached `defaultvalue` in consumers.

**Tests**:
- Property-based: random edits → serialize → reparse → field offsets still resolve to the same logical fields.
- Round-trip: parse → serialize with zero edits → assert byte-identical output.
- RTF codepage preservation: non-ASCII characters survive round-trip.

**Exit criteria**: 1000-iteration property test passes on the scrubbed fixture template file.

---

## Phase 2 — Tauri app shell + scaffolding

- `cargo tauri init` in `packages/shell`. Minimal Rust backend: clipboard read/write, file open/save dialogs, app-data store for persistent settings.
- Vite + TypeScript frontend in `packages/app`.
- **No network permissions granted** in `tauri.conf.json`. Enforced at the framework level.
- Telemetry: none. Not an opt-in, not a feature.
- NSIS installer config: `installMode: "currentUser"`, per-user Start Menu shortcut.
- App shell UI: left sidebar grouped into **Radiology** (PS360, HL7) and **Utilities** (String Generator, Tools, Terminal). Top toolbar, main content area, bottom status bar.
- Monaco editor integrated once, reused across PS360, HL7, and String Generator views.

---

## Phase 3 — PS360 workflow views

- **DataValue loader**: drop-zone + settings entry. Validates on load, shows mapping counts per domain (e.g. "Recommendations: 47, Assessments: 12, Laterality: 3…").
- **Template file loader**: drag-drop or file picker. Parses via `core`, displays in template list.
- **Template list pane**: shows all loaded templates, grouped by autotext group, searchable.
- **Template detail pane**: Monaco editor showing rendered template text with fields highlighted. Expandable panels for each field show type, choices, merge refs, default values.
- **Inline edit**: click a choice → edit in place. Changes tracked in a pending-diffs model.
- **Diagnostics**: orphan choices / invalid merge refs marked with Monaco markers (squiggles). Hover shows DataValue context.
- **Completion**: inside `<choice name="…">` and `<defaultvalue>`, offer allowed values filtered by enclosing field context.
- **Code actions**: "Replace with nearest DataValue match" (Levenshtein distance).

---

## Phase 4 — PS360 bulk operations + export

- **Normalize current file** — runs normalizer on the active template, stages diffs for review.
- **Normalize all loaded templates** — same across every open file, grouped diff view.
- **Diff view**: Monaco's built-in `DiffEditor` component, original vs. proposed. Accept per-hunk or accept-all.
- **Smoke test all** — runs smoke-tester, results in the findings panel with click-to-locate navigation.
- **Export**: writes `<original>.normalized.xml` sibling file next to the source. **Never overwrites source files.** File save dialog confirms the target path.

---

## Phase 5 — PHI masker package

### 5a — PHI field map (documentation deliverable)
`docs/phi-field-map.md` — every HL7 v2 segment/field that can carry PHI per HIPAA Safe Harbor's 18 identifiers. Minimum coverage:

- **PID**: 2, 3, 4, 5, 6, 7, 9, 11, 13, 14, 19, 20, 21, 23, 26
- **NK1**: 2, 4, 5, 6, 12, 19, 25, 26, 31, 32, 33, 34, 35, 37, 40
- **GT1**: 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 19, 20
- **IN1/IN2**: subscriber/insured identifiers, SSNs, policyholder names
- **OBX, NTE, DG1, PR1**: free-text — **flag only, do not auto-mask clinical narrative**
- **MSH-4/6**: site-configurable; document but don't mask by default
- **Z-segments**: unknown by definition — flag for manual review

### 5b — `phi-masker` implementation
- `detect.ts` — identify PHI fields in a parsed HL7 message structure.
- `mask.ts` — replace structured PHI with deterministic fake values (same input → same output within session for internal message consistency across repeated occurrences).
- `fake-identities.json` — 50–100 themed name pairs across game franchises (Mario, Zelda, Sonic, Pokémon, Street Fighter, Mega Man, Final Fantasy, Kirby, Metroid, Pac-Man). Obviously fake: *Mario Super*, *Link Hyrule*, *Samus Aran*, etc.
- Numeric PHI (MRN, SSN, phone, DOB) → obviously fake patterns: `MRN-FAKE-0042`, `000-00-0001`, `555-0100`, random dates 1950–2000.
- Free-text PHI scanner — regex for SSN/phone/email/MRN patterns + fake-identity name list; **flags matches, does not rewrite**.

---

## Phase 6 — HL7 workflow views

- **Paste area** (Monaco editor): top panel. Accepts plain-text HL7 via paste or file drop. vscode-hl7 TextMate grammar vendored for syntax highlighting.
- **De-identified view** (Monaco, read-only): middle panel. PHI auto-masked via `phi-masker`. Free-text PHI flags shown as decorations.
- **Findings panel**: bottom panel. Segment/field validation, PHI flags, structural issues. Click a finding → jump to location in both editors.
- **Status indicator**: "PHI mode: ON" always visible, never toggleable off. The viewer exists to make PHI-safe observation the default.
- **Guards**:
  - Saving from the HL7 view only exports the **de-identified** version. Original pasted content has no save path.
  - Copy from the paste area prompts: "Copy original or de-identified?" (default: de-identified).
  - In-memory only. Closing the app discards all HL7 state. No autosave, no recent files, no history.

---

## Phase 7 — API fields integration

- User provides canned API fields XML → shipped in `resources/api-fields.xml`.
- Feeds PS360 completion provider alongside DataValue (distinct marker severity to distinguish sources).

---

## Phase 8 — String Generator

A utility page for building parameterized command strings without hand-editing quotes and variable substitutions every time.

- **Template format**: JSON file(s) in app-data with `{name, description, template, variables[]}`. Template string uses `{{variableName}}` placeholder syntax.
- **Variable types**: `string`, `multiline`, `bool`, `enum` (with options list), `path` (opens file/folder picker), `secret` (masked input, never persisted).
- **View layout**: two-pane. Left: template picker + variable form. Right: live-rendered output in Monaco (read-only, with the template's target language highlighted — PowerShell by default).
- **Actions**: Copy to clipboard, Save current values as preset (per-template), Reset.
- **Built-in templates**: ship a few common ones (PowerShell install-invocation skeleton, sendcommand/sre CLI argument sets — user to supply the exact formats). Users can add their own via a "New Template" editor that writes to app-data.
- **No persistence of `secret`-typed values.** Presets exclude any secret field.

**Effort**: ~2–3 days once shell is scaffolded.

---

## Phase 9 — Tool Launcher

Dashboard of cards/buttons that launch externally-installed tools.

- **Auto-detection on first run**: scan common install paths for known tools (Weasis, VS Code, Notepad++, 7-Zip, WinMerge, PuTTY, WinSCP, etc.). Found tools get pre-populated entries.
- **User-configurable entries**: "Add Tool" dialog takes name, executable path, optional arguments, optional icon path. Stored in app-data.
- **Launch mechanism**: Tauri's shell plugin with a strict allowlist — only paths the user explicitly added or that came from auto-detection are launchable. No arbitrary-path execution from the UI.
- **Layout**: grid of cards, each with icon, name, and click-to-launch. Right-click → edit/remove.
- **Non-goals**: not a package manager. We don't install anything; we just shortcut to what the user already has.

**Effort**: ~2 days.

---

## Phase 10 — Integrated Terminal

Embedded terminal window for CLI installers, sendcommand/sre tools, WSL sessions.

- **Frontend**: `xterm.js` + `xterm-addon-fit` + `xterm-addon-web-links`.
- **Backend**: `portable-pty` Rust crate (or `tokio-pty-process` / `pty-process`) to spawn pty sessions. Bridge stdin/stdout via Tauri events.
- **Shells supported**: PowerShell (default on Windows), cmd, WSL distributions (auto-detect via `wsl -l -v`), Git Bash if installed.
- **Tabs**: multiple concurrent sessions, each its own shell.
- **Resize**: fit-addon + PTY resize on container change.
- **Clean teardown**: closing a tab / app kills the child pty cleanly.
- **No shell history persistence** beyond what the shell itself does. We don't record commands.
- **Copy/paste**: standard terminal semantics. Selection-to-clipboard toggle in settings.

**Effort**: ~1–2 weeks. The biggest unknown is pty lifecycle edge cases on Windows (child-process cleanup, ConPTY vs. WinPTY).

---

## Phase 11 — Security Hardening

Layered protections for local app data and sensitive fields. These are Tauri/Rust-shell concerns, not language-choice concerns — TypeScript in a WebView is already memory-safe at the V8 level, and our threat model is about data at rest and correctness, not buffer overflows. Phase 11 delivers concrete wins the user sees.

### 11a — DPAPI-encrypted app-data storage

All persistent app state is encrypted at rest using Windows Data Protection API (`CryptProtectData`), tied to the user's Windows login. Transparent — no password prompt. Only that user on that machine can decrypt.

- **What gets encrypted**: app settings, String Generator templates and saved presets, Tool Launcher entries, cached DataValue path and content hash, session state.
- **What does not get encrypted**: nothing that was never persisted in the first place (HL7 messages, `secret`-typed String Generator field values, terminal history — all in-memory only).
- **Implementation**: ~50 lines of Rust in the Tauri shell calling `windows-rs` DPAPI bindings. Frontend sees a typed `secureStore` API indistinguishable from localStorage in usage; the Rust side enforces encryption.
- **Key rotation / migration**: DPAPI handles this transparently via Windows. We version the stored-blob schema for our own migrations.

### 11b — Windows Credential Manager for true secrets

If a user explicitly wants to persist a `secret`-typed String Generator value (install credentials reused across runs, API tokens, etc.), route it to **Windows Credential Manager** rather than our encrypted blob store. Users can see and revoke via Windows' own UI — the right trust boundary for real secrets.

- Opt-in per field. Default: secrets are session-only, discarded on app close.
- UI: "Save to Windows Credential Manager?" prompt when the user first attempts to save a secret field.

### 11c — DataValue tamper detection

Store a hash of the loaded DataValue.xml alongside its path. On each session load, recompute and compare. If changed:

- Show a warning banner: "DataValue file changed since last session. [Show diff] [Continue] [Reload from original]".
- Require explicit user acknowledgment before any normalize/smoke-test operations run against the new content.

Catches accidental overwrites or deliberate swaps without being annoying when the user legitimately updated their config.

### 11d — Tauri capability scoping

Tauri 2's capability system lets us declare precisely which Rust commands the frontend can invoke, scoped per window/view. Lock down:

- PS360 views: can call template file I/O, normalizer, smoke-tester. Cannot call terminal spawn, tool launcher shell.open, or network.
- HL7 views: can call clipboard read and PHI masker. Cannot call file write, terminal, or network.
- Terminal view: can spawn pty. Cannot call PHI masker, file read outside user's own home dir.
- Tool Launcher: can call `shell.open` against the user-maintained allowlist only. Cannot open arbitrary paths.
- String Generator: no shell, no file I/O, no network. Pure computation + clipboard.

Enforced at the IPC layer — more robust than application-level guards.

### 11e — Encrypted export bundles

When users export template configs, tool-launcher entries, or String Generator templates for sharing with a colleague, the bundle is encrypted with a user-chosen password (AES-GCM via the `aes-gcm` Rust crate). Decryption is explicit on import. Keeps sensitive-ish configs off plain filesystem when moving between machines.

- Bundle format: single `.iseb` file (magic bytes + version + nonce + ciphertext + HMAC).
- Import flow: prompts for password, validates HMAC before decrypting, shows a summary of what the bundle contains before the user confirms.

### 11f — In-memory-only invariants (enforcement)

Listed elsewhere in the plan but enforced concretely in Phase 11 by lint/CI rule:

- **HL7 paste area content** must never be passed to any Rust command that writes to disk. Enforced by a grep-based CI check over `app/src/hl7/**` — if a call to `writeTextFile` appears in HL7 code, CI fails.
- **`secret`-typed field values** have a dedicated TypeScript branded type `SecretValue` that lacks a `toJSON` method and throws if stringified. Makes accidental persistence a compile error.

### 11g — Code signing (reference only)

Already covered in "License + distribution": SignPath Foundation EV cert, applied for in parallel with Phase 1. The signing step is the most visible security feature for end users (no SmartScreen warning). Listed here so the full security story lives in one place.

### 11h — Defensive cross-workflow invariants (reference only)

HL7 data never flows into terminal, string-gen, or tool-launcher. Already covered in "Trust boundaries for Utilities" cross-cutting concern. Enforced in Phase 11 by:

- No cross-workflow "send to X" actions in any HL7 view component.
- The HL7 copy prompt (original vs. de-identified) is the only path out of the HL7 view.

---

## Cross-cutting concerns

### RTF offset correctness (single highest risk)
Any text-length change invalidates every downstream `start`/`length` in the inner XML. Phase 1 must prove offset recomputation is bulletproof. If it isn't, PS360 re-imports silently corrupt, radiologists dictate into misaligned fields, nobody notices until a clinical report goes out wrong. Property-based testing mandatory.

### Cross-autotext dependencies
Type-5 fields reference other autotexts by `autotextId`. Normalizer must:
1. Build dep graph before any edits.
2. Apply edits in topological order.
3. Invalidate cached `defaultvalue` in consumers when their referenced autotext changes.

### DataValue version drift
File type headers contain vendor-specific assembly version strings. Parser must match these structurally (regex pattern) rather than by literal value, tolerate unknown properties, tolerate unknown `FieldIdentifier` values — log warnings, don't throw. Schema doc versioned by our own doc version, not the vendor's.

### Character encoding
RTF codepage 1252. Non-ASCII names exist. Round-trip must be byte-exact.

### Merge field IDs (`mergeid="302"`)
Reference PS360-internal IDs not in DataValue. Can't validate positively — only flag orphans. Smoke test reports this limitation explicitly.

### Network isolation
Tauri `tauri.conf.json` grants no `http` permissions. No outbound calls possible at the framework level from the app frontend. Auto-updater is the one exception (to GitHub Releases for signed artifacts only) and runs on explicit user action, not automatically, to keep the "no background network" invariant.

**Terminal is a deliberate exception.** A user running `curl`, `ssh`, or a package install in the embedded terminal is making an explicit network call with their own credentials — that's the point of a terminal. The app itself doesn't make network calls; the shell the user spawned does. This is a categorically different trust decision from ambient network activity.

### Trust boundaries for Utilities

The three utility workflows extend the app's capabilities on explicit user action only:

- **String Generator**: pure local computation. No process launch, no file I/O beyond reading/writing user-managed template JSON in app-data. No threat surface change.
- **Tool Launcher**: can launch external processes via `shell.open`, but only against a user-maintained allowlist (auto-detected entries + user-added entries). No arbitrary-path execution from the UI. Users who add an entry pointing at malware are not a threat model we can solve.
- **Terminal**: arbitrary command execution is the feature. The user is root of their own session.

**Critical invariant**: HL7 data must never flow into the terminal, string generator output, or a launched tool's arguments. Workflow views are siloed — no copy-button in the HL7 view offers to "send to terminal" or "fill string-gen template." Cross-workflow data flow is user-initiated via clipboard only, and the HL7 copy prompt still applies (original vs. de-identified).

---

## Open items

1. **API fields canned XML** — user to supply. Needed before Phase 7; not blocking earlier phases.
2. **String Generator starter templates** — user to provide the specific PowerShell install-invocation and sendcommand/sre CLI formats needed on day one. Not blocking Phase 8 scaffolding; only blocks the out-of-the-box template shipping.
3. **Tool Launcher auto-detect list** — confirm which tools matter most to your team (Weasis, VS Code, Notepad++ confirmed; PuTTY, WinSCP, 7-Zip, WinMerge likely; others TBD). Not blocking Phase 9 — auto-detect list is trivially extensible post-ship.
4. **SignPath Foundation application** — submit once repo is public and has a README. Allow 1–2 weeks for approval.
5. **Unsigned pre-release builds** ship during Phases 1–9. By first external/internal release, SignPath cert should be in place.

## Not doing

- VS Code extension. Consolidated into the Tauri app.
- SharePoint hosting.
- Multi-DataValue per session.
- Editing PS360 templates via PS360's own API (file-based only).
- Reversible PHI masking. One-way only.
- Persisting HL7 messages anywhere on disk.
- Background network activity. Updater is explicit user-action only.
- Telemetry of any kind.

---

## Next actions (in order)

1. `git init`, create public GitHub repo, MIT LICENSE, README with scope statement, NOTICES.md stub.
2. Scaffold pnpm workspace, `core` package with types + empty modules.
3. Build a **scrubbed** version of the provided `sc templates 3-35.xml` for `packages/core/test/fixtures/`. Strip: real owner names (`OwnerFirstName`/`OwnerLastName`), `OwnerAccountID`, real `GUID`/`ParentGUID`/`AutoTextID` values, any `GroupName` that identifies a site. Keep: RTF structure, inner-XML field definitions, clinical terminology (BI-RADS, ultrasound biopsy, etc.).
4. Write Phase 1 property-based round-trip test. Make it fail, then make it pass.
5. Submit SignPath Foundation application in parallel.
6. After Phase 1 exit criteria met, scaffold Tauri shell + Vite frontend (Phase 2).
