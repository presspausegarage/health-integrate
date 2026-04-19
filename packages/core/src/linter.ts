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

  if (!disabled.has("statement/recommendation")) {
    out.push(...lintRecommendationStatements(text, dataValue));
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

/**
 * Laterality tokens that may appear at the end of a recommendation choice.
 * Matched case-insensitively; not validated against the Laterality mapping
 * list because per the workflow they're applied after the recommendation
 * match.
 */
const LATERALITY_PATTERN = /^(.*?)(\s+)(left|right|bilateral)$/i;

/**
 * Timeframe tokens that may appear at the end of a recommendation choice,
 * tried longest-first. Both the full spoken form ("in 6 months") and the
 * abbreviated template-choice form ("6 month") are accepted.
 */
const TIMEFRAME_PATTERNS: readonly RegExp[] = [
  /^(.*?)(\s+)(in \d+-\d+ years?)$/i,
  /^(.*?)(\s+)(in \d+ months?)$/i,
  /^(.*?)(\s+)(\d+-\d+ years?)$/i,
  /^(.*?)(\s+)(\d+ months?)$/i,
  /^(.*?)(\s+)(at age \d+)$/i,
  /^(.*?)(\s+)(age \d+)$/i,
];

interface Peel {
  core: string;
  suffix: string;
}

function peelTrailingLaterality(s: string): Peel | null {
  const m = s.match(LATERALITY_PATTERN);
  if (!m) return null;
  return { core: m[1] ?? "", suffix: (m[2] ?? "") + (m[3] ?? "") };
}

function peelTrailingTimeframe(s: string): Peel | null {
  for (const p of TIMEFRAME_PATTERNS) {
    const m = s.match(p);
    if (m) {
      return { core: m[1] ?? "", suffix: (m[2] ?? "") + (m[3] ?? "") };
    }
  }
  return null;
}

/**
 * Recursively strip trailing laterality and timeframe tokens from a
 * recommendation choice. Order doesn't matter because we retry after every
 * successful peel, so both "Rec Right in 6 months" and "Rec in 6 months Right"
 * reduce to the same core.
 */
export function peelRecommendationSuffixes(choice: string): Peel {
  let core = choice;
  let suffix = "";
  let changed = true;
  while (changed) {
    changed = false;
    const lat = peelTrailingLaterality(core);
    if (lat) {
      suffix = lat.suffix + suffix;
      core = lat.core;
      changed = true;
      continue;
    }
    const time = peelTrailingTimeframe(core);
    if (time) {
      suffix = time.suffix + suffix;
      core = time.core;
      changed = true;
      continue;
    }
  }
  return { core, suffix };
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

      const evaluation = evaluateChoice(choice, domain, exact, byLower);
      if (evaluation.status === "ok") continue;

      if (evaluation.status === "case") {
        if (flags.caseDisabled) continue;
        diagnostics.push({
          severity: "warning",
          code: "choice/case",
          start: choiceStart,
          end: choiceEnd,
          message:
            `Picklist choice "${choice}" in "${field.name}" does not match ` +
            `the App Configuration's ${domain} list case-sensitively. ` +
            `Expected "${evaluation.suggestion}".`,
          suggestion: evaluation.suggestion,
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

/**
 * Smoke-test a fixed-text recommendation statement that appears in the
 * static template body (not a picklist field). Example:
 *
 *   RECOMMENDATION: Diagnostic Mammogram and Ultrasound Right in 6 months.
 *
 * The trailing period is optional; internal spacing is not. The content
 * after the header is parsed as `<recommendation> [laterality] [timeframe]`
 * and validated against the Recommendation mapping list.
 */
function lintRecommendationStatements(
  text: string,
  dataValue: DataValueConfig,
): LintDiagnostic[] {
  const recommendations = dataValue.mappings.Recommendation ?? [];
  if (recommendations.length === 0) return [];

  const exact = new Set<string>();
  const byLower = new Map<string, string>();
  for (const r of recommendations) {
    if (r.externalValue && r.externalValue.length > 0) {
      exact.add(r.externalValue);
      byLower.set(r.externalValue.toLowerCase(), r.externalValue);
    }
  }
  if (exact.size === 0) return [];

  const diagnostics: LintDiagnostic[] = [];

  // Match lines that start with "RECOMMENDATION:" followed by whitespace and
  // non-empty content. We only fire on the exact-case header here; the
  // header/case rule flags the header-level case issue independently.
  const re = /^(RECOMMENDATION:)([ \t]+)([^\n]+?)(\.?)[ \t]*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const header = m[1] ?? "";
    const gap = m[2] ?? "";
    const content = m[3] ?? "";
    if (content.length === 0) continue;

    const contentStart = m.index + header.length + gap.length;
    const peeled = peelRecommendationSuffixes(content);
    if (peeled.core.length === 0) continue;

    // Location of just the recommendation-core slice within the content.
    const coreStart = contentStart;
    const coreEnd = coreStart + peeled.core.length;

    if (exact.has(peeled.core)) continue;

    const coreExact = byLower.get(peeled.core.toLowerCase());
    if (coreExact !== undefined) {
      diagnostics.push({
        severity: "warning",
        code: "statement/recommendation-case",
        start: coreStart,
        end: coreEnd,
        message:
          `Recommendation "${peeled.core}" does not match the App Configuration ` +
          `case-sensitively. Expected "${coreExact}".`,
        suggestion: coreExact,
      });
    } else {
      diagnostics.push({
        severity: "warning",
        code: "statement/recommendation-unknown",
        start: coreStart,
        end: coreEnd,
        message:
          `Recommendation "${peeled.core}" is not in the App Configuration's ` +
          `Recommendation list. The dictation integration will not recognize ` +
          `this spoken form.`,
      });
    }
  }

  return diagnostics;
}

type ChoiceEvaluation =
  | { status: "ok" }
  | { status: "case"; suggestion: string }
  | { status: "unknown" };

/**
 * Decide whether a single picklist choice name is valid against its
 * domain's mapping list. For the Recommendation domain, choices may carry
 * trailing laterality and/or timeframe suffixes that are not part of the
 * mapping entry — we peel those off before matching.
 */
function evaluateChoice(
  choice: string,
  domain: MappingDomain,
  exact: ReadonlySet<string>,
  byLower: ReadonlyMap<string, string>,
): ChoiceEvaluation {
  // Direct exact match on the full choice.
  if (exact.has(choice)) return { status: "ok" };

  if (domain === "Recommendation") {
    const peeled = peelRecommendationSuffixes(choice);
    // Core matches exactly.
    if (peeled.core.length > 0 && exact.has(peeled.core)) {
      return { status: "ok" };
    }
    // Core matches case-insensitively — suggest fixed core + original suffix.
    if (peeled.core.length > 0) {
      const coreExact = byLower.get(peeled.core.toLowerCase());
      if (coreExact !== undefined) {
        return { status: "case", suggestion: coreExact + peeled.suffix };
      }
    }
  }

  // Case-insensitive match on the full choice (covers non-Recommendation
  // domains or Recommendation choices with no suffixes).
  const full = byLower.get(choice.toLowerCase());
  if (full !== undefined) {
    return { status: "case", suggestion: full };
  }

  return { status: "unknown" };
}
