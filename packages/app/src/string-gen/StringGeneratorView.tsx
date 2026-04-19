import { PlaceholderView } from "../shared/PlaceholderView.js";

export function StringGeneratorView() {
  return (
    <PlaceholderView
      title="String Generator"
      description="Form-driven builder for parameterized command strings. Pick a template, fill a form, copy the rendered output."
      phase="Phase 8"
      bullets={[
        "Template picker + variable form (left pane)",
        "Live-rendered output with Monaco syntax highlighting (right pane)",
        "Variable types: string, multiline, bool, enum, path, secret",
        "Save current values as per-template preset (secrets excluded)",
        "Ship with PowerShell + sendcommand/sre starter templates",
      ]}
    />
  );
}
