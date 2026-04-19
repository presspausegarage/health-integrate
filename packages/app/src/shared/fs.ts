// Typed wrappers around Tauri's file APIs.
//
// Users open files via a native dialog; we then pass the returned absolute
// path to our own `read_text_file` Rust command. This keeps the fs plugin
// scope tight — arbitrary reads are only allowed on paths the user just
// picked.

import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

export interface XmlFilePick {
  path: string;
  content: string;
}

export interface PickXmlOptions {
  title?: string;
  multiple?: boolean;
}

export async function pickXmlFile(
  options: PickXmlOptions = {},
): Promise<XmlFilePick | null> {
  const selected = await open({
    title: options.title ?? "Open XML file",
    multiple: false,
    directory: false,
    filters: [
      { name: "XML", extensions: ["xml"] },
      { name: "All files", extensions: ["*"] },
    ],
  });

  if (selected === null || Array.isArray(selected)) return null;
  const content = await invoke<string>("read_text_file", { path: selected });
  return { path: selected, content };
}

export async function pickXmlFiles(
  options: PickXmlOptions = {},
): Promise<XmlFilePick[]> {
  const selected = await open({
    title: options.title ?? "Open XML files",
    multiple: true,
    directory: false,
    filters: [
      { name: "XML", extensions: ["xml"] },
      { name: "All files", extensions: ["*"] },
    ],
  });

  if (selected === null) return [];
  const paths = Array.isArray(selected) ? selected : [selected];
  const out: XmlFilePick[] = [];
  for (const path of paths) {
    const content = await invoke<string>("read_text_file", { path });
    out.push({ path, content });
  }
  return out;
}
