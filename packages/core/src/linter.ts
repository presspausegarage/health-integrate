import type {
  DataValueConfig,
  MappingDomain,
  ValueMappingItem,
} from "./types/datavalue.js";
import type { InnerField } from "./types/portal-autotext.js";

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
  /**
   * Template's inner-XML fields (the parsed AST) for context. Lets
   * picklist-aware rules inspect per-field choices and lets header/case
   * skip picklist titles (which look like headers but aren't).
   */
  fields?: readonly InnerField[];
}

/**
 * Lint a rendered dictation template against a DataValue integration
 * configuration. Returns diagnostics describing mismatches between what
 * the template contains and what the dictation system expects.
 *
 * Implemented rules:
 *   - "header/case": a section header (e.g. "Findings:") appears in the
 *     template that differs only in case or spacing from a ReportHeaders
 *     mapping's external value. Dictation integrations compare these
 *     headers case-sensitively, so even "Findings:" vs. "FINDINGS:" will
 *     break mapping. Picklist-field titles (e.g. "Recommendation:" for a
 *     type-3 picklist field) are skipped because they're field titles,
 *     not section headers.
 *   - "choice/case": a picklist choice name in the template differs only
 *     in case from an entry in the App Configuration's domain list
 *     (e.g. "screening mammogram" vs. "Screening mammogram").
 *   - "choice/unknown": a picklist choice name has no corresponding
 *     entry in the App Configuration's domain list. The doctor's spoken
 *     form would not be recognized by the integration.
 */
export function lintTemplate(
  text: string,
  dataValue: DataValueConfig,
  options: LintOptions = {},
): LintDiagnostic[] {
  const disabled = options.disable ?? new Set<string>();
  const fields = options.fields ?? [];
  const picklistFieldNames = new Set<string>(
    fields.filter((f) => f.type === "3" && f.name).map((f) => f.name),
  );

  const out: LintDiagnostic[] = [];

  if (!disabled.has("header/case")) {
    out.push(...lintHeaderCase(text, dataValue, picklistFieldNames));
  }

  if (!disabled.has("choice/case") || !disabled.has("choice/unknown")) {
    out.push(
      ...lintChoices(text, dataValue, fields, {
        caseDisabled: disabled.has("choice/case"),
        unknownDisabled: disabled.has("choice/unknown"),
      }),
    );
  }

  out.sort((a, b) => a.start - b.start);
  return out;
}

/**
 * Flag section headers in `text` whose lowercased form matches a
 * ReportHeaders external value but whose exact bytes differ. Only headers
 * at the start of a line are considered. Picklist-field titles are
 * skipped since they share the `FieldName:` shape but aren't headers.
 */
function lintHeaderCase(
  text: string,
  dataValue: DataValueConfig,
  picklistFieldNames: ReadonlySet<string>,
): LintDiagnostic[] {
  const reportHeaders = dataValue.mappings.ReportHeaders ?? [];
  if (reportHeaders.length === 0) return [];

  const exactByLower = new Map<string, string>();
  for (const h of reportHeaders) {
    if (h.externalValue && h.externalValue.length > 0) {
      exactByLower.set(h.externalValue.toLowerCase(), h.externalValue);
    }
  }
  if (exactByLower.size === 0) return [];

  const diagnostics: LintDiagnostic[] = [];
  const re = /(^|\n)([ \t]*)([A-Za-z][A-Za-z0-9 \-()/]*?:)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const newlineOrStart = m[1] ?? "";
    const indent = m[2] ?? "";
    const header = m[3] ?? "";
    if (header.length === 0) continue;

    const nameWithoutColon = header.endsWith(":")
      ? header.slice(0, -1)
      : header;
    if (picklistFieldNames.has(nameWithoutColon)) continue;

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

/**
 * Heuristics mapping a picklist field's name to the DataValue domain
 * whose mapping list holds the canonical choice names.
 *
 * Patterns are tested against the field name case-insensitively; first
 * match wins. Fields whose name doesn't match any pattern are skipped
 * (we don't flag choices we can't validate).
 */
const DOMAIN_INFERENCE: ReadonlyArray<{
  pattern: RegExp;
  domain: MappingDomain;
}> = [
  { pattern: /^recommendations?$/i, domain: "Recommendation" },
  { pattern: /^(?:bi[- ]?rads|assessment)s?$/i, domain: "Assessment" },
  { pattern: /^laterality$/i, domain: "Laterality" },
  { pattern: /(?:tissue )?density/i, domain: "TissueDensity" },
  { pattern: /^pathology status$/i, domain: "PathologyStatus" },
  { pattern: /^pathology complications?$/i, domain: "PathologyComplications" },
  { pattern: /^pathology$/i, domain: "Pathology" },
  { pattern: /^sites?$/i, domain: "Site" },
];

export function inferDomainForField(fieldName: string): MappingDomain | null {
  const trimmed = fieldName.trim();
  for (const { pattern, domain } of DOMAIN_INFERENCE) {
    if (pattern.test(trimmed)) return domain;
  }
  return null;
}

interface ChoiceLintFlags {
  caseDisabled: boolean;
  unknownDisabled: boolean;
}

function lintChoices(
  text: string,
  dataValue: DataValueConfig,
  fields: readonly InnerField[],
  flags: ChoiceLintFlags,
): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];

  for (const field of fields) {
    if (field.type !== "3") continue;
    if (!field.name) continue;

    const domain = inferDomainForField(field.name);
    if (!domain) continue;

    const mappings: ValueMappingItem[] = dataValue.mappings[domain] ?? [];
    if (mappings.length === 0) continue;

    const exact = new Set<string>();
    const byLower = new Map<string, string>();
    for (const m of mappings) {
      if (m.externalValue && m.externalValue.length > 0) {
        exact.add(m.externalValue);
        byLower.set(m.externalValue.toLowerCase(), m.externalValue);
      }
    }
    if (exact.size === 0) continue;

    // Locate the picklist in the current text by its `FieldName:` prefix.
    const prefix = `${field.name}:`;
    const idx = text.indexOf(prefix);
    if (idx === -1) continue;
    const choicesStart = idx + prefix.length;
    const newline = text.indexOf("\n", choicesStart);
    const choicesEnd = newline === -1 ? text.length : newline;
    const segment = text.slice(choicesStart, choicesEnd);

    let cursor = choicesStart;
    const parts = segment.split("/");
    for (let i = 0; i < parts.length; i++) {
      const choice = parts[i] ?? "";
      const choiceStart = cursor;
      const choiceEnd = choiceStart + choice.length;
      cursor = choiceEnd + 1; // +1 for the '/' separator

      if (choice.length === 0) continue;
      if (exact.has(choice)) continue;

      const caseExact = byLower.get(choice.toLowerCase());
      if (caseExact !== undefined) {
        if (flags.caseDisabled) continue;
        diagnostics.push({
          severity: "warning",
          code: "choice/case",
          start: choiceStart,
          end: choiceEnd,
          message:
            `Picklist choice "${choice}" in "${field.name}" does not match ` +
            `the App Configuration's ${domain} list case-sensitively. ` +
            `Expected "${caseExact}".`,
          suggestion: caseExact,
        });
      } else {
        if (flags.unknownDisabled) continue;
        diagnostics.push({
          severity: "warning",
          code: "choice/unknown",
          start: choiceStart,
          end: choiceEnd,
          message:
            `Picklist choice "${choice}" in "${field.name}" is not in the ` +
            `App Configuration's ${domain} list. The dictation integration ` +
            `will not recognize this spoken form.`,
        });
      }
    }
  }

  return diagnostics;
}
