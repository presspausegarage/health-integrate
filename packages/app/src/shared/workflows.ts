export type WorkflowId =
  | "ps360"
  | "hl7"
  | "string-gen"
  | "tools"
  | "terminal";

export type WorkflowGroup = "radiology" | "utilities";

export interface WorkflowMeta {
  id: WorkflowId;
  label: string;
  group: WorkflowGroup;
  shortLabel: string;
  description: string;
}

export const WORKFLOWS: readonly WorkflowMeta[] = [
  {
    id: "ps360",
    label: "PS360 Template Mapper",
    shortLabel: "PS360",
    group: "radiology",
    description: "Parse, lint, and normalize PS360 PortalAutoTextExport files.",
  },
  {
    id: "hl7",
    label: "HL7 Viewer",
    shortLabel: "HL7",
    group: "radiology",
    description: "Paste plain-text HL7 messages, see them tokenized and de-identified.",
  },
  {
    id: "string-gen",
    label: "String Generator",
    shortLabel: "Strings",
    group: "utilities",
    description: "Build parameterized command strings from templates.",
  },
  {
    id: "tools",
    label: "Tool Launcher",
    shortLabel: "Tools",
    group: "utilities",
    description: "Shortcuts to externally-installed tools.",
  },
  {
    id: "terminal",
    label: "Terminal",
    shortLabel: "Terminal",
    group: "utilities",
    description: "Embedded PowerShell / cmd / WSL / bash.",
  },
] as const;

export const GROUP_LABELS: Record<WorkflowGroup, string> = {
  radiology: "Radiology",
  utilities: "Utilities",
};
