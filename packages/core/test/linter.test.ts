import { describe, it, expect } from "vitest";
import { lintTemplate } from "../src/linter.js";
import type { DataValueConfig } from "../src/types/datavalue.js";

function configWith(reportHeaders: string[]): DataValueConfig {
  return {
    mappings: {
      ReportHeaders: reportHeaders.map((v, i) => ({
        internalGuid: `00000000-0000-0000-0000-${i.toString().padStart(12, "0")}`,
        displayValue: v.replace(/:$/, ""),
        defaultValue: v,
        code: "",
        externalValue: v,
      })),
    },
    fieldMappings: {},
  };
}

describe("lintTemplate header/case rule", () => {
  it("flags a header that differs only in case", () => {
    const text = "Findings:\nSome narrative here.\n";
    const config = configWith(["FINDINGS:"]);
    const diags = lintTemplate(text, config);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("header/case");
    expect(diags[0]!.suggestion).toBe("FINDINGS:");
    expect(text.slice(diags[0]!.start, diags[0]!.end)).toBe("Findings:");
  });

  it("does not flag an exact match", () => {
    const text = "FINDINGS:\nSome narrative here.\n";
    const config = configWith(["FINDINGS:"]);
    expect(lintTemplate(text, config)).toEqual([]);
  });

  it("ignores a header that has no case-insensitive counterpart", () => {
    const text = "SomeUnknownHeader: stuff\n";
    const config = configWith(["FINDINGS:", "ASSESSMENT:"]);
    expect(lintTemplate(text, config)).toEqual([]);
  });

  it("flags multiple mismatches in a multi-line template", () => {
    const text = [
      "Findings: adequate.",
      "ASSESSMENT: BI-RADS 2.",
      "recommendation: repeat in 12 months.",
    ].join("\n");
    const config = configWith(["FINDINGS:", "ASSESSMENT:", "RECOMMENDATION:"]);
    const diags = lintTemplate(text, config);
    expect(diags).toHaveLength(2);
    expect(diags.map((d) => d.suggestion)).toEqual([
      "FINDINGS:",
      "RECOMMENDATION:",
    ]);
  });

  it("does not flag a header that appears mid-line (not start-of-line)", () => {
    // "Findings:" embedded in prose should not trip the lint.
    const text = "The physician noted the following Findings: none of concern.";
    const config = configWith(["FINDINGS:"]);
    expect(lintTemplate(text, config)).toEqual([]);
  });

  it("allows a header after leading indentation", () => {
    const text = "    Findings: stuff\n";
    const config = configWith(["FINDINGS:"]);
    const diags = lintTemplate(text, config);
    expect(diags).toHaveLength(1);
    expect(text.slice(diags[0]!.start, diags[0]!.end)).toBe("Findings:");
  });

  it("returns [] when DataValue has no ReportHeaders", () => {
    const text = "Findings: stuff\n";
    const config: DataValueConfig = { mappings: {}, fieldMappings: {} };
    expect(lintTemplate(text, config)).toEqual([]);
  });

  it("respects the disable set", () => {
    const text = "Findings: stuff\n";
    const config = configWith(["FINDINGS:"]);
    expect(
      lintTemplate(text, config, { disable: new Set(["header/case"]) }),
    ).toEqual([]);
  });

  it("handles headers containing parentheses", () => {
    const text = "examination(s): stuff\n";
    const config = configWith(["EXAMINATION(S):"]);
    const diags = lintTemplate(text, config);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.suggestion).toBe("EXAMINATION(S):");
  });
});
