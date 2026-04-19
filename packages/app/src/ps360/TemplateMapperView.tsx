import { DataValuePanel } from "./DataValuePanel.js";
import { TemplateList } from "./TemplateList.js";
import { TemplateDetail } from "./TemplateDetail.js";
import { PS360Provider, usePS360 } from "./state.js";
import "./ps360.css";

export function TemplateMapperView() {
  return (
    <PS360Provider>
      <PS360Layout />
    </PS360Provider>
  );
}

function PS360Layout() {
  const { error, clearError } = usePS360();
  return (
    <div className="ps360-view">
      {error !== null && (
        <div className="ps360-error" role="alert">
          <span className="ps360-error-text">{error}</span>
          <button
            type="button"
            className="ps360-error-close"
            onClick={clearError}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      <div className="ps360-grid">
        <aside className="ps360-col ps360-col--left">
          <DataValuePanel />
          <TemplateList />
        </aside>
        <section className="ps360-col ps360-col--right">
          <TemplateDetail />
        </section>
      </div>
    </div>
  );
}
