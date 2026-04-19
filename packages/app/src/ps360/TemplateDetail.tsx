import { useMemo } from "react";
import type { AutoText, InnerField } from "@ise-toolkit/core";
import { Editor } from "../shared/monaco.js";
import { findAutoText, usePS360 } from "./state.js";

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

  const { autoText } = resolved;

  return (
    <div className="td-panel">
      <header className="td-head">
        <div className="td-head-main">
          <h2 className="td-title">{autoText.name}</h2>
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
          <span className="td-tag td-tag--fields">
            {autoText.inner.fields.length} fields
          </span>
        </div>
      </header>

      <div className="td-body">
        <section className="td-section">
          <h3 className="td-section-heading">Rendered text</h3>
          <div className="td-editor">
            <Editor
              value={autoText.contentText}
              language="plaintext"
              theme="vs-dark"
              options={{
                readOnly: true,
                fontSize: 12,
                fontFamily: "JetBrains Mono, Consolas, Menlo, monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "on",
                lineNumbers: "on",
                renderWhitespace: "selection",
                padding: { top: 8, bottom: 8 },
              }}
            />
          </div>
        </section>

        <section className="td-section">
          <h3 className="td-section-heading">
            Fields <span className="td-count">{autoText.inner.fields.length}</span>
          </h3>
          <ul className="td-fields">
            {autoText.inner.fields.map((f, idx) => (
              <FieldRow key={idx} field={f} />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function FieldRow({ field }: { field: InnerField }) {
  const typeLabel = FIELD_TYPE_LABELS[field.type] ?? `Type ${field.type}`;
  return (
    <li className="td-field">
      <div className="td-field-row">
        <span className="td-field-name">{field.name}</span>
        <span className="td-field-type">{typeLabel}</span>
        <span className="td-field-pos">
          @{field.start}+{field.length}
        </span>
      </div>

      {field.mergeid !== undefined && field.mergeid !== "" && (
        <div className="td-field-sub">
          <span className="td-field-sub-label">merge</span>
          <code className="td-field-sub-value">
            {field.mergeid}
            {field.mergename && field.mergename !== "" ? ` (${field.mergename})` : ""}
          </code>
        </div>
      )}

      {field.defaultValue !== undefined && (
        <div className="td-field-sub">
          <span className="td-field-sub-label">default</span>
          <code className="td-field-sub-value td-field-default">
            {truncate(field.defaultValue.replace(/\s+/g, " "), 140)}
          </code>
        </div>
      )}

      {field.defaultValueAutoTextId !== undefined && (
        <div className="td-field-sub">
          <span className="td-field-sub-label">autotext-ref</span>
          <code className="td-field-sub-value">
            #{field.defaultValueAutoTextId}
            {field.defaultValueAutoTextName ? ` (${field.defaultValueAutoTextName})` : ""}
          </code>
        </div>
      )}

      {field.choices && field.choices.length > 0 && (
        <details className="td-field-choices">
          <summary>
            <span className="td-field-sub-label">choices</span>
            <span className="td-field-choice-count">{field.choices.length}</span>
          </summary>
          <ul>
            {field.choices.map((c, i) => (
              <li key={i} className="td-choice">
                <span className="td-choice-name">{c.name || <em>(unnamed)</em>}</span>
                <span className="td-choice-text">{truncate(c.text, 120)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}
