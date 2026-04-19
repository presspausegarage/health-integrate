import { PlaceholderView } from "../shared/PlaceholderView.js";

export function TerminalView() {
  return (
    <PlaceholderView
      title="Integrated Terminal"
      description="Embedded terminal for CLI installers, sendcommand/sre tools, and WSL sessions. xterm.js frontend bridged to a portable-pty Rust backend."
      phase="Phase 10"
      bullets={[
        "Shells: PowerShell (default), cmd, WSL distributions, Git Bash",
        "Tabs for concurrent sessions",
        "No command history recorded by the app",
        "Clean pty teardown on tab/app close",
        "Selection-to-clipboard toggle in settings",
      ]}
    />
  );
}
