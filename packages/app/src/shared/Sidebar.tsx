import { GROUP_LABELS, WORKFLOWS } from "./workflows.js";
import type { WorkflowGroup, WorkflowId } from "./workflows.js";

interface Props {
  active: WorkflowId;
  onSelect: (id: WorkflowId) => void;
}

export function Sidebar({ active, onSelect }: Props) {
  const groups: WorkflowGroup[] = ["radiology", "utilities"];

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <span className="sidebar-title">ISE Toolkit</span>
        <span className="sidebar-version">v0.0.0</span>
      </header>
      <nav className="sidebar-nav">
        {groups.map((group) => (
          <section key={group} className="sidebar-section">
            <h2 className="sidebar-group-label">{GROUP_LABELS[group]}</h2>
            <ul className="sidebar-list">
              {WORKFLOWS.filter((w) => w.group === group).map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    className={
                      "sidebar-item" + (active === w.id ? " is-active" : "")
                    }
                    onClick={() => onSelect(w.id)}
                    title={w.description}
                  >
                    <span className="sidebar-item-label">{w.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
      <footer className="sidebar-footer">
        <span className="sidebar-badge">AI assisted</span>
      </footer>
    </aside>
  );
}
