// Main-thread wrapper around the streaming PNG worker.

export interface PngStream {
  addRows: (rows: Uint8Array) => void;
  finish: () => Promise<Blob>;
}

export function createPngStream(width: number, height: number): PngStream {
  const worker = new Worker(new URL("./pngStream.worker.ts", import.meta.url), {
    type: "module",
  });
  worker.postMessage({ type: "init", width, height });
  return {
    addRows(rows: Uint8Array) {
      const buf = rows.buffer;
      worker.postMessage({ type: "rows", data: buf }, [buf]);
    },
    finish() {
      return new Promise<Blob>((resolve) => {
        worker.onmessage = (e: MessageEvent) => {
          if (e.data?.type === "done") {
            resolve(e.data.blob as Blob);
            worker.terminate();
          }
        };
        worker.postMessage({ type: "finish" });
      });
    },
  };
}

/** Prefix each RGBA scanline with a filter-0 byte (streaming PNG rows). */
export function prefixRows(
  data: Uint8ClampedArray,
  width: number,
  rows: number,
): Uint8Array {
  const rowBytes = width * 4;
  const out = new Uint8Array(rows * (rowBytes + 1));
  for (let y = 0; y < rows; y++) {
    out[y * (rowBytes + 1)] = 0; // filter: none
    out.set(data.subarray(y * rowBytes, (y + 1) * rowBytes), y * (rowBytes + 1) + 1);
  }
  return out;
}
