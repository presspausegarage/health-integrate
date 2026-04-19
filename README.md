# Health Integrate

A lightweight desktop application for radiology informatics workflows:

- **Template Mapper** — autocomplete, lint, preview, bulk-edit, and smoke-test dictation template XML files against a user-supplied integration configuration.
- **HL7 Viewer** — paste plain-text HL7 messages from logs or clipboard, see them tokenized and automatically de-identified in real time.
- **String Generator** — form-driven builder for parameterized command strings (PowerShell, installer CLIs).
- **Tool Launcher** — dashboard of shortcuts to externally-installed tools (Weasis, VS Code, Notepad++, etc.).
- **Integrated Terminal** — embedded terminal (PowerShell / cmd / WSL / bash) for CLI work without context-switching.

All five workflows live in a single per-user Windows installer — no admin rights required.

## Status

Early development. See [PLAN.md](PLAN.md) for the architecture and phase plan.

## Development prerequisites

- **Node.js** 20+ (latest LTS recommended)
- **Rust** via [rustup](https://rustup.rs) — required to build and run the Tauri shell.
  - On Windows, `rustup-init.exe` handles the install and sets up `cargo` / `rustc` on the `PATH`.
  - Tauri additionally requires [Microsoft Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) on Windows (`Desktop development with C++` workload).
- **WebView2** is pre-installed on Windows 10 21H2+ and Windows 11. Older Windows 10 builds need the [WebView2 Evergreen Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

## Development commands

```bash
# Install dependencies
npm install

# Run the core library tests (no Rust required)
npm test --workspace=@ise-toolkit/core

# Typecheck all workspaces
npm run typecheck

# Launch the Tauri dev app (requires Rust)
npm run dev

# Produce a release build + NSIS installer (requires Rust)
npm run dist
```

## License

MIT. See [LICENSE](LICENSE).

## Third-party components

See [NOTICES.md](NOTICES.md).

## About configuration files

This tool interfaces with XML integration configurations exported from radiology dictation and voice-recognition systems. Configuration files are vendor- and customer-specific and are **not distributed with this tool**. Provide your own configuration file at runtime via the app's settings.

## PHI handling

The HL7 Viewer performs best-effort de-identification for developer debugging and QA workflows. It is **not a certified HIPAA Safe Harbor tool**. Do not rely on it as a sole de-identification layer for data you intend to share or publish.
