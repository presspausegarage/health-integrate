import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  parseDataValue,
  parsePortalAutoText,
  type AutoText,
  type DataValueConfig,
  type PortalAutoTextExport,
} from "@ise-toolkit/core";
import { pickXmlFile, pickXmlFiles } from "../shared/fs.js";

export interface LoadedDataValue {
  path: string;
  config: DataValueConfig;
}

export interface LoadedTemplateFile {
  path: string;
  doc: PortalAutoTextExport;
}

export interface PS360State {
  dataValue: LoadedDataValue | null;
  templateFiles: LoadedTemplateFile[];
  selectedAutoText: { file: string; name: string } | null;
  error: string | null;

  /**
   * Pending in-memory edits to DataValue mapping values. Keyed by
   * "<internalGuid>" (value mappings) or "<externalName>::<externalType>"
   * (field mappings). Edits don't mutate the loaded config; they're
   * overlaid at render time and used during normalize/smoke-test as
   * canonical values. Cleared when the DataValue is unloaded.
   */
  pendingMappingEdits: Record<string, string>;

  loadDataValue: () => Promise<void>;
  loadTemplates: () => Promise<void>;
  selectAutoText: (filePath: string, autoTextName: string) => void;
  clearError: () => void;
  clearDataValue: () => void;
  removeTemplateFile: (path: string) => void;
  setMappingEdit: (key: string, value: string) => void;
  clearMappingEdit: (key: string) => void;
}

const PS360Context = createContext<PS360State | null>(null);

export function PS360Provider({ children }: { children: ReactNode }) {
  const [dataValue, setDataValue] = useState<LoadedDataValue | null>(null);
  const [templateFiles, setTemplateFiles] = useState<LoadedTemplateFile[]>([]);
  const [selectedAutoText, setSelectedAutoText] = useState<
    { file: string; name: string } | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingMappingEdits, setPendingMappingEdits] = useState<
    Record<string, string>
  >({});

  const loadDataValue = useCallback(async () => {
    try {
      const pick = await pickXmlFile({ title: "Open DataValue XML" });
      if (!pick) return;
      const config = parseDataValue(pick.content);
      setDataValue({ path: pick.path, config });
    } catch (err) {
      setError(formatError("Failed to load DataValue file", err));
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const picks = await pickXmlFiles({ title: "Open PS360 template XML" });
      if (picks.length === 0) return;

      const next: LoadedTemplateFile[] = [];
      for (const pick of picks) {
        const doc = parsePortalAutoText(pick.content);
        next.push({ path: pick.path, doc });
      }
      setTemplateFiles((prev) => mergeByPath(prev, next));
    } catch (err) {
      setError(formatError("Failed to load template file", err));
    }
  }, []);

  const selectAutoText = useCallback((filePath: string, autoTextName: string) => {
    setSelectedAutoText({ file: filePath, name: autoTextName });
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const clearDataValue = useCallback(() => {
    setDataValue(null);
    setPendingMappingEdits({});
  }, []);

  const setMappingEdit = useCallback((key: string, value: string) => {
    setPendingMappingEdits((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearMappingEdit = useCallback((key: string) => {
    setPendingMappingEdits((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const removeTemplateFile = useCallback(
    (path: string) => {
      setTemplateFiles((prev) => prev.filter((f) => f.path !== path));
      setSelectedAutoText((current) =>
        current?.file === path ? null : current,
      );
    },
    [],
  );

  const value = useMemo<PS360State>(
    () => ({
      dataValue,
      templateFiles,
      selectedAutoText,
      error,
      pendingMappingEdits,
      loadDataValue,
      loadTemplates,
      selectAutoText,
      clearError,
      clearDataValue,
      removeTemplateFile,
      setMappingEdit,
      clearMappingEdit,
    }),
    [
      dataValue,
      templateFiles,
      selectedAutoText,
      error,
      pendingMappingEdits,
      loadDataValue,
      loadTemplates,
      selectAutoText,
      clearError,
      clearDataValue,
      removeTemplateFile,
      setMappingEdit,
      clearMappingEdit,
    ],
  );

  return <PS360Context.Provider value={value}>{children}</PS360Context.Provider>;
}

export function usePS360(): PS360State {
  const ctx = useContext(PS360Context);
  if (!ctx) throw new Error("usePS360 must be used inside <PS360Provider>");
  return ctx;
}

export function findAutoText(
  state: PS360State,
  filePath: string | undefined,
  autoTextName: string | undefined,
): { file: LoadedTemplateFile; autoText: AutoText } | null {
  if (!filePath || !autoTextName) return null;
  const file = state.templateFiles.find((f) => f.path === filePath);
  if (!file) return null;
  const autoText = file.doc.autoTexts.find((a) => a.name === autoTextName);
  if (!autoText) return null;
  return { file, autoText };
}

function mergeByPath(
  existing: LoadedTemplateFile[],
  incoming: LoadedTemplateFile[],
): LoadedTemplateFile[] {
  const byPath = new Map(existing.map((f) => [f.path, f]));
  for (const f of incoming) byPath.set(f.path, f);
  return Array.from(byPath.values());
}

function formatError(prefix: string, err: unknown): string {
  if (err instanceof Error) return `${prefix}: ${err.message}`;
  if (typeof err === "string") return `${prefix}: ${err}`;
  return prefix;
}
