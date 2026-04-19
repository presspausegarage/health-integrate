import { useState } from "react";
import { Sidebar } from "./shared/Sidebar.js";
import { TemplateMapperView } from "./ps360/TemplateMapperView.js";
import { HL7ViewerView } from "./hl7/HL7ViewerView.js";
import { StringGeneratorView } from "./string-gen/StringGeneratorView.js";
import { ToolLauncherView } from "./tools/ToolLauncherView.js";
import { TerminalView } from "./terminal/TerminalView.js";
import type { WorkflowId } from "./shared/workflows.js";

export function App() {
  const [active, setActive] = useState<WorkflowId>("ps360");

  return (
    <div className="app-shell">
      <Sidebar active={active} onSelect={setActive} />
      <main className="app-main">
        {active === "ps360" && <TemplateMapperView />}
        {active === "hl7" && <HL7ViewerView />}
        {active === "string-gen" && <StringGeneratorView />}
        {active === "tools" && <ToolLauncherView />}
        {active === "terminal" && <TerminalView />}
      </main>
    </div>
  );
}
