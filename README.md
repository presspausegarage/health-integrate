# ISE Toolkit

A lightweight desktop application for radiology informatics workflows:

- **PS360 Template Mapper** — autocomplete, lint, preview, bulk-edit, and smoke-test PowerScribe 360 `PortalAutoTextExport` XML files against a user-supplied integration configuration.
- **HL7 Viewer** — paste plain-text HL7 messages from logs or clipboard, see them tokenized and automatically de-identified in real time.
- **String Generator** — form-driven builder for parameterized command strings (PowerShell, installer CLIs).
- **Tool Launcher** — dashboard of shortcuts to externally-installed tools (Weasis, VS Code, Notepad++, etc.).
- **Integrated Terminal** — embedded terminal (PowerShell / cmd / WSL / bash) for CLI work without context-switching.

All five workflows live in a single per-user Windows installer — no admin rights required.

## Status

Early development. See [PLAN.md](PLAN.md) for the architecture and phase plan.

## License

MIT. See [LICENSE](LICENSE).

## Third-party components

See [NOTICES.md](NOTICES.md).

## About vendor data

This tool interfaces with XML integration configurations exported from radiology voice-recognition and dictation systems. Configuration files are vendor- and customer-specific and are **not distributed with this tool**. Provide your own configuration file at runtime via the app's settings.

## PHI handling

The HL7 Viewer performs best-effort de-identification for developer debugging and QA workflows. It is **not a certified HIPAA Safe Harbor tool**. Do not rely on it as a sole de-identification layer for data you intend to share or publish. See [docs/threat-model.md](docs/threat-model.md) once written.
