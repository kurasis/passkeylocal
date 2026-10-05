/**
 * Single place where kdbxweb is configured. Every module must obtain kdbxweb
 * through `kdbx()` so that the hooks below are always installed.
 *
 * Narrowly scoped integration patches (documented in docs/DEPENDENCIES.md):
 *  1. Argon2id implementation from hash-wasm (kdbxweb has none built in).
 *  2. XmlUtils.parse runs the XML guard first, then parses with @xmldom/xmldom
 *     0.9 configured to fail on any warning or error. kdbxweb 2.1.1 targets the
 *     xmldom 0.7 constructor API, which 0.9 rejects; 0.7/0.8 carry unresolved
 *     advisories. Where no global DOMParser/XMLSerializer exists (Node, Web
 *     Workers) the same xmldom classes are installed for kdbxweb's own use.
 *  3. XmlUtils.serialize entitizes CR and TAB so values round-trip exactly,
 *     including through readers that normalize or strip them.
 *  4. ByteUtils.bytesToString decodes UTF-8 strictly instead of replacing
 *     invalid sequences with U+FFFD.
 */

import kdbxweb from 'kdbxweb';
import { DOMParser as XmldomParser, XMLSerializer as XmldomSerializer } from '@xmldom/xmldom';
import { argon2Impl } from './argon2.ts';
import { assertSafeXml, escapeWhitespaceForRoundTrip } from './xml-guard.ts';
import { VaultError } from './errors.ts';

let installed = false;

export function kdbx(): typeof kdbxweb {
  if (!installed) install();
  return kdbxweb;
}

const failOnAnyDiagnostic = (): never => {
  throw new VaultError('MALFORMED', 'xml');
};

function strictParse(xml: string): Document {
  const doc = new XmldomParser({ onError: failOnAnyDiagnostic }).parseFromString(xml, 'application/xml');
  if (!doc.documentElement) throw new VaultError('MALFORMED', 'xml');
  return doc as unknown as Document;
}

function installDomGlobals(): void {
  const g = globalThis as Record<string, unknown>;
  if (typeof g.DOMParser === 'undefined') {
    g.DOMParser = class {
      parseFromString(source: string, mimeType: string) {
        return new XmldomParser({ onError: failOnAnyDiagnostic }).parseFromString(source, mimeType as 'application/xml');
      }
    };
  }
  if (typeof g.XMLSerializer === 'undefined') g.XMLSerializer = XmldomSerializer;
}

function install(): void {
  installDomGlobals();
  kdbxweb.CryptoEngine.setArgon2Impl(argon2Impl);

  const xmlUtils = kdbxweb.XmlUtils as unknown as {
    parse: (xml: string) => Document;
    serialize: (doc: Document, pretty?: boolean) => string;
  };
  const originalSerialize = xmlUtils.serialize;
  xmlUtils.parse = (xml: string): Document => {
    assertSafeXml(xml);
    return strictParse(xml);
  };
  xmlUtils.serialize = (doc: Document, pretty?: boolean): string => {
    return escapeWhitespaceForRoundTrip(originalSerialize(doc, pretty));
  };

  const byteUtils = kdbxweb.ByteUtils as unknown as { bytesToString: (arr: ArrayBuffer | Uint8Array) => string };
  const strictDecoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  byteUtils.bytesToString = (arr: ArrayBuffer | Uint8Array): string => {
    try {
      return strictDecoder.decode(arr instanceof ArrayBuffer ? new Uint8Array(arr) : arr);
    } catch {
      throw new VaultError('MALFORMED', 'invalid-utf8');
    }
  };

  installed = true;
}
