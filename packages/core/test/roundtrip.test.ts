import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parsePortalAutoText } from "../src/parsers/portal-autotext.js";
import { serializePortalAutoText } from "../src/serializers/portal-autotext.js";
import type {
  AutoText,
  InnerField,
} from "../src/types/portal-autotext.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, "fixtures", "scrubbed-templates.xml");
const FIXTURE = readFileSync(fixturePath, "utf-8");

/**
 * Normalize an AutoText for semantic comparison. Fields we consider equal
 * for round-trip purposes even if their exact XML representation differs.
 */
function normalizeAutoText(at: AutoText): Record<string, unknown> {
  return {
    name: at.name,
    description: at.description,
    contentText: at.contentText,
    guid: at.guid,
    autoTextId: at.autoTextId,
    groupName: at.groupName,
    rtf: at.rtf,
    fields: at.inner.fields.map(normalizeField),
    textSources: at.inner.textSources,
  };
}

function normalizeField(f: InnerField): Record<string, unknown> {
  return {
    type: f.type,
    start: f.start,
    length: f.length,
    mergeid: f.mergeid,
    mergename: f.mergename,
    name: f.name,
    defaultValue: f.defaultValue,
    defaultValueAutoTextId: f.defaultValueAutoTextId,
    defaultValueAutoTextName: f.defaultValueAutoTextName,
    choices: f.choices,
    customProperties: f.customProperties,
  };
}

describe("PortalAutoTextExport round-trip", () => {
  it("parses the scrubbed fixture without error", () => {
    const doc = parsePortalAutoText(FIXTURE);
    expect(doc.autoTexts.length).toBeGreaterThan(0);
  });

  it("extracts the expected AutoText entries from the fixture", () => {
    const doc = parsePortalAutoText(FIXTURE);
    expect(doc.autoTexts.map((a) => a.name)).toEqual([
      "ref header basic",
      "ref results picklist",
      "ultrasound biopsy template",
    ]);
  });

  it("preserves RTF bytes across parse", () => {
    const doc = parsePortalAutoText(FIXTURE);
    for (const at of doc.autoTexts) {
      expect(at.rtf).toMatch(/^\{\\rtf1/);
      expect(at.rtf).not.toContain("{\\xml}");
    }
  });

  it("recovers field structure for a templated-field AutoText", () => {
    const doc = parsePortalAutoText(FIXTURE);
    const biopsy = doc.autoTexts.find((a) => a.name === "ultrasound biopsy template");
    expect(biopsy).toBeDefined();
    const fields = biopsy!.inner.fields;
    expect(fields.length).toBe(4);

    const headerRef = fields[0]!;
    expect(headerRef.type).toBe("5");
    expect(headerRef.defaultValueAutoTextId).toBe("1001");
    expect(headerRef.defaultValueAutoTextName).toBe("ref header basic");

    const biRads = fields.find((f) => f.name === "BI-RADS")!;
    expect(biRads.choices).toBeDefined();
    expect(biRads.choices!.length).toBe(7);
    expect(biRads.choices!.map((c) => c.name)).toEqual(["0", "1", "2", "3", "4", "5", "6"]);
    expect(biRads.defaultValue).toBe("2");
  });

  it("survives parse → serialize → parse (semantic equality)", () => {
    const first = parsePortalAutoText(FIXTURE);
    const reserialized = serializePortalAutoText(first);
    const second = parsePortalAutoText(reserialized);

    expect(second.autoTexts.length).toBe(first.autoTexts.length);
    for (let i = 0; i < first.autoTexts.length; i++) {
      const a = normalizeAutoText(first.autoTexts[i]!);
      const b = normalizeAutoText(second.autoTexts[i]!);
      expect(b).toEqual(a);
    }
  });

  it("is idempotent: serialize → parse → serialize produces identical output", () => {
    const first = parsePortalAutoText(FIXTURE);
    const once = serializePortalAutoText(first);
    const reparsed = parsePortalAutoText(once);
    const twice = serializePortalAutoText(reparsed);
    expect(twice).toBe(once);
  });
});

describe("PortalAutoTextExport property-based round-trip", () => {
  it("handles arbitrary rename of field names without losing structure", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 30 }).filter((s) => /^[A-Za-z0-9 _-]+$/.test(s)),
          { minLength: 1, maxLength: 10 },
        ),
        (newNames) => {
          const doc = parsePortalAutoText(FIXTURE);
          const biopsy = doc.autoTexts.find((a) => a.name === "ultrasound biopsy template");
          if (!biopsy) return;

          for (let i = 0; i < biopsy.inner.fields.length; i++) {
            const name = newNames[i % newNames.length]!;
            biopsy.inner.fields[i]!.name = name;
          }

          const serialized = serializePortalAutoText(doc);
          const reparsed = parsePortalAutoText(serialized);
          const biopsyAgain = reparsed.autoTexts.find(
            (a) => a.name === "ultrasound biopsy template",
          );
          expect(biopsyAgain).toBeDefined();
          expect(biopsyAgain!.inner.fields.length).toBe(biopsy.inner.fields.length);
          for (let i = 0; i < biopsy.inner.fields.length; i++) {
            expect(biopsyAgain!.inner.fields[i]!.name).toBe(biopsy.inner.fields[i]!.name);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("preserves choice names and text under arbitrary reordering", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 6 }),
        fc.integer({ min: 0, max: 6 }),
        (i, j) => {
          const doc = parsePortalAutoText(FIXTURE);
          const biopsy = doc.autoTexts.find((a) => a.name === "ultrasound biopsy template")!;
          const biRads = biopsy.inner.fields.find((f) => f.name === "BI-RADS")!;
          const choices = biRads.choices!;

          const reordered = [...choices];
          const tmp = reordered[i]!;
          reordered[i] = reordered[j]!;
          reordered[j] = tmp;
          biRads.choices = reordered;

          const serialized = serializePortalAutoText(doc);
          const reparsed = parsePortalAutoText(serialized);
          const biRadsAgain = reparsed.autoTexts
            .find((a) => a.name === "ultrasound biopsy template")!
            .inner.fields.find((f) => f.name === "BI-RADS")!;

          expect(biRadsAgain.choices!.map((c) => c.name)).toEqual(
            reordered.map((c) => c.name),
          );
          expect(biRadsAgain.choices!.map((c) => c.text)).toEqual(
            reordered.map((c) => c.text),
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
