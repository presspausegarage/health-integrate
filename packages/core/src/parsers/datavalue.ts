import { XMLParser } from "fast-xml-parser";
import type {
  DataValueConfig,
  FieldMapping,
  MappingDomain,
  ValueMappingItem,
} from "../types/datavalue.js";

/**
 * Parse a DataValue integration-configuration XML file.
 *
 * The file is a serialized .NET `IntegrationConfiguration` object with
 * vendor-specific assembly version strings. We match structurally (names
 * and node shape) rather than by literal version, so any version parses.
 *
 * The parser is tolerant: unknown properties are ignored, unknown list
 * names are surfaced via `unknownLists`, and missing sections default to
 * empty arrays/undefined.
 */
export function parseDataValue(xml: string): DataValueConfig {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
    processEntities: {
      enabled: true,
      maxTotalExpansions: Infinity,
      maxEntitySize: 1_000_000,
      maxExpansionDepth: 100,
      maxExpandedLength: 100_000_000,
    },
    textNodeName: "#text",
  });

  const parsed = parser.parse(xml) as { DomainObject?: unknown };
  const root = parsed.DomainObject;
  if (!root || typeof root !== "object") {
    throw new Error("Root <DomainObject> not found");
  }
  const rootObj = root as Record<string, unknown>;

  const properties = asObject(rootObj.Properties);
  const listsContainer = asObject(rootObj.Lists);
  const listsByName = indexListsByName(listsContainer);

  return {
    integrationType: extractIntegrationType(properties),
    name: extractPropertyText(properties, "Name"),
    internalName: extractPropertyText(properties, "InternalName"),
    mappings: extractValueMappings(listsByName),
    fieldMappings: extractFieldMappings(listsByName),
  };
}

/**
 * Build a map from list name → list node. The XML uses
 *   <Lists><List Name="A">...</List><List Name="B">...</List></Lists>
 * so all children are named `List` and are distinguished by the @_Name attr.
 */
function indexListsByName(
  container: Record<string, unknown>,
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  const entries = toArray(container.List);
  for (const entry of entries) {
    const node = asObject(entry);
    const name = asAttr(node, "@_Name");
    if (name !== undefined) {
      out[name] = node;
    }
  }
  return out;
}

function extractIntegrationType(
  properties: Record<string, unknown>,
): string | undefined {
  const typeNode = asObject(properties.Type);
  const inner = asString(typeNode.IntegrationType);
  return inner;
}

function extractPropertyText(
  properties: Record<string, unknown>,
  name: string,
): string | undefined {
  const node = properties[name];
  return asString(node);
}

function extractValueMappings(
  lists: Record<string, unknown>,
): Partial<Record<MappingDomain, ValueMappingItem[]>> {
  const out: Partial<Record<MappingDomain, ValueMappingItem[]>> = {};
  for (const { listName, domain } of VALUE_MAPPING_LISTS) {
    const items = parseValueMappingList(lists[listName]);
    if (items.length > 0 || lists[listName] !== undefined) {
      out[domain] = items;
    }
  }
  return out;
}

function extractFieldMappings(
  lists: Record<string, unknown>,
): Partial<Record<MappingDomain, FieldMapping[]>> {
  const out: Partial<Record<MappingDomain, FieldMapping[]>> = {};
  for (const { listName, domain } of FIELD_MAPPING_LISTS) {
    const items = parseFieldMappingList(lists[listName]);
    if (items.length > 0 || lists[listName] !== undefined) {
      out[domain] = items;
    }
  }
  return out;
}

interface ListMeta {
  listName: string;
  domain: MappingDomain;
}

const VALUE_MAPPING_LISTS: readonly ListMeta[] = [
  { listName: "RecommendationMappingList", domain: "Recommendation" },
  { listName: "AssessmentMappingList", domain: "Assessment" },
  { listName: "LateralityMappingList", domain: "Laterality" },
  { listName: "TissueDensityMappingList", domain: "TissueDensity" },
  { listName: "PathologyStatusList", domain: "PathologyStatus" },
  { listName: "PathologyComplicationsList", domain: "PathologyComplications" },
  { listName: "ReportHeadersMappingList", domain: "ReportHeaders" },
  { listName: "SiteMappingList", domain: "Site" },
];

const FIELD_MAPPING_LISTS: readonly ListMeta[] = [
  { listName: "PatientMappings", domain: "Patient" },
  { listName: "ProcedureMappings", domain: "Procedure" },
  { listName: "SecondaryProcedureMappings", domain: "SecondaryProcedure" },
];

function parseValueMappingList(raw: unknown): ValueMappingItem[] {
  const list = asObject(raw);
  const entries = toArray(list.DomainObject);
  return entries.map(parseValueMappingItem).filter(isNotNull);
}

function parseValueMappingItem(raw: unknown): ValueMappingItem | null {
  const node = asObject(raw);
  const props = asObject(node.Properties);
  const internalGuid = asString(props.InternalGUID);
  const displayValue = asString(props.DisplayValue);
  if (internalGuid === undefined || displayValue === undefined) return null;
  return {
    internalGuid,
    displayValue,
    defaultValue: asString(props.DefaultValue) ?? displayValue,
    code: asString(props.Code) ?? "",
    externalValue: asString(props.ExternalValue) ?? displayValue,
  };
}

function parseFieldMappingList(raw: unknown): FieldMapping[] {
  const list = asObject(raw);
  const entries = toArray(list.DomainObject);
  return entries.map(parseFieldMappingItem).filter(isNotNull);
}

function parseFieldMappingItem(raw: unknown): FieldMapping | null {
  const node = asObject(raw);
  const props = asObject(node.Properties);
  const external = findNamedDomainObject(props, "IntegrationMapping.External");
  const internal = findNamedDomainObject(props, "IntegrationMapping.Internal");
  if (external === undefined || internal === undefined) return null;

  const externalProps = asObject(external.Properties);
  const internalProps = asObject(internal.Properties);
  return {
    externalType: asString(asObject(externalProps.Type).FieldIdentifier) ?? "",
    externalName: asString(externalProps.Name) ?? "",
    internalType: asString(asObject(internalProps.Type).FieldIdentifier) ?? "",
    internalName: asString(internalProps.Name) ?? "",
  };
}

/**
 * The .NET serialization emits multiple `<DomainObject>` children under one
 * parent, each tagged with a Name attribute. When fast-xml-parser coalesces
 * them it either keeps them separate (array form) or overwrites by key. This
 * helper finds the one whose `@_Name` matches.
 */
function findNamedDomainObject(
  parent: Record<string, unknown>,
  wantedName: string,
): Record<string, unknown> | undefined {
  const candidates = toArray(parent.DomainObject);
  for (const c of candidates) {
    const obj = asObject(c);
    const name = asAttr(obj, "@_Name");
    if (name === wantedName) return obj;
  }
  return undefined;
}

// ---- helpers ----

function toArray(v: unknown): unknown[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function asObject(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

function asString(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object" && v !== null && "#text" in v) {
    const t = (v as Record<string, unknown>)["#text"];
    return typeof t === "string" ? t : undefined;
  }
  return undefined;
}

function asAttr(node: Record<string, unknown>, key: string): string | undefined {
  const v = node[key];
  return typeof v === "string" ? v : undefined;
}

function isNotNull<T>(v: T | null): v is T {
  return v !== null;
}
