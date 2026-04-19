/**
 * AST types for PS360 PortalAutoTextExport XML files.
 *
 * A PortalAutoTextExport contains a list of AutoText entries. Each AutoText
 * has a ContentRTF field holding both RTF-formatted body text and, after the
 * RTF payload, an `{\xml}` marker followed by HTML-entity-encoded XML that
 * describes the field/choice/merge-ref structure. Our parser splits those
 * two layers; our serializer reassembles them byte-exact outside intentional
 * edits.
 */

export interface PortalAutoTextExport {
  autoTexts: AutoText[];
}

export interface AutoText {
  name: string;
  description?: string;
  contentText: string;
  createDate?: string;
  guid?: string;
  parentGuid?: string;
  autoTextId?: string;
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerAccountId?: string;
  groupName?: string;
  isPrivate?: boolean;
  isDefault?: boolean;
  autoTextDefaultTypeId?: string;

  /** Raw RTF portion (everything before the `{\xml}` marker inside ContentRTF). */
  rtf: string;

  /** Decoded inner-XML AST describing fields/choices/merge-refs. */
  inner: InnerAutoTextXml;

  /**
   * Any top-level elements present in the source AutoText that we did not
   * model explicitly. Preserved verbatim so round-tripping is lossless.
   */
  unknownElements?: UnknownElement[];
}

export interface UnknownElement {
  name: string;
  /** Raw serialized content of the element, including the element itself. */
  raw: string;
}

export interface InnerAutoTextXml {
  version?: string;
  editMode?: string;
  fields: InnerField[];
  links: InnerLink[];
  textSources: InnerTextSource[];
  snippetGroups: InnerSnippetGroup[];
}

export interface InnerField {
  type: string;
  start: number;
  length: number;
  mergeid?: string;
  mergename?: string;
  name: string;
  defaultValue?: string;
  defaultValueAutoTextId?: string;
  defaultValueAutoTextName?: string;
  choices?: InnerChoice[];
  customProperties?: InnerCustomProperty[];
}

export interface InnerChoice {
  name: string;
  text: string;
}

export interface InnerCustomProperty {
  name: string;
  value: string;
}

export interface InnerLink {
  raw: string;
}

export interface InnerTextSource {
  type: string;
  start: number;
  length: number;
}

export interface InnerSnippetGroup {
  raw: string;
}
