/**
 * Deterministic Client-Side Document Text Extractor
 * Supports PDF, DOCX, and TXT without external AI or server calls.
 * Uses native Web Streams API (DecompressionStream) supported in all modern browsers.
 */

export interface ExtractedDocument {
  fileName: string;
  fileType: string;
  fileSize: number;
  text: string;
  isScannedOrEmpty: boolean;
  error?: string;
}

/**
 * Extracts plain text from File object (PDF, DOCX, or TXT)
 */
export async function extractDocumentText(file: File): Promise<ExtractedDocument> {
  const fileName = file.name;
  const fileSize = file.size;
  const lowerName = fileName.toLowerCase();

  try {
    if (lowerName.endsWith('.txt') || lowerName.endsWith('.rtf') || lowerName.endsWith('.csv') || file.type.startsWith('text/')) {
      const text = await extractFromPlainText(file);
      return {
        fileName,
        fileType: 'TXT',
        fileSize,
        text: cleanText(text),
        isScannedOrEmpty: text.trim().length < 15
      };
    }

    if (lowerName.endsWith('.docx')) {
      const text = await extractFromDocx(file);
      return {
        fileName,
        fileType: 'DOCX',
        fileSize,
        text: cleanText(text),
        isScannedOrEmpty: text.trim().length < 15
      };
    }

    if (lowerName.endsWith('.pdf') || file.type === 'application/pdf') {
      const text = await extractFromPdf(file);
      return {
        fileName,
        fileType: 'PDF',
        fileSize,
        text: cleanText(text),
        isScannedOrEmpty: text.trim().length < 20
      };
    }

    // Fallback try reading as text
    const text = await extractFromPlainText(file);
    return {
      fileName,
      fileType: 'UNKNOWN',
      fileSize,
      text: cleanText(text),
      isScannedOrEmpty: text.trim().length < 15
    };
  } catch (err: any) {
    console.warn(`Extraction notice for ${fileName}:`, err);
    return {
      fileName,
      fileType: lowerName.endsWith('.pdf') ? 'PDF' : lowerName.endsWith('.docx') ? 'DOCX' : 'TXT',
      fileSize,
      text: '',
      isScannedOrEmpty: true,
      error: err?.message || 'Extraction failed'
    };
  }
}

/**
 * Extracts plain text files
 */
async function extractFromPlainText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || '');
    reader.onerror = () => reject(new Error('Failed to read text file'));
    reader.readAsText(file);
  });
}

/**
 * Extracts text from DOCX (ZIP archive containing word/document.xml)
 */
async function extractFromDocx(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Scan local file headers in ZIP (PK\x03\x04 = 0x04034b50)
  let offset = 0;
  while (offset < bytes.length - 30) {
    if (bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b && bytes[offset + 2] === 0x03 && bytes[offset + 3] === 0x04) {
      const compressionMethod = bytes[offset + 8] | (bytes[offset + 9] << 8);
      const compressedSize = bytes[offset + 18] | (bytes[offset + 19] << 8) | (bytes[offset + 20] << 16) | (bytes[offset + 21] << 24);
      const fileNameLen = bytes[offset + 26] | (bytes[offset + 27] << 8);
      const extraFieldLen = bytes[offset + 28] | (bytes[offset + 29] << 8);

      const nameBytes = bytes.slice(offset + 30, offset + 30 + fileNameLen);
      const entryName = new TextDecoder().decode(nameBytes);

      const dataStart = offset + 30 + fileNameLen + extraFieldLen;
      const dataEnd = dataStart + compressedSize;

      if (entryName === 'word/document.xml') {
        const compressedData = bytes.slice(dataStart, dataEnd);
        let xmlText = '';

        if (compressionMethod === 0) {
          // Stored without compression
          xmlText = new TextDecoder().decode(compressedData);
        } else if (compressionMethod === 8) {
          // Deflate compressed
          try {
            const decompressedStream = new Response(compressedData).body!.pipeThrough(new DecompressionStream('deflate-raw'));
            xmlText = await new Response(decompressedStream).text();
          } catch (decompErr) {
            // Try standard deflate
            const decompressedStream = new Response(compressedData).body!.pipeThrough(new DecompressionStream('deflate'));
            xmlText = await new Response(decompressedStream).text();
          }
        }

        return parseDocxXml(xmlText);
      }

      offset = dataEnd;
    } else {
      offset++;
    }
  }

  // Fallback: search for UTF-8 XML strings directly in binary
  const binaryString = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  return parseDocxXml(binaryString);
}

/**
 * Parses XML content of word/document.xml to clean human-readable text
 */
