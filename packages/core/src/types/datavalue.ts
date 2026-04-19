/**
 * Types for the integration-configuration XML file that users supply at
 * runtime. Parser matches vendor assembly strings structurally (regex) rather
 * than by literal version, so any version of the source file is accepted.
 *
 * The actual file is vendor- and customer-specific and is never distributed
 * with this tool. Only the structural schema is modeled here.
 */

export type MappingDomain =
  | "Recommendation"
  | "Assessment"
  | "Laterality"
  | "TissueDensity"
  | "Pathology"
  | "Site"
  | "ReportHeaders"
  | "PathologyStatus"
  | "PathologyComplications"
  | "Patient"
  | "Procedure"
  | "SecondaryProcedure";

export interface DataValueConfig {
  integrationType?: string;
  name?: string;
  internalName?: string;
  mappings: Partial<Record<MappingDomain, ValueMappingItem[]>>;
  fieldMappings: Partial<Record<MappingDomain, FieldMapping[]>>;
}

export interface ValueMappingItem {
  internalGuid: string;
  displayValue: string;
  defaultValue: string;
  code: string;
  externalValue: string;
}

export interface FieldMapping {
  externalType: string;
  externalName: string;
  internalType: string;
  internalName: string;
}
