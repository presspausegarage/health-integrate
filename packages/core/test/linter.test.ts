import { describe, it, expect } from "vitest";
import { lintTemplate } from "../src/linter.js";
import type { DataValueConfig } from "../src/types/datavalue.js";
import type { InnerField } from "../src/types/portal-autotext.js";

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

function picklistField(name: string, choices: string[] = []): InnerField {
  return {
    type: "3",
    start: 0,
    length: 0,
    name,
    choices: choices.map((n) => ({ name: n, text: "" })),
  };
}

function configWithRecommendations(values: string[]): DataValueConfig {
  return {
    mappings: {
      Recommendation: values.map((v, i) => ({
        internalGuid: `10000000-0000-0000-0000-${i.toString().padStart(12, "0")}`,
        displayValue: v,
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

  it("skips a picklist field title that looks like a header", () => {
    // Recommendation: is a picklist title, not a section header. Even if the
    // user's ReportHeaders happens to have "RECOMMENDATION:" in it, we should
    // not flag the picklist title because the inner-XML tells us it's a
    // picklist field.
    const text = "Recommendation:Additional Views/Aspiration\n";
    const config: DataValueConfig = {
      mappings: {
        ReportHeaders: [
          {
            internalGuid: "00000000-0000-0000-0000-000000000001",
            displayValue: "Recommendation",
            defaultValue: "RECOMMENDATION:",
            code: "",
            externalValue: "RECOMMENDATION:",
          },
        ],
        Recommendation: [
          {
            internalGuid: "10000000-0000-0000-0000-000000000001",
            displayValue: "Additional Views",
            defaultValue: "Additional Views",
            code: "",
            externalValue: "Additional Views",
          },
          {
            internalGuid: "10000000-0000-0000-0000-000000000002",
            displayValue: "Aspiration",
            defaultValue: "Aspiration",
            code: "",
            externalValue: "Aspiration",
          },
        ],
      },
      fieldMappings: {},
    };
    const diags = lintTemplate(text, config, {
      fields: [picklistField("Recommendation")],
    });
    // Neither the title nor the choices should trip a warning.
    expect(diags).toEqual([]);
  });
});

describe("lintTemplate choice rules", () => {
  it("flags a picklist choice with case mismatch", () => {
    const text = "Recommendation:additional views\n";
    const config = configWithRecommendations(["Additional Views"]);
    const diags = lintTemplate(text, config, {
      fields: [picklistField("Recommendation")],
    });
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("choice/case");
    expect(diags[0]!.suggestion).toBe("Additional Views");
    expect(text.slice(diags[0]!.start, diags[0]!.end)).toBe("additional views");
  });

  it("flags a picklist choice that is not in the config list", () => {
    const text = "Recommendation:Additional Views/Something Weird\n";
    const config = configWithRecommendations(["Additional Views"]);
    const diags = lintTemplate(text, config, {
      fields: [picklistField("Recommendation")],
    });
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("choice/unknown");
    expect(text.slice(diags[0]!.start, diags[0]!.end)).toBe("Something Weird");
    expect(diags[0]!.suggestion).toBeUndefined();
  });

  it("does not flag a choice that matches exactly", () => {
    const text = "Recommendation:Additional Views/Aspiration\n";
    const config = configWithRecommendations(["Additional Views", "Aspiration"]);
    const diags = lintTemplate(text, config, {
      fields: [picklistField("Recommendation")],
    });
    expect(diags).toEqual([]);
  });

  it("flags multiple choices in the same picklist independently", () => {
    const text =
      "Recommendation:Additional views/Aspiration/Unknown Thing/Screening Mammogram\n";
    const config = configWithRecommendations([
      "Additional Views",
      "Aspiration",
      "Screening mammogram",
    ]);
    const diags = lintTemplate(text, config, {
      fields: [picklistField("Recommendation")],
    });
    expect(diags.map((d) => d.code)).toEqual([
      "choice/case",
      "choice/unknown",
      "choice/case",
    ]);
    expect(diags.map((d) => text.slice(d.start, d.end))).toEqual([
      "Additional views",
      "Unknown Thing",
      "Screening Mammogram",
    ]);
  });

  it("skips picklist fields whose name doesn't match any known domain", () => {
    const text = "Custom Field:Foo/Bar/Baz\n";
    const config = configWithRecommendations(["Additional Views"]);
    const diags = lintTemplate(text, config, {
      fields: [picklistField("Custom Field")],
    });
    expect(diags).toEqual([]);
  });

  it("does not scan a field if its prefix isn't found in the text", () => {
    const text = "Some unrelated text with no picklist.\n";
    const config = configWithRecommendations(["Additional Views"]);
    const diags = lintTemplate(text, config, {
      fields: [picklistField("Recommendation")],
    });
    expect(diags).toEqual([]);
  });

  it("respects the disable set for choice rules", () => {
    const text = "Recommendation:additional views/Unknown Thing\n";
    const config = configWithRecommendations(["Additional Views"]);
    const diagsWithBothOn = lintTemplate(text, config, {
      fields: [picklistField("Recommendation")],
    });
    expect(diagsWithBothOn).toHaveLength(2);

    const diagsOnlyUnknown = lintTemplate(text, config, {
      fields: [picklistField("Recommendation")],
      disable: new Set(["choice/case"]),
    });
    expect(diagsOnlyUnknown.map((d) => d.code)).toEqual(["choice/unknown"]);
  });
});
