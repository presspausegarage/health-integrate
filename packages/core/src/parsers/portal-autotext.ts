import { XMLParser } from "fast-xml-parser";
import type {
  AutoText,
  InnerAutoTextXml,
  InnerChoice,
  InnerCustomProperty,
  InnerField,
  InnerLink,
  InnerSnippetGroup,
  InnerTextSource,
  PortalAutoTextExport,
} from "../types/portal-autotext.js";

const INNER_XML_MARKER = "{\\xml}";

/**
 * Parse a PortalAutoTextExport XML string into an AST.
 *
 * The outer XML is conventional. Each `<AutoText><ContentRTF>` contains:
 *   1. RTF body (groups delimited by `{` / `}`)
 *   2. A literal `{\xml}` marker
 *   3. HTML-entity-encoded inner XML (`&lt;autotext&gt;...&lt;/autotext&gt;`)
 *
 * We split at the marker, keep the RTF portion raw, and decode-and-parse the
 * inner XML into a typed structure.
 */
// PS360 template files embed heavily-escaped inner XML inside each
// `<ContentRTF>`, so entity counts routinely exceed fast-xml-parser's
// default anti-bomb limit of 1000. These are user-supplied files from
// their own PS360 system (trusted input, no network origin), so raising
// the limit is safe. We keep per-entity size caps modest.
const RELAXED_ENTITY_CONFIG = {
  enabled: true,
  maxTotalExpansions: Infinity,
  maxEntitySize: 1_000_000,
  maxExpansionDepth: 100,
  maxExpandedLength: 100_000_000,
};

export function parsePortalAutoText(xml: string): PortalAutoTextExport {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
    preserveOrder: false,
    processEntities: RELAXED_ENTITY_CONFIG,
    htmlEntities: false,
    cdataPropName: "#cdata",
    textNodeName: "#text",
  });

  const parsed = parser.parse(xml) as {
    PortalAutoTextExport?: { AutoText?: unknown };
  };

  const root = parsed.PortalAutoTextExport;
  if (!root) {
    throw new Error("Root element <PortalAutoTextExport> not found");
  }

  const autoTextNodes = toArray(root.AutoText);
  const autoTexts = autoTextNodes.map((n, idx) => parseAutoTextNode(n, idx));

  return { autoTexts };
}

function parseAutoTextNode(raw: unknown, index: number): AutoText {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`AutoText[${index}]: expected object`);
  }
  const node = raw as Record<string, unknown>;

  const name = asString(node.Name);
  if (name === undefined) {
    throw new Error(`AutoText[${index}]: missing <Name>`);
  }

  const contentRtf = asString(node.ContentRTF) ?? "";
  const { rtf, inner } = splitRtfAndInner(contentRtf, index);

  return {
    name,
    description: asString(node.Description),
    contentText: asString(node.ContentText) ?? "",
    createDate: asString(node.CreateDate),
    guid: asString(node.GUID),
    parentGuid: asString(node.ParentGUID),
    autoTextId: asString(node.AutoTextID),
    ownerFirstName: asString(node.OwnerFirstName),
    ownerLastName: asString(node.OwnerLastName),
    ownerAccountId: asString(node.OwnerAccountID),
    groupName: asString(node.GroupName),
    isPrivate: asBool(node.IsPrivate),
    isDefault: asBool(node.IsDefault),
    autoTextDefaultTypeId: asString(node.AutoTextDefaultTypeID),
    rtf,
    inner,
  };
}

interface RtfSplit {
  rtf: string;
  inner: InnerAutoTextXml;
}

function splitRtfAndInner(contentRtf: string, autoTextIndex: number): RtfSplit {
  const markerIdx = contentRtf.indexOf(INNER_XML_MARKER);
  if (markerIdx === -1) {
    return {
      rtf: contentRtf,
      inner: emptyInner(),
    };
  }

  const rtfPortion = contentRtf.slice(0, markerIdx);
  const afterMarker = contentRtf.slice(markerIdx + INNER_XML_MARKER.length);
  const innerXml = afterMarker.trimStart();

  const inner = parseInnerXml(innerXml, autoTextIndex);
  return { rtf: rtfPortion, inner };
}

function emptyInner(): InnerAutoTextXml {
  return {
    fields: [],
    links: [],
    textSources: [],
    snippetGroups: [],
  };
}

