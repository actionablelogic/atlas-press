// Streaming PNG encoder: receives RGBA scanline strips and deflates them
// incrementally with pako, emitting one IDAT chunk per deflate output block so
// peak memory stays ~one strip + deflate buffers (needed for A0+ / 140 MP).
// Scanlines use filter 0 (none). Colour type 6 (RGBA), 8-bit.

import { Deflate } from "pako";

const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crcInput = out.subarray(4, 8 + data.length);
  dv.setUint32(8 + data.length, crc32(crcInput));
  return out;
}

let parts: Uint8Array[] = [];
let deflate: Deflate | null = null;

function ihdr(width: number, height: number): Uint8Array {
  const d = new Uint8Array(13);
  const dv = new DataView(d.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  d[8] = 8; // bit depth
  d[9] = 6; // colour type RGBA
  return d;
}

self.onmessage = (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === "init") {
    parts = [SIGNATURE, chunk("IHDR", ihdr(msg.width, msg.height))];
    deflate = new Deflate({ level: 5 });
    deflate.onData = (out: Uint8Array) => parts.push(chunk("IDAT", out));
    return;
  }
  if (msg.type === "rows") {
    // msg.data is an ArrayBuffer of filter-prefixed scanlines.
    deflate!.push(new Uint8Array(msg.data), false);
    return;
  }
  if (msg.type === "finish") {
    deflate!.push(new Uint8Array(0), true);
    parts.push(chunk("IEND", new Uint8Array(0)));
    const blob = new Blob(parts as BlobPart[], { type: "image/png" });
    parts = [];
    deflate = null;
    (self as unknown as Worker).postMessage({ type: "done", blob });
  }
};
