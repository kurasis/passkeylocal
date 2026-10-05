/**
 * Pre-parse checks for the authenticated KDBX XML payload.
 *
 * Runs on the decrypted, authenticated XML string before any DOM parser sees it.
 * Rejects DTDs, entity declarations, processing instructions other than the XML
 * declaration, XInclude, raw control characters, excessive nesting and excessive
 * element counts. The scan is linear in the input length and allocates nothing
 * proportional to the input.
 *
 * The Python recovery tool applies the same rules in vault_recovery/xml_guard.py.
 */

import { VaultError } from './errors.ts';
import { LIMITS } from './profile.ts';

const XINCLUDE_NS = 'http://www.w3.org/2001/XInclude';

// Characters not allowed raw in XML 1.0 (TAB, LF and CR are allowed).
// eslint-disable-next-line no-control-regex
const FORBIDDEN_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/;
// Unpaired UTF-16 surrogates mean the source was not valid Unicode.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

export interface XmlGuardLimits {
  maxDepth: number;
  maxElements: number;
}

const DEFAULT_LIMITS: XmlGuardLimits = {
  maxDepth: LIMITS.maxXmlDepth,
  maxElements: LIMITS.maxXmlElements
};

const reject = (detail: string) => new VaultError('UNSUPPORTED', detail);
const malformed = (detail: string) => new VaultError('MALFORMED', detail);

/** Throws VaultError if the XML payload uses forbidden constructs or exceeds limits. */
export function assertSafeXml(xml: string, limits: XmlGuardLimits = DEFAULT_LIMITS): void {
  if (FORBIDDEN_CHARS.test(xml)) throw malformed('xml-forbidden-character');
  if (LONE_SURROGATE.test(xml)) throw malformed('xml-invalid-unicode');
  if (xml.includes(XINCLUDE_NS)) throw reject('xml-xinclude');

  let depth = 0;
  let elements = 0;
  let i = 0;
  const n = xml.length;
  let sawRoot = false;

  while (i < n) {
    const lt = xml.indexOf('<', i);
    if (lt < 0) break;
    const next = xml.charCodeAt(lt + 1);

    if (next === 0x21 /* ! */) {
      if (xml.startsWith('<!--', lt)) {
        const end = xml.indexOf('-->', lt + 4);
        if (end < 0) throw malformed('xml-unterminated-comment');
        i = end + 3;
        continue;
      }
      if (xml.startsWith('<![CDATA[', lt)) {
        if (depth === 0) throw malformed('xml-cdata-outside-root');
        const end = xml.indexOf(']]>', lt + 9);
        if (end < 0) throw malformed('xml-unterminated-cdata');
        i = end + 3;
        continue;
      }
      // <!DOCTYPE, <!ENTITY, <!ELEMENT, <!ATTLIST, ...
      throw reject('xml-dtd-or-declaration');
    }

    if (next === 0x3f /* ? */) {
      const end = xml.indexOf('?>', lt + 2);
      if (end < 0) throw malformed('xml-unterminated-pi');
      const declStart = xml.charCodeAt(0) === 0xfeff ? 1 : 0;
      const isXmlDeclaration = lt === declStart && /^xml[\s?]/.test(xml.slice(lt + 2, lt + 6));
      if (!isXmlDeclaration) throw reject('xml-processing-instruction');
      i = end + 2;
      continue;
    }

    // Find the end of the tag, honouring quoted attribute values.
    let j = lt + 1;
    let quote = 0;
    for (; j < n; j++) {
      const c = xml.charCodeAt(j);
      if (quote) {
        if (c === quote) quote = 0;
      } else if (c === 0x22 || c === 0x27) {
        quote = c;
      } else if (c === 0x3e /* > */) {
        break;
      } else if (c === 0x3c /* < */) {
        throw malformed('xml-unexpected-lt');
      }
    }
    if (j >= n) throw malformed('xml-unterminated-tag');

    if (next === 0x2f /* / */) {
      depth--;
      if (depth < 0) throw malformed('xml-unbalanced');
    } else {
      if (depth === 0) {
        if (sawRoot) throw malformed('xml-multiple-roots');
        sawRoot = true;
      }
      elements++;
      if (elements > limits.maxElements) throw new VaultError('LIMIT_EXCEEDED', 'xml-too-many-elements');
      const selfClosing = xml.charCodeAt(j - 1) === 0x2f;
      if (!selfClosing) {
        depth++;
        if (depth > limits.maxDepth) throw new VaultError('LIMIT_EXCEEDED', 'xml-too-deep');
      }
    }
    i = j + 1;
  }
  if (!sawRoot) throw malformed('xml-no-root');
  if (depth !== 0) throw malformed('xml-unbalanced');
}

/**
 * Escape characters that XML parsers would otherwise normalize or that kdbxweb
 * strips before parsing, so that the exact value survives a round trip:
 *  - TAB: kdbxweb 2.1.1's own XmlUtils.parse removes raw U+0009 before parsing
 *    (data loss in other kdbxweb-based readers, e.g. KeeWeb).
 *  - CR: XML end-of-line handling turns CR and CRLF into LF.
 * Only valid on XML produced by a serializer (CR/TAB never appear inside markup).
 */
export function escapeWhitespaceForRoundTrip(xml: string): string {
  return xml.replace(/\r/g, '&#13;').replace(/\t/g, '&#9;');
}
