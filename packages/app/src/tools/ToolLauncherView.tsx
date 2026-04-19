import { PlaceholderView } from "../shared/PlaceholderView.js";

export function ToolLauncherView() {
  return (
    <PlaceholderView
      title="Tool Launcher"
      description="Shortcuts to externally-installed tools. Not a package manager — just a dashboard of click-to-launch buttons for what your team already has installed."
      phase="Phase 9"
      bullets={[
        "Auto-detect Weasis, VS Code, Notepad++, 7-Zip, WinMerge, PuTTY, WinSCP on first run",
        "User-configurable: Add Tool dialog (name, exe path, args, icon)",
        "Grid of cards; right-click to edit/remove",
        "Launch via Tauri shell.open with strict path allowlist",
      ]}
    />
  );
}
