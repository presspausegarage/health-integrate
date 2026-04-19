import { PlaceholderView } from "../shared/PlaceholderView.js";

export function TemplateMapperView() {
  return (
    <PlaceholderView
      title="PS360 Template Mapper"
      description="Autocomplete, lint, preview, bulk-edit, and smoke-test PowerScribe 360 PortalAutoTextExport files against a user-supplied integration configuration."
      phase="Phases 3–4"
      bullets={[
        "Load DataValue.xml via drag-drop or settings",
        "Load template XML, parse via @ise-toolkit/core",
        "Monaco editor with diagnostics, hover, completion",
        "Preview pane with inline editable fields",
        "Normalize + diff export (save-as only, never overwrite)",
        "Smoke-test all workflow templates",
      ]}
    />
  );
}
