import { useState } from "react";
import { usePS360 } from "./state.js";
import type {
  FieldMapping,
  MappingDomain,
  ValueMappingItem,
} from "@ise-toolkit/core";

interface DomainRow {
  domain: MappingDomain;
  label: string;
  valueItems?: ValueMappingItem[];
  fieldItems?: FieldMapping[];
}

const DOMAIN_ORDER: ReadonlyArray<{ domain: MappingDomain; label: string }> = [
  { domain: "ReportHeaders", label: "Section Headers" },
  { domain: "Assessment", label: "Assessment Codes" },
  { domain: "Recommendation", label: "Recommendation Codes" },
  { domain: "Laterality", label: "Laterality" },
  { domain: "TissueDensity", label: "Tissue Density" },
  { domain: "Pathology", label: "Pathology" },
  { domain: "PathologyStatus", label: "Pathology Status" },
  { domain: "PathologyComplications", label: "Pathology Complications" },
  { domain: "Site", label: "Sites" },
  { domain: "Patient", label: "Patient Fields" },
  { domain: "Procedure", label: "Procedure Fields" },
  { domain: "SecondaryProcedure", label: "Secondary Procedures" },
];

export function DataValuePanel() {
  const { dataValue, loadDataValue, clearDataValue } = usePS360();

  if (!dataValue) {
    return (
      <div className="dv-panel dv-panel--empty">
        <header className="dv-title-row">
          <h3 className="dv-title">App Configuration</h3>
        </header>
        <p className="dv-description">
          Load the application configuration XML exported from your dictation
          integration. Its mapping lists drive diagnostics and completion
          against your templates.
        </p>
        <button
          type="button"
          className="btn btn--primary dv-load-btn"
          onClick={loadDataValue}
        >
          Load configuration XML
        </button>
      </div>
    );
  }

  const { config, path } = dataValue;
  const rows: DomainRow[] = DOMAIN_ORDER.map(({ domain, label }) => ({
    domain,
    label,
    valueItems: config.mappings[domain],
    fieldItems: config.fieldMappings[domain],
  })).filter(
    (r) => r.valueItems !== undefined || r.fieldItems !== undefined,
  );

  return (
    <div className="dv-panel">
      <header className="dv-title-row">
        <h3 className="dv-title">DataValue configuration</h3>
        <button
          type="button"
          className="btn btn--subtle"
          onClick={clearDataValue}
          title="Unload this configuration file"
        >
          Unload
        </button>
      </header>

      <div className="dv-file-pill" title={path}>
        <span className="dv-file-icon" aria-hidden>▪</span>
        <span className="dv-file-name">{pathTail(path)}</span>
      </div>

      {config.name !== undefined && (
        <div className="dv-meta-inline">
          <span className="dv-meta-label">Name</span>
          <span className="dv-meta-value">{config.name}</span>
        </div>
      )}
      {config.integrationType !== undefined && (
        <div className="dv-meta-inline">
          <span className="dv-meta-label">Type</span>
          <span className="dv-meta-value">{config.integrationType}</span>
        </div>
      )}

      <div className="dv-sections">
        {rows.length === 0 ? (
          <p className="dv-empty-sections">
            No mapping lists present in this file.
          </p>
        ) : (
          rows.map((row) => <DomainSection key={row.domain} row={row} />)
        )}
      </div>
    </div>
  );
}

function DomainSection({ row }: { row: DomainRow }) {
  const [open, setOpen] = useState(false);
  const count =
    (row.valueItems?.length ?? 0) + (row.fieldItems?.length ?? 0);

  return (
    <section className={"dv-section" + (open ? " dv-section--open" : "")}>
      <button
        type="button"
        className="dv-section-head"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="dv-section-arrow" aria-hidden>▶</span>
        <span className="dv-section-label">{row.label}</span>
        <span className="dv-section-count">{count}</span>
      </button>
      {open && (
        <div className="dv-section-body">
          {row.valueItems && row.valueItems.length > 0 && (
            <ValueMappingTable domain={row.domain} items={row.valueItems} />
          )}
          {row.fieldItems && row.fieldItems.length > 0 && (
            <FieldMappingTable items={row.fieldItems} />
          )}
          {count === 0 && (
            <p className="dv-section-empty">(no entries)</p>
          )}
        </div>
      )}
    </section>
  );
}

function ValueMappingTable({
  domain,
  items,
}: {
  domain: MappingDomain;
  items: ValueMappingItem[];
}) {
  const headers = valueHeaderLabels(domain);
  const { pendingMappingEdits, setMappingEdit, clearMappingEdit } = usePS360();

  return (
    <table className="dv-table">
      <thead>
        <tr>
          <th>{headers.left}</th>
          <th>{headers.right}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const key = item.internalGuid;
          const edited = key in pendingMappingEdits;
          const current = edited
            ? pendingMappingEdits[key]!
            : item.externalValue;
          return (
            <tr key={key}>
              <td className="dv-table-key" title={item.internalGuid}>
                {item.displayValue}
              </td>
              <td className="dv-table-value">
                <input
                  type="text"
                  className={
                    "dv-table-input" + (edited ? " dv-table-input--edited" : "")
                  }
                  value={current}
                  onChange={(e) => setMappingEdit(key, e.target.value)}
                  onBlur={() => {
                    if (edited && current === item.externalValue) {
                      clearMappingEdit(key);
                    }
                  }}
                  spellCheck={false}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FieldMappingTable({ items }: { items: FieldMapping[] }) {
  const { pendingMappingEdits, setMappingEdit, clearMappingEdit } = usePS360();

  return (
    <table className="dv-table">
      <thead>
        <tr>
          <th>External</th>
          <th>Internal</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, idx) => {
          const key = `field::${item.externalType}::${item.externalName}`;
          const edited = key in pendingMappingEdits;
          const current = edited
            ? pendingMappingEdits[key]!
            : item.internalName;
          return (
            <tr key={idx}>
              <td className="dv-table-key">
                <div>{item.externalName}</div>
                <div className="dv-table-sub">{item.externalType}</div>
              </td>
              <td className="dv-table-value">
                <input
                  type="text"
                  className={
                    "dv-table-input" + (edited ? " dv-table-input--edited" : "")
                  }
                  value={current}
                  onChange={(e) => setMappingEdit(key, e.target.value)}
                  onBlur={() => {
                    if (edited && current === item.internalName) {
                      clearMappingEdit(key);
                    }
                  }}
                  spellCheck={false}
                />
                <div className="dv-table-sub">{item.internalType}</div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function valueHeaderLabels(domain: MappingDomain): {
  left: string;
  right: string;
} {
  switch (domain) {
    case "Recommendation":
      return { left: "Recommendation Type", right: "Recommendation Value" };
    case "Assessment":
      return { left: "Assessment Code", right: "Value" };
    case "Laterality":
      return { left: "Laterality", right: "Value" };
    case "TissueDensity":
      return { left: "Density", right: "Value" };
    case "PathologyStatus":
      return { left: "Status", right: "Value" };
    case "PathologyComplications":
      return { left: "Complication", right: "Value" };
    case "Pathology":
      return { left: "Pathology", right: "Value" };
    case "Site":
      return { left: "Site", right: "Value" };
    case "ReportHeaders":
      return { left: "Header", right: "Value" };
    default:
      return { left: "Key", right: "Value" };
  }
}

function pathTail(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] ?? p;
}
