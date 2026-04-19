import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AutoText, InnerField, LintDiagnostic } from "@health-integrate/core";
import { lintTemplate } from "@health-integrate/core";
import { Editor, monaco } from "../shared/monaco.js";
import type { editor } from "monaco-editor/esm/vs/editor/editor.api";
import { findAutoText, usePS360 } from "./state.js";

const MARKER_OWNER = "health-integrate";

const FIELD_TYPE_LABELS: Record<string, string> = {
  "1": "Text field",
  "3": "Pick list",
  "4": "Merge field",
  "5": "Embedded autotext",
  "12": "Range marker",
};

export function TemplateDetail() {
  const state = usePS360();
  const { selectedAutoText } = state;

  const resolved = useMemo(
    () => findAutoText(state, selectedAutoText?.file, selectedAutoText?.name),
    [state, selectedAutoText],
  );

  if (!resolved) {
    return (
      <div className="td-panel td-panel--empty">
        <p className="td-empty">Select a template from the list to inspect it.</p>
      </div>
    );
  }

  return (
    <TemplateDetailInner
      key={`${resolved.file.path}::${resolved.autoText.name}`}
      autoText={resolved.autoText}
    />
  );
}

function TemplateDetailInner({ autoText }: { autoText: AutoText }) {
  const { dataValue } = usePS360();
  const fields = autoText.inner.fields;
  const [currentText, setCurrentText] = useState(autoText.contentText);
  const [selectedFieldIdx, setSelectedFieldIdx] = useState<number | null>(
    fields.length > 0 ? 0 : null,
  );
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    setCurrentText(autoText.contentText);
    setSelectedFieldIdx(fields.length > 0 ? 0 : null);
  }, [autoText, fields.length]);

  const dirty = currentText !== autoText.contentText;

  const diagnostics = useMemo<LintDiagnostic[]>(() => {
    if (!dataValue) return [];
    return lintTemplate(currentText, dataValue.config, { fields });
  }, [currentText, dataValue, fields]);

  // Apply diagnostics as Monaco markers whenever they change.
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const model = ed.getModel();
    if (!model) return;

    const markers: editor.IMarkerData[] = diagnostics.map((d) => {
      const startPos = model.getPositionAt(d.start);
      const endPos = model.getPositionAt(d.end);
      return {
        severity:
          d.severity === "error"
            ? monaco.MarkerSeverity.Error
            : d.severity === "warning"
              ? monaco.MarkerSeverity.Warning
              : monaco.MarkerSeverity.Info,
        startLineNumber: startPos.lineNumber,
        startColumn: startPos.column,
        endLineNumber: endPos.lineNumber,
        endColumn: endPos.column,
        message: d.message,
        code: d.code,
        source: "Health Integrate",
      };
    });

    monaco.editor.setModelMarkers(model, MARKER_OWNER, markers);
  }, [diagnostics]);

  const handleEditorMount = useCallback(
    (instance: editor.IStandaloneCodeEditor) => {
      editorRef.current = instance;
    },
    [],
  );

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) setCurrentText(value);
  }, []);

  const selected = selectedFieldIdx !== null ? fields[selectedFieldIdx] : null;

  const updateChoiceDictation = useCallback(
    (fieldName: string, choiceIdx: number, newValue: string) => {
      setCurrentText((text) =>
        replacePicklistChoiceInText(text, fieldName, choiceIdx, newValue),
      );
    },
    [],
  );

  const applyDiagnosticFix = useCallback(
    (d: LintDiagnostic) => {
      if (d.suggestion === undefined) return;
      setCurrentText(
        (text) => text.slice(0, d.start) + d.suggestion + text.slice(d.end),
      );
    },
    [],
  );

  return (
    <div className="td-panel">
      <header className="td-head">
        <div className="td-head-main">
          <h2 className="td-title">
            {autoText.name}
            {dirty && <span className="td-dirty-dot" title="Unsaved edits">•</span>}
          </h2>
          {autoText.description !== undefined &&
            autoText.description !== autoText.name && (
              <p className="td-subtitle">{autoText.description}</p>
            )}
        </div>
        <div className="td-meta">
          {autoText.groupName !== undefined && (
            <span className="td-tag td-tag--group">{autoText.groupName}</span>
          )}
          {autoText.autoTextId !== undefined && (
            <span className="td-tag td-tag--id">#{autoText.autoTextId}</span>
          )}
          <span className="td-tag td-tag--fields">{fields.length} fields</span>
          {diagnostics.length > 0 && (
            <span className="td-tag td-tag--lint">
              {diagnostics.length} {diagnostics.length === 1 ? "issue" : "issues"}
            </span>
          )}
        </div>
      </header>

      <div className="td-editor-area">
        <div className="td-editor-wrap">
          <Editor
            value={currentText}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            language="plaintext"
            theme="vs-dark"
            options={{
              fontSize: 13,
              fontFamily: "JetBrains Mono, Consolas, Menlo, monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: "on",
              lineNumbers: "on",
              renderWhitespace: "selection",
              padding: { top: 12, bottom: 12 },
              automaticLayout: true,
            }}
          />
        </div>
        {diagnostics.length > 0 && (
          <DiagnosticList
            diagnostics={diagnostics}
            text={currentText}
            onApplyFix={applyDiagnosticFix}
            onJump={(d) => {
              const ed = editorRef.current;
              if (!ed) return;
              const model = ed.getModel();
              if (!model) return;
              const pos = model.getPositionAt(d.start);
              ed.revealPositionInCenter(pos);
              ed.setPosition(pos);
              ed.focus();
            }}
          />
        )}
      </div>

      <div className="td-picklist">
        <div className="td-picklist-tabs">
          {fields.length === 0 ? (
            <span className="td-picklist-empty">No fields in this template.</span>
          ) : (
            fields.map((f, idx) => {
              const isActive = idx === selectedFieldIdx;
              const label = fieldTabLabel(f);
              return (
                <button
                  key={idx}
                  type="button"
                  className={
                    "td-picklist-tab" +
                    (isActive ? " td-picklist-tab--active" : "") +
                    " td-picklist-tab--type-" +
                    f.type
                  }
                  onClick={() => setSelectedFieldIdx(idx)}
                  title={`${FIELD_TYPE_LABELS[f.type] ?? f.type} — position ${f.start}+${f.length}`}
                >
                  <span className="td-picklist-tab-label">{label}</span>
                </button>
              );
            })
          )}
        </div>

        <div className="td-picklist-body">
          {selected ? (
            <SelectedFieldView
              field={selected}
              currentText={currentText}
              onChangeChoice={updateChoiceDictation}
            />
          ) : (
            <p className="td-picklist-empty-body">
              Select a field above to view or edit its values.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function fieldTabLabel(f: InnerField): string {
  if (f.mergename && f.mergename !== "") return f.mergename;
  return f.name || "(unnamed)";
}

function DiagnosticList({
  diagnostics,
  text,
  onApplyFix,
  onJump,
}: {
  diagnostics: LintDiagnostic[];
  text: string;
  onApplyFix: (d: LintDiagnostic) => void;
  onJump: (d: LintDiagnostic) => void;
}) {
  const fixable = diagnostics.filter((d) => d.suggestion !== undefined);
  const applyAll = () => {
    // Apply fixes right-to-left so earlier offsets stay valid.
    const sorted = [...fixable].sort((a, b) => b.start - a.start);
    for (const d of sorted) onApplyFix(d);
  };

  return (
    <div className="td-diag">
      <div className="td-diag-head">
        <span className="td-diag-title">
          {diagnostics.length} {diagnostics.length === 1 ? "issue" : "issues"}
        </span>
        {fixable.length > 0 && (
          <button type="button" className="btn btn--subtle" onClick={applyAll}>
            Fix all ({fixable.length})
          </button>
        )}
      </div>
      <ul className="td-diag-list">
        {diagnostics.map((d, i) => {
          const found = text.slice(d.start, d.end);
          return (
            <li key={i} className={"td-diag-item td-diag-item--" + d.severity}>
              <button
                type="button"
                className="td-diag-jump"
                onClick={() => onJump(d)}
                title="Jump to location in editor"
              >
                <span className="td-diag-code">{d.code}</span>
                <span className="td-diag-message">
                  <code>{found}</code>
                  {d.suggestion !== undefined && (
                    <>
                      {" "}→ <code className="td-diag-suggestion">{d.suggestion}</code>
                    </>
                  )}
                </span>
              </button>
              {d.suggestion !== undefined && (
                <button
                  type="button"
                  className="btn btn--subtle td-diag-fix"
                  onClick={() => onApplyFix(d)}
                  title={`Replace with "${d.suggestion}"`}
                >
                  Fix
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface LiveChoice {
  /** The key the AST defined for this slot, if available. */
  astKey?: string;
  /** The current dictation text in the editor. */
  text: string;
}

function SelectedFieldView({
  field,
  currentText,
  onChangeChoice,
}: {
  field: InnerField;
  currentText: string;
  onChangeChoice: (fieldName: string, choiceIdx: number, newValue: string) => void;
}) {
  const typeLabel = FIELD_TYPE_LABELS[field.type] ?? `Type ${field.type}`;

  const liveChoices = useMemo<LiveChoice[] | null>(() => {
    if (field.type !== "3") return null;
    const live = extractLivePicklistChoices(currentText, field.name);
    const astChoices = field.choices ?? [];
    if (live === null) {
      // Field not found in current text — fall back to AST choices for display.
      return astChoices.map((c) => ({ astKey: c.name, text: c.text }));
    }
    // Pair live text values with AST keys by index (best-effort).
    return live.map((text, i) => ({
      astKey: astChoices[i]?.name,
      text,
    }));
  }, [field, currentText]);

  return (
    <div className="td-field-detail">
      <div className="td-field-detail-head">
        <span className="td-field-detail-name">{field.name || "(unnamed)"}</span>
        <span className="td-field-detail-type">{typeLabel}</span>
        <span className="td-field-detail-pos">
          @{field.start}+{field.length}
        </span>
      </div>

      {field.mergeid !== undefined && field.mergeid !== "" && (
        <div className="td-field-detail-sub">
          <span className="td-field-detail-label">Merge</span>
          <code className="td-field-detail-value">
            {field.mergeid}
            {field.mergename && field.mergename !== ""
              ? ` (${field.mergename})`
              : ""}
          </code>
        </div>
      )}

      {field.defaultValueAutoTextId !== undefined && (
        <div className="td-field-detail-sub">
          <span className="td-field-detail-label">Autotext ref</span>
          <code className="td-field-detail-value">
            #{field.defaultValueAutoTextId}
            {field.defaultValueAutoTextName
              ? ` (${field.defaultValueAutoTextName})`
              : ""}
          </code>
        </div>
      )}

      {field.type !== "3" &&
        field.defaultValue !== undefined &&
        field.defaultValueAutoTextId === undefined && (
          <div className="td-field-detail-sub">
            <span className="td-field-detail-label">Default</span>
            <input
              type="text"
              className="td-field-detail-input"
              defaultValue={field.defaultValue}
              placeholder="Dictation text"
              spellCheck={false}
            />
          </div>
        )}

      {liveChoices && liveChoices.length > 0 ? (
        <div className="td-choices">
          <div className="td-choices-head">
            <span className="td-choices-label">Pick list values</span>
            <span className="td-choices-count">{liveChoices.length}</span>
          </div>
          <table className="td-choices-table">
            <thead>
              <tr>
                <th>Key (matches DataValue)</th>
                <th>Dictation text</th>
              </tr>
            </thead>
            <tbody>
              {liveChoices.map((c, i) => (
                <tr key={i}>
                  <td className="td-choices-key">
                    {c.astKey ? (
                      c.astKey
                    ) : (
                      <em className="td-choices-unnamed">(no key)</em>
                    )}
                  </td>
                  <td className="td-choices-value">
                    <input
                      type="text"
                      className="td-choices-input"
                      value={c.text}
                      onChange={(e) => onChangeChoice(field.name, i, e.target.value)}
                      spellCheck={false}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : field.type === "3" ? (
        <div className="td-choices-empty">
          Pick list with no choices defined in the current text.
        </div>
      ) : null}
    </div>
  );
}

/**
 * Find a picklist field's live choices by locating `<fieldName>:` in the
 * rendered text. The slice after the colon, up to the end of the line,
 * is split on `/` to recover the current choice list.
 *
 * Returns null if the field pattern isn't found (e.g. deleted in editor).
 */
function extractLivePicklistChoices(
  text: string,
  fieldName: string,
): string[] | null {
  if (!fieldName) return null;
  const pattern = `${fieldName}:`;
  const idx = text.indexOf(pattern);
  if (idx === -1) return null;
  const start = idx + pattern.length;
  let end = text.indexOf("\n", start);
  if (end === -1) end = text.length;
  const segment = text.slice(start, end);
  const parts = segment.split("/");
  // Only treat as a picklist region if at least one `/` separator appears
  // (otherwise it's likely a text field or a header where the match was
  // accidental).
  if (parts.length < 2) return null;
  return parts;
}

/**
 * Replace one picklist choice's dictation text in place in the rendered
 * text. Uses the same `<fieldName>:...` anchor as the extractor so the
 * two stay consistent.
 */
function replacePicklistChoiceInText(
  text: string,
  fieldName: string,
  choiceIdx: number,
  newValue: string,
): string {
  if (!fieldName) return text;
  const pattern = `${fieldName}:`;
  const idx = text.indexOf(pattern);
  if (idx === -1) return text;
  const start = idx + pattern.length;
  let end = text.indexOf("\n", start);
  if (end === -1) end = text.length;
  const segment = text.slice(start, end);
  const choices = segment.split("/");
  if (choiceIdx < 0 || choiceIdx >= choices.length) return text;
  choices[choiceIdx] = newValue;
  return text.slice(0, start) + choices.join("/") + text.slice(end);
}
