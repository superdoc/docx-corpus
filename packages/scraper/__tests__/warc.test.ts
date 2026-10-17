import { describe, expect, test } from "bun:test";
import { findPattern, parseWarcRecord } from "../commoncrawl/warc";

describe("findPattern", () => {
  test("finds pattern at start of data", () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    expect(findPattern(data, [1, 2])).toBe(0);
  });

  test("finds pattern in middle of data", () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    expect(findPattern(data, [3, 4])).toBe(2);
  });

  test("finds pattern at end of data", () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    expect(findPattern(data, [4, 5])).toBe(3);
  });

  test("returns -1 when pattern not found", () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    expect(findPattern(data, [6, 7])).toBe(-1);
  });

  test("returns -1 for empty data", () => {
    const data = new Uint8Array([]);
    expect(findPattern(data, [1, 2])).toBe(-1);
  });

  test("finds single-byte pattern", () => {
    const data = new Uint8Array([1, 2, 3]);
    expect(findPattern(data, [2])).toBe(1);
  });

  test("finds CRLF CRLF pattern", () => {
    const data = new Uint8Array([65, 13, 10, 13, 10, 66]); // A\r\n\r\nB
    expect(findPattern(data, [13, 10, 13, 10])).toBe(1);
  });

  test("handles pattern longer than data", () => {
    const data = new Uint8Array([1, 2]);
    expect(findPattern(data, [1, 2, 3, 4])).toBe(-1);
  });
});

const CRLF2 = new Uint8Array([13, 10, 13, 10]);

function bytes(...parts: (string | Uint8Array)[]): Uint8Array {
  const encoded = parts.map((p) => (typeof p === "string" ? new TextEncoder().encode(p) : p));
  const result = new Uint8Array(encoded.reduce((sum, p) => sum + p.length, 0));
  let offset = 0;
  for (const part of encoded) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

// A WARC response record whose WARC Content-Length covers exactly the HTTP headers and body.
function warcRecord(httpHeader: string, body: string | Uint8Array, terminator = false) {
  const block = bytes(httpHeader, body);
  return bytes(
    `WARC/1.0\r\nWARC-Type: response\r\nContent-Length: ${block.length}\r\n\r\n`,
    block,
    terminator ? CRLF2 : new Uint8Array(),
  );
}

const text = (data: Uint8Array) => new TextDecoder().decode(data);

describe("parseWarcRecord", () => {
  test("returns the HTTP body", () => {
    const result = parseWarcRecord(warcRecord("HTTP/1.1 200 OK\r\n\r\n", "hello"));
    expect(text(result.content)).toBe("hello");
    expect(result.contentLength).toBe(5);
  });

  test("handles binary body content", () => {
    const binaryBody = new Uint8Array([0x00, 0xff, 0x50, 0x4b, 0x03, 0x04]);
    const result = parseWarcRecord(warcRecord("HTTP/1.1 200 OK\r\n\r\n", binaryBody));
    expect(result.content).toEqual(binaryBody);
  });

  test("handles empty body", () => {
    const result = parseWarcRecord(warcRecord("HTTP/1.1 200 OK\r\n\r\n", ""));
    expect(result.contentLength).toBe(0);
  });

  test("throws when WARC header separator missing", () => {
    expect(() => parseWarcRecord(bytes("WARC/1.0\r\nWARC-Type: response\r\n"))).toThrow(
      "Invalid WARC record: no WARC header separator found",
    );
  });

  test("throws when HTTP header separator missing", () => {
    const data = bytes("WARC/1.0\r\nWARC-Type: response\r\n", CRLF2, "HTTP/1.1 200 OK\r\n");
    expect(() => parseWarcRecord(data)).toThrow(
      "Invalid WARC record: no HTTP header separator found",
    );
  });

  test("respects HTTP Content-Length and excludes WARC record terminator", () => {
    // WARC records end with \r\n\r\n after the content block. The body is exactly
    // HTTP Content-Length bytes; anything after is record structure.
    const data = warcRecord("HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\n", "hello", true);
    expect(text(parseWarcRecord(data).content)).toBe("hello");
  });

  test("reads HTTP Content-Length case-insensitively", () => {
    const data = warcRecord("HTTP/1.1 200 OK\r\ncontent-length: 5\r\n\r\n", "hello+extra");
    expect(text(parseWarcRecord(data).content)).toBe("hello");
  });

  test("WARC Content-Length alone excludes record terminator (no HTTP Content-Length)", () => {
    // Responses without HTTP Content-Length (e.g. chunked Transfer-Encoding)
    // must still avoid pulling the WARC \r\n\r\n separator into the body.
    const data = warcRecord("HTTP/1.1 200 OK\r\n\r\n", "no-http-clen", true);
    expect(text(parseWarcRecord(data).content)).toBe("no-http-clen");
  });

  test("falls back to slicing to end when no Content-Length present at all", () => {
    const data = bytes(
      "WARC/1.0\r\nWARC-Type: response\r\n\r\n",
      "HTTP/1.1 200 OK\r\n\r\n",
      "no-clen-anywhere",
    );
    expect(text(parseWarcRecord(data).content)).toBe("no-clen-anywhere");
  });

  test("falls back when Content-Length exceeds available data", () => {
    const data = bytes(
      "WARC/1.0\r\nWARC-Type: response\r\n\r\n",
      "HTTP/1.1 200 OK\r\nContent-Length: 9999999\r\n\r\n",
      "short",
    );
    expect(text(parseWarcRecord(data).content)).toBe("short");
  });
});
