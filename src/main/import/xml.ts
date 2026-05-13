import path from 'node:path';

export type XmlElement = {
  name: string;
  attributes: Record<string, string>;
  inner: string;
  full: string;
};

export type XmlRelationship = {
  id: string;
  type: string;
  target: string;
  targetMode?: string;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function decodeXmlEntities(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|quot);/gi, (entity, body: string) => {
    if (body.toLowerCase().startsWith('#x')) {
      return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    }

    if (body.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    }

    switch (body) {
      case 'amp':
        return '&';
      case 'apos':
        return "'";
      case 'gt':
        return '>';
      case 'lt':
        return '<';
      case 'quot':
        return '"';
      default:
        return entity;
    }
  });
}

export function localName(name: string): string {
  const colonIndex = name.indexOf(':');
  return colonIndex === -1 ? name : name.slice(colonIndex + 1);
}

export function parseAttributes(attributeSource: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attributePattern = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;

  while ((match = attributePattern.exec(attributeSource)) !== null) {
    const [, rawName, doubleQuotedValue, singleQuotedValue] = match;
    const value = decodeXmlEntities(doubleQuotedValue ?? singleQuotedValue ?? '');
    attributes[rawName] = value;

    const rawLocalName = localName(rawName);
    attributes[rawLocalName] ??= value;
  }

  return attributes;
}

export function findElements(xml: string, elementLocalName: string): XmlElement[] {
  const escapedName = escapeRegExp(elementLocalName);
  const pattern = new RegExp(`<((?:[\\w.-]+:)?${escapedName})\\b([^>]*)>([\\s\\S]*?)<\\/\\1>`, 'g');
  const elements: XmlElement[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml)) !== null) {
    const [, name, attributeSource, inner] = match;
    elements.push({
      name,
      attributes: parseAttributes(attributeSource),
      inner,
      full: match[0],
    });
  }

  return elements;
}

export function findFirstElement(xml: string, elementLocalName: string): XmlElement | undefined {
  return findElements(xml, elementLocalName)[0];
}

export function findStartTags(xml: string, elementLocalName: string): XmlElement[] {
  const escapedName = escapeRegExp(elementLocalName);
  const pattern = new RegExp(`<((?:[\\w.-]+:)?${escapedName})\\b([^>]*)\\/?\\s*>`, 'g');
  const elements: XmlElement[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml)) !== null) {
    const [, name, attributeSource] = match;
    elements.push({
      name,
      attributes: parseAttributes(attributeSource),
      inner: '',
      full: match[0],
    });
  }

  return elements;
}

export function textContent(xml: string, elementLocalName: string): string {
  return findElements(xml, elementLocalName)
    .map((element) => decodeXmlEntities(element.inner.replace(/<[^>]+>/g, '')))
    .join('');
}

export function parseRelationships(xml: string): XmlRelationship[] {
  return findStartTags(xml, 'Relationship')
    .map((relationship) => ({
      id: relationship.attributes.Id ?? relationship.attributes.id ?? '',
      type: relationship.attributes.Type ?? relationship.attributes.type ?? '',
      target: relationship.attributes.Target ?? relationship.attributes.target ?? '',
      targetMode: relationship.attributes.TargetMode ?? relationship.attributes.targetMode,
    }))
    .filter((relationship) => relationship.id.length > 0 && relationship.target.length > 0);
}

export function relationshipMap(relationships: XmlRelationship[]): Map<string, XmlRelationship> {
  return new Map(relationships.map((relationship) => [relationship.id, relationship]));
}

export function resolvePackagePath(ownerPath: string, target: string): string {
  if (target.startsWith('/')) {
    return path.posix.normalize(target.slice(1));
  }

  return path.posix.normalize(path.posix.join(path.posix.dirname(ownerPath), target));
}
