// Monaco editor setup. Must be imported before any Editor/DiffEditor renders.
//
// Tauri's CSP blocks external script loads, so we cannot let
// @monaco-editor/react fetch Monaco from unpkg (its default). Instead we
// bundle monaco-editor locally via Vite and point the loader at it.
//
// We import the minimal core (`editor.api`) only — no built-in languages.
// Each workflow view registers the languages it needs (custom XML tokenizer
// for PS360, vendored vscode-hl7 grammar for HL7, PowerShell for String
// Generator). This keeps the main bundle small and avoids pulling in the
// full set of Monaco language modes (~7 MB of unrelated code).
//
// The base editor worker handles generic tokenization for plaintext and any
// Monarch-defined languages we register. Language-specific workers (json,
// ts, css) are not needed for our workflows.

import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import { loader } from "@monaco-editor/react";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

(self as unknown as { MonacoEnvironment?: monaco.Environment }).MonacoEnvironment = {
  getWorker(_moduleId: string, _label: string): Worker {
    return new editorWorker();
  },
};

loader.config({ monaco });

export { monaco };
export { Editor, DiffEditor } from "@monaco-editor/react";
