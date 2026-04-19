import { PlaceholderView } from "../shared/PlaceholderView.js";

export function HL7ViewerView() {
  return (
    <PlaceholderView
      title="HL7 Viewer"
      description="Paste plain-text HL7 messages from logs or clipboard, see them tokenized and automatically de-identified in real time. In-memory only; no HL7 content ever hits disk."
      phase="Phase 6 (PHI masker lands in Phase 5)"
      bullets={[
        "Paste area: Monaco with vendored vscode-hl7 TextMate grammar",
        "De-identified view: PHI auto-masked, free-text flags highlighted",
        "Findings panel: segment validation, PHI flags, hover info",
        "Copy prompt: original vs. de-identified (default: de-identified)",
        "Status bar: PHI mode ON, always, non-toggleable",
      ]}
    />
  );
}