function parseInnerXml(innerXml: string, autoTextIndex: number): InnerAutoTextXml {
  if (innerXml.length === 0) return emptyInner();

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
    processEntities: RELAXED_ENTITY_CONFIG,
    textNodeName: "#text",
  });

  let parsed: { autotext?: unknown; "?xml"?: unknown };
  try {
    parsed = parser.parse(innerXml);
  } catch (err) {
    throw new Error(
      `AutoText[${autoTextIndex}]: inner XML parse failed: ${(err as Error).message}`,
    );
  }

  const autotext = parsed.autotext;
  if (typeof autotext !== "object" || autotext === null) {
    throw new Error(`AutoText[${autoTextIndex}]: <autotext> element not found`);
  }
  const at = autotext as Record<string, unknown>;

  return {
    version: asAttr(at, "@_version"),
    editMode: asAttr(at, "@_editMode"),
    fields: parseFields(at.fields),
    links: parseLinks(at.links),
    textSources: parseTextSources(at.textSource),
    snippetGroups: parseSnippetGroups(at.snippetGroups),
  };
}

function parseFields(raw: unknown): InnerField[] {
  if (!raw || typeof raw !== "object") return [];
  const node = raw as Record<string, unknown>;
  return toArray(node.field).map(parseField);
}

function parseField(raw: unknown): InnerField {
  const f = raw as Record<string, unknown>;
  const defaultValueNode = f.defaultvalue;
  let defaultValue: string | undefined;
  let defaultValueAutoTextId: string | undefined;
  let defaultValueAutoTextName: string | undefined;

  if (typeof defaultValueNode === "string") {
    defaultValue = defaultValueNode;
  } else if (typeof defaultValueNode === "object" && defaultValueNode !== null) {
    const dv = defaultValueNode as Record<string, unknown>;
    defaultValue = asString(dv["#text"]);
    defaultValueAutoTextId = asAttr(dv, "@_autotextId");
    defaultValueAutoTextName = asAttr(dv, "@_autotextName");
  }

  return {
    type: asAttr(f, "@_type") ?? "",
    start: parseInt(asAttr(f, "@_start") ?? "0", 10),
    length: parseInt(asAttr(f, "@_length") ?? "0", 10),
    mergeid: asAttr(f, "@_mergeid"),
    mergename: asAttr(f, "@_mergename"),
    name: asString(f.name) ?? "",
    defaultValue,
    defaultValueAutoTextId,
    defaultValueAutoTextName,
    choices: parseChoices(f.choices),
    customProperties: parseCustomProperties(f.customproperties),
  };
}

function parseChoices(raw: unknown): InnerChoice[] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const node = raw as Record<string, unknown>;
  return toArray(node.choice).map(parseChoice);
}

function parseChoice(raw: unknown): InnerChoice {
  if (typeof raw === "string") {
    return { name: "", text: raw };
  }
  const c = raw as Record<string, unknown>;
  return {
    name: asAttr(c, "@_name") ?? "",
    text: asString(c["#text"]) ?? "",
  };
}

function parseCustomProperties(raw: unknown): InnerCustomProperty[] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const node = raw as Record<string, unknown>;
  return toArray(node.property).map(parseCustomProperty);
}

function parseCustomProperty(raw: unknown): InnerCustomProperty {
  const p = raw as Record<string, unknown>;
  return {
    name: asString(p.name) ?? "",
    value: asString(p.value) ?? "",
  };
}

function parseLinks(raw: unknown): InnerLink[] {
  if (!raw || typeof raw !== "object") return [];
  const node = raw as Record<string, unknown>;
  return toArray(node.link).map((l) => ({ raw: JSON.stringify(l) }));
}

function parseTextSources(raw: unknown): InnerTextSource[] {
  if (!raw || typeof raw !== "object") return [];
  const node = raw as Record<string, unknown>;
  return toArray(node.range).map((r) => {
    const attrs = r as Record<string, unknown>;
    return {
      type: asAttr(attrs, "@_type") ?? "",
      start: parseInt(asAttr(attrs, "@_start") ?? "0", 10),
      length: parseInt(asAttr(attrs, "@_length") ?? "0", 10),
    };
  });
}

function parseSnippetGroups(raw: unknown): InnerSnippetGroup[] {
  if (!raw || typeof raw !== "object") return [];
  return [];
}

// ---- helpers ----

function toArray(v: unknown): unknown[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
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

function asBool(v: unknown): boolean | undefined {
  const s = asString(v);
  if (s === undefined) return undefined;
  const lower = s.toLowerCase();
  if (lower === "true") return true;
  if (lower === "false") return false;
  return undefined;
}

function asAttr(node: Record<string, unknown>, key: string): string | undefined {
  const v = node[key];
  return typeof v === "string" ? v : undefined;
}
