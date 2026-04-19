import type {
  AutoText,
  InnerAutoTextXml,
  InnerChoice,
  InnerCustomProperty,
  InnerField,
  InnerTextSource,
  PortalAutoTextExport,
} from "../types/portal-autotext.js";

const INNER_XML_MARKER = "{\\xml}";

/**
 * Serialize a PortalAutoTextExport AST back to XML.
 *
 * Produces deterministic output suitable for byte-comparison after a
 * parse → serialize → parse round-trip. The RTF portion of each AutoText's
 * ContentRTF is preserved verbatim; the inner XML is re-emitted from the
 * AST with stable attribute/element ordering.
 */
export function serializePortalAutoText(doc: PortalAutoTextExport): string {
  const parts: string[] = [];
  parts.push('<?xml version="1.0" encoding="utf-8"?>');
  parts.push("<PortalAutoTextExport>");
  for (const at of doc.autoTexts) {
    parts.push(serializeAutoText(at));
  }
  parts.push("</PortalAutoTextExport>");
  return parts.join("\n") + "\n";
}

function serializeAutoText(at: AutoText): string {
  const parts: string[] = ["  <AutoText>"];
  appendOptionalLine(parts, "Name", at.name);
  appendOptionalLine(parts, "Description", at.description);

  const innerXml = serializeInnerXml(at.inner);
  // contentRtf is the unescaped concatenation of RTF + marker + inner XML.
  // escapeXmlText will apply the single layer of entity encoding needed when
  // embedding inside the outer <ContentRTF> element, matching the source file.
  const contentRtf =
    at.rtf + INNER_XML_MARKER + (innerXml.length > 0 ? " " : "") + innerXml;
  parts.push(
    `    <ContentRTF>${escapeXmlText(contentRtf)}</ContentRTF>`,
  );
  appendOptionalLine(parts, "ContentText", at.contentText);
  appendOptionalLine(parts, "AutoTextDefaultTypeID", at.autoTextDefaultTypeId);
  appendOptionalLine(parts, "IsPrivate", boolStr(at.isPrivate));
  appendOptionalLine(parts, "CreateDate", at.createDate);
  appendOptionalLine(parts, "GUID", at.guid);
  appendOptionalLine(parts, "ParentGUID", at.parentGuid);
  appendOptionalLine(parts, "AutoTextID", at.autoTextId);
  appendOptionalLine(parts, "OwnerFirstName", at.ownerFirstName);
  appendOptionalLine(parts, "OwnerLastName", at.ownerLastName);
  appendOptionalLine(parts, "GroupName", at.groupName);
  appendOptionalLine(parts, "OwnerAccountID", at.ownerAccountId);
  appendOptionalLine(parts, "IsDefault", boolStr(at.isDefault));
  parts.push("  </AutoText>");
  return parts.join("\n");
}

function appendOptionalLine(
  parts: string[],
  tag: string,
  value: string | undefined,
): void {
  if (value === undefined) return;
  parts.push(`    <${tag}>${escapeXmlText(value)}</${tag}>`);
}

function boolStr(v: boolean | undefined): string | undefined {
  if (v === undefined) return undefined;
  return v ? "true" : "false";
}

// ---- Inner XML serialization ----

function serializeInnerXml(inner: InnerAutoTextXml): string {
  if (
    inner.fields.length === 0 &&
    inner.links.length === 0 &&
    inner.textSources.length === 0 &&
    inner.snippetGroups.length === 0 &&
    inner.version === undefined &&
    inner.editMode === undefined
  ) {
    return "";
  }

  const parts: string[] = ['<?xml version="1.0" encoding="utf8"?>'];
  const autotextAttrs = [
    attr("version", inner.version),
    attr("editMode", inner.editMode),
  ].filter(Boolean).join("");
  parts.push(`<autotext${autotextAttrs}>`);

  parts.push("<fields>");
  for (const f of inner.fields) {
    parts.push(serializeField(f));
  }
  parts.push("</fields>");

  parts.push("<links />");

  parts.push("<textSource>");
  for (const ts of inner.textSources) {
    parts.push(serializeTextSource(ts));
  }
  parts.push("</textSource>");

  parts.push("<snippetGroups />");

  parts.push("</autotext>");
  return parts.join("");
}

function serializeField(f: InnerField): string {
  const attrs = [
    attr("type", f.type),
    attr("start", String(f.start)),
    attr("length", String(f.length)),
    attr("mergeid", f.mergeid),
    attr("mergename", f.mergename),
  ].filter(Boolean).join("");

  const children: string[] = [];
  children.push(`<name>${escapeInnerText(f.name)}</name>`);

  if (f.defaultValue !== undefined) {
    const dvAttrs = [
      attr("autotextId", f.defaultValueAutoTextId),
      attr("autotextName", f.defaultValueAutoTextName),
    ].filter(Boolean).join("");
    children.push(
      `<defaultvalue${dvAttrs}>${escapeInnerText(f.defaultValue)}</defaultvalue>`,
    );
  }

  if (f.choices && f.choices.length > 0) {
    children.push("<choices>");
    for (const c of f.choices) {
      children.push(serializeChoice(c));
    }
    children.push("</choices>");
  }

  if (f.customProperties && f.customProperties.length > 0) {
    children.push("<customproperties>");
    for (const p of f.customProperties) {
      children.push(serializeCustomProperty(p));
    }
    children.push("</customproperties>");
  }

  return `<field${attrs}>${children.join("")}</field>`;
}

function serializeChoice(c: InnerChoice): string {
  return `<choice name="${escapeAttr(c.name)}">${escapeInnerText(c.text)}</choice>`;
}

function serializeCustomProperty(p: InnerCustomProperty): string {
  return `<property><name>${escapeInnerText(p.name)}</name><value>${escapeInnerText(p.value)}</value></property>`;
}

function serializeTextSource(ts: InnerTextSource): string {
  const attrs = [
    attr("type", ts.type),
    attr("start", String(ts.start)),
    attr("length", String(ts.length)),
  ].filter(Boolean).join("");
  return `<range${attrs} />`;
}

// ---- helpers ----

function attr(name: string, value: string | undefined): string {
  if (value === undefined) return "";
  return ` ${name}="${escapeAttr(value)}"`;
}

function escapeXmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeInnerText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
