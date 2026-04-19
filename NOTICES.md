# Third-Party Notices

This project incorporates components from the following third-party projects.
All are compatible with the MIT License under which this project is distributed.

## Planned dependencies

These will be added as their respective phases land. Attribution is recorded here pre-emptively so the NOTICES file stays accurate.

### vscode-hl7 TextMate grammar
- Source: https://github.com/pagebrooks/vscode-hl7
- License: MIT
- Usage: HL7 syntax grammar vendored for Monaco-based tokenization in the HL7 Viewer workflow.
- Status: not yet vendored (Phase 6).

### Monaco Editor
- Source: https://github.com/microsoft/monaco-editor
- License: MIT
- Usage: Code editor powering PS360, HL7, and String Generator views.
- Status: integrated as dependency (UI integration lands in Phase 3).

### @monaco-editor/react
- Source: https://github.com/suren-atoyan/monaco-react
- License: MIT
- Usage: React wrapper for Monaco Editor.
- Status: integrated as dependency.

### React and React DOM
- Source: https://github.com/facebook/react
- License: MIT
- Usage: Frontend UI framework.
- Status: integrated.

### Vite
- Source: https://github.com/vitejs/vite
- License: MIT
- Usage: Frontend build tool and dev server.
- Status: integrated.

### @vitejs/plugin-react
- Source: https://github.com/vitejs/vite-plugin-react
- License: MIT
- Usage: Vite integration for React Fast Refresh.
- Status: integrated.

### xterm.js
- Source: https://github.com/xtermjs/xterm.js
- License: MIT
- Usage: Terminal emulator frontend (Phase 10).
- Status: not yet integrated.

### Tauri
- Source: https://github.com/tauri-apps/tauri
- License: MIT / Apache-2.0
- Usage: Desktop application shell, bundler, NSIS installer generation.
- Status: integrated (Phase 2 scaffold).

### Tauri plugins (shell, dialog, clipboard-manager, fs)
- Source: https://github.com/tauri-apps/plugins-workspace
- License: MIT / Apache-2.0
- Usage: Native capabilities exposed to the frontend (tool launching, file dialogs, clipboard, file I/O).
- Status: integrated.

### fast-xml-parser
- Source: https://github.com/NaturalIntelligence/fast-xml-parser
- License: MIT
- Usage: XML parsing in `@ise-toolkit/core`.
- Status: integrated.

### fast-check
- Source: https://github.com/dubzzz/fast-check
- License: MIT
- Usage: Property-based testing in `@ise-toolkit/core`.
- Status: integrated.

### Vitest
- Source: https://github.com/vitest-dev/vitest
- License: MIT
- Usage: Unit and property-based test runner.
- Status: integrated.
