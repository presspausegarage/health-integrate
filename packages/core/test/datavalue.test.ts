import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseDataValue } from "../src/parsers/datavalue.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, "fixtures", "scrubbed-datavalue.xml");
const FIXTURE = readFileSync(fixturePath, "utf-8");

describe("parseDataValue", () => {
  it("extracts integration metadata", () => {
    const config = parseDataValue(FIXTURE);
    expect(config.integrationType).toBe("VoiceRecognitionDictation");
    expect(config.name).toBe("Test Config");
    expect(config.internalName).toBe("Test-0");
  });

  it("extracts recommendation value mappings", () => {
    const config = parseDataValue(FIXTURE);
    const recs = config.mappings.Recommendation ?? [];
    expect(recs.length).toBe(3);
    expect(recs.map((r) => r.displayValue)).toEqual([
      "Additional Views",
      "Aspiration",
      "Follow-up in 6 months",
    ]);
    expect(recs[0]!.internalGuid).toBe("10000000-0000-0000-0000-000000000001");
  });

  it("extracts assessment value mappings with codes", () => {
    const config = parseDataValue(FIXTURE);
    const assessments = config.mappings.Assessment ?? [];
    expect(assessments.length).toBe(3);
    expect(assessments.map((a) => a.code)).toEqual(["0", "1", "2"]);
    expect(assessments.map((a) => a.displayValue)).toEqual([
      "BI-RADS 0",
      "BI-RADS 1",
      "BI-RADS 2",
    ]);
  });

  it("extracts laterality value mappings", () => {
    const config = parseDataValue(FIXTURE);
    const laterality = config.mappings.Laterality ?? [];
    expect(laterality.length).toBe(3);
    expect(laterality.map((l) => l.displayValue)).toEqual([
      "Left",
      "Right",
      "Bilateral",
    ]);
  });

  it("extracts patient field mappings", () => {
    const config = parseDataValue(FIXTURE);
    const patient = config.fieldMappings.Patient ?? [];
    expect(patient.length).toBe(1);
    expect(patient[0]!.externalType).toBe("PatientID");
    expect(patient[0]!.externalName).toBe("Patient MRN");
    expect(patient[0]!.internalType).toBe("External");
    expect(patient[0]!.internalName).toBe("Not used for mapping");
  });

  it("extracts procedure field mappings", () => {
    const config = parseDataValue(FIXTURE);
    const procedure = config.fieldMappings.Procedure ?? [];
    expect(procedure.length).toBe(1);
    expect(procedure[0]!.externalType).toBe("Accession");
    expect(procedure[0]!.internalName).toBe("Accession");
  });

  it("tolerates empty lists", () => {
    const config = parseDataValue(FIXTURE);
    expect(config.mappings.TissueDensity).toEqual([]);
    expect(config.mappings.Site).toEqual([]);
    expect(config.fieldMappings.SecondaryProcedure).toEqual([]);
  });

  it("is tolerant of version string variation", () => {
    const variant = FIXTURE.replaceAll(
      "Placeholder.Assembly, Version=X.Y.Z.W",
      "Another.Assembly, Version=99.88.77.66",
    );
    const config = parseDataValue(variant);
    expect(config.integrationType).toBe("VoiceRecognitionDictation");
    expect((config.mappings.Assessment ?? []).length).toBe(3);
  });
});
