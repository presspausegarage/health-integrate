import type { DataValueConfig } from "./types/datavalue.js";

/**
 * A lint diagnostic describing a problem in the rendered template text.
 * Character offsets are zero-based and refer to positions in the plain-text
 * representation shown in the editor (not the inner-XML representation).
 */
export interface LintDiagnostic {
  severity: "error" | "warning" | "info";
  /** Inclusive start offset in the text. */
  start: number;
  /** Exclusive end offset in the text. */
  end: number;
  /** Short human-readable message. */
  message: string;
  /** The exact string this region should be replaced with, if applicable. */
  suggestion?: string;
  /** Machine-readable rule id for filtering / documentation. */
  code: string;
}

export interface LintOptions {
  /**
   * Disable individual rules by code. Default: all rules enabled when a
   * DataValue config is present.
   */
  disable?: ReadonlySet<string>;
}

/**
 * Lint a rendered PS-style dictation template against a DataValue
 * integration configuration. Returns diagnostics describing mismatches
 * between what the template contains and what the dictation system
 * expects.
 *
 * Implemented rules:
 *   - "header/case": a section header (e.g. "Findings:") appears in the
 *     template that differs only in case or spacing from a ReportHeaders
 *     mapping's external value. Dictation integrations compare these
 *     headers case-sensitively and space-sensitively, so even "Findings:"
 *     vs. "FINDINGS:" will break mapping. Flagged as warning with a
 *     suggestion of the exact expected form.
 */
export function lintTemplate(
  text: string,
  dataValue: DataValueConfig,
  options: LintOptions = {},
): LintDiagnostic[] {
  const disabled = options.disable ?? new Set<string>();
  const out: LintDiagnostic[] = [];

  if (!disabled.has("header/case")) {
    out.push(...lintHeaderCase(text, dataValue));
  }

  // Sort by start offset so UI ordering is deterministic.
  out.sort((a, b) => a.start - b.start);
  return out;
}

/**
 * Flag section headers in `text` whose lowercased form matches a
 * ReportHeaders external value but whose exact bytes differ. Only headers
 * at the start of a line are considered (to avoid false positives on
 * inline text like "including Findings:" inside narrative prose).
 */
function lintHeaderCase(
  text: string,
  dataValue: DataValueConfig,
): LintDiagnostic[] {
  const reportHeaders = dataValue.mappings.ReportHeaders ?? [];
  if (reportHeaders.length === 0) return [];

  // Build a case-insensitive lookup: lowercased external value -> exact form.
  const exactByLower = new Map<string, string>();
  for (const h of reportHeaders) {
    if (h.externalValue && h.externalValue.length > 0) {
      exactByLower.set(h.externalValue.toLowerCase(), h.externalValue);
    }
  }
  if (exactByLower.size === 0) return [];

  const diagnostics: LintDiagnostic[] = [];

  // Match a header at start-of-line: optional indent, then a run of letters/
  // digits/spaces/hyphens/parens, then a colon.
  // Capture groups:
  //   1: leading whitespace before the header (after the newline)
  //   2: the header text itself, including the trailing colon
  const re = /(^|\n)([ \t]*)([A-Za-z][A-Za-z0-9 \-()/]*?:)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const newlineOrStart = m[1] ?? "";
    const indent = m[2] ?? "";
    const header = m[3] ?? "";
    if (header.length === 0) continue;

    const start = m.index + newlineOrStart.length + indent.length;
    const end = start + header.length;

    const exact = exactByLower.get(header.toLowerCase());
    if (exact !== undefined && exact !== header) {
      diagnostics.push({
        severity: "warning",
        code: "header/case",
        start,
        end,
        message:
          `Section header does not exactly match the App Configuration. ` +
          `Dictation integration expects "${exact}" (case- and space-sensitive); ` +
          `template contains "${header}".`,
        suggestion: exact,
      });
    }
  }

  return diagnostics;
}