function parseDocxXml(xml: string): string {
  // Replace paragraph endings and breaks with newlines
  let text = xml
    .replace(/<\/w:p>/gi, '\n')
    .replace(/<w:br[^>]*\/>/gi, '\n')
    .replace(/<w:tab[^>]*\/>/gi, '\t');

  // Match all <w:t> content
  const matches = text.match(/<w:t[^>]*>(.*?)<\/w:t>/gi);
  if (matches && matches.length > 0) {
    const extracted = matches
      .map(m => m.replace(/<w:t[^>]*>/gi, '').replace(/<\/w:t>/gi, ''))
      .join(' ');
    if (extracted.trim().length > 20) return extracted;
  }

  // Strip remaining XML tags
  return text.replace(/<[^>]+>/g, ' ');
}

/**
 * Extracts selectable text streams from PDF files
 */
async function extractFromPdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const pdfString = new TextDecoder('latin1').decode(bytes);

  const textBlocks: string[] = [];

  // Match all stream objects
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(pdfString)) !== null) {
    const rawStream = match[1];
    let streamText = '';

    // Check if the stream contains readable text commands like (text) Tj or BT...ET
    if (rawStream.includes('BT') && (rawStream.includes('Tj') || rawStream.includes('TJ'))) {
      streamText = rawStream;
    } else {
      // Try decompressing stream if it's FlateDecode
      try {
        const streamStart = match.index + match[0].indexOf(rawStream);
        const streamBytes = bytes.slice(streamStart, streamStart + rawStream.length);
        const decompressed = await decompressPdfStream(streamBytes);
        if (decompressed.includes('BT') || decompressed.includes('Tj') || decompressed.includes('TJ')) {
          streamText = decompressed;
        }
      } catch (e) {
        // Continue if stream decompression is not applicable
      }
    }

    if (streamText) {
      const extracted = parsePdfTextCommands(streamText);
      if (extracted.trim()) {
        textBlocks.push(extracted);
      }
    }
  }

  const combined = textBlocks.join('\n\n');
  if (combined.trim().length > 30) {
    return combined;
  }

  // Fallback heuristic: search for raw string parentheticals (Text) in the PDF
  const parenStrings: string[] = [];
  const parenRegex = /\(([^()]{3,})\)\s*(?:Tj|'|")/g;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = parenRegex.exec(pdfString)) !== null) {
    parenStrings.push(pMatch[1]);
  }

  if (parenStrings.length > 5) {
    return parenStrings.join(' ');
  }

  return combined;
}

/**
 * Decompresses Flate-compressed PDF stream bytes
 */
async function decompressPdfStream(streamBytes: Uint8Array): Promise<string> {
  // In PDF, zlib header is often 0x78 (0x78 0x9c or 0x78 0x01)
  try {
    const stream = new Response(streamBytes).body!.pipeThrough(new DecompressionStream('deflate'));
    return await new Response(stream).text();
  } catch {
    // Try deflate-raw if header is stripped
    const raw = streamBytes.length > 2 && streamBytes[0] === 0x78 ? streamBytes.slice(2) : streamBytes;
    const stream = new Response(raw).body!.pipeThrough(new DecompressionStream('deflate-raw'));
    return await new Response(stream).text();
  }
}

/**
 * Extracts text from PDF text-rendering operators:
 * (text) Tj
 * [(t) 20 (ext)] TJ
 * (text) '
 */
function parsePdfTextCommands(content: string): string {
  const result: string[] = [];

  // Match TJ arrays: [(text) -200 (text)] TJ
  const tjArrayRegex = /\[(.*?)\]\s*TJ/gi;
  let tjMatch: RegExpExecArray | null;
  while ((tjMatch = tjArrayRegex.exec(content)) !== null) {
    const inner = tjMatch[1];
    const stringParts = inner.match(/\((.*?)\)/g);
    if (stringParts) {
      const word = stringParts.map(s => unescapePdfString(s.slice(1, -1))).join('');
      result.push(word);
    }
  }

  // Match Tj strings: (text) Tj
  const tjStringRegex = /\((.*?)\)\s*Tj/gi;
  let tMatch: RegExpExecArray | null;
  while ((tMatch = tjStringRegex.exec(content)) !== null) {
    result.push(unescapePdfString(tMatch[1]));
  }

  // Match hex strings: <48656c6c6f> Tj
  const hexRegex = /<([0-9a-fA-F]+)>\s*Tj/gi;
  let hMatch: RegExpExecArray | null;
  while ((hMatch = hexRegex.exec(content)) !== null) {
    result.push(decodeHex(hMatch[1]));
  }

  return result.join(' ');
}

function unescapePdfString(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}

function decodeHex(hex: string): string {
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  }
  return str;
}

/**
 * Cleans and normalizes whitespace
 */
function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
