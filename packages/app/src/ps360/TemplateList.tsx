import { useMemo, useState } from "react";
import type { AutoText } from "@ise-toolkit/core";
import { usePS360 } from "./state.js";

interface TemplateRow {
  filePath: string;
  fileTail: string;
  autoText: AutoText;
}

export function TemplateList() {
  const {
    templateFiles,
    selectedAutoText,
    loadTemplates,
    selectAutoText,
    removeTemplateFile,
  } = usePS360();
  const [query, setQuery] = useState("");

  const rows = useMemo<TemplateRow[]>(() => {
    const q = query.trim().toLowerCase();
    const all: TemplateRow[] = [];
    for (const file of templateFiles) {
      const tail = pathTail(file.path);
      for (const at of file.doc.autoTexts) {
        if (q === "") {
          all.push({ filePath: file.path, fileTail: tail, autoText: at });
          continue;
        }
        const haystack = `${at.name} ${at.groupName ?? ""} ${at.description ?? ""}`.toLowerCase();
        if (haystack.includes(q)) {
          all.push({ filePath: file.path, fileTail: tail, autoText: at });
        }
      }
    }
    return all;
  }, [templateFiles, query]);

  const grouped = useMemo(() => {
    const byGroup = new Map<string, TemplateRow[]>();
    for (const row of rows) {
      const key = `${row.fileTail} — ${row.autoText.groupName ?? "(no group)"}`;
      const arr = byGroup.get(key) ?? [];
      arr.push(row);
      byGroup.set(key, arr);
    }
    return Array.from(byGroup.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  return (
    <div className="tl-panel">
      <div className="tl-head">
        <h3 className="tl-heading">Templates</h3>
        <button type="button" className="btn btn--primary" onClick={loadTemplates}>
          Load template XML
        </button>
      </div>

      {templateFiles.length === 0 ? (
        <p className="tl-empty">
          No templates loaded. Pick one or more dictation template XML files.
        </p>
      ) : (
        <>
          <div className="tl-files">
            {templateFiles.map((f) => (
              <div key={f.path} className="tl-file-pill" title={f.path}>
                <span className="tl-file-pill-label">{pathTail(f.path)}</span>
                <span className="tl-file-pill-count">{f.doc.autoTexts.length}</span>
                <button
                  type="button"
                  className="tl-file-pill-close"
                  onClick={() => removeTemplateFile(f.path)}
                  aria-label={`Unload ${pathTail(f.path)}`}
                  title="Unload this file"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <input
            type="search"
            className="tl-search"
            placeholder="Filter by name, group, or description"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <div className="tl-list">
            {grouped.length === 0 ? (
              <p className="tl-empty">No templates match "{query}".</p>
            ) : (
              grouped.map(([groupKey, groupRows]) => (
                <section key={groupKey} className="tl-group">
                  <h4 className="tl-group-label">{groupKey}</h4>
                  <ul className="tl-items">
                    {groupRows.map((row) => {
                      const active =
                        selectedAutoText?.file === row.filePath &&
                        selectedAutoText?.name === row.autoText.name;
                      return (
                        <li key={`${row.filePath}::${row.autoText.name}`}>
                          <button
                            type="button"
                            className={
                              "tl-item" + (active ? " tl-item--active" : "")
                            }
                            onClick={() =>
                              selectAutoText(row.filePath, row.autoText.name)
                            }
                          >
                            <span className="tl-item-name">{row.autoText.name}</span>
                            <span className="tl-item-badge">
                              {row.autoText.inner.fields.length} fields
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function pathTail(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] ?? p;
}
