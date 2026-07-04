// Curated font list for the Customize typography panel. Bundled OFL families
// (loaded via /public/fonts/fonts.css — not a CDN, so worker-side export and
// offline both work) plus a couple of system stacks. The `stack` string is what
// goes into `ctx.font`.

export interface FontOption {
  label: string;
  stack: string;
  category: "serif" | "sans" | "slab" | "mono";
}

export const FONTS: FontOption[] = [
  { label: "EB Garamond", stack: "'EB Garamond', Garamond, serif", category: "serif" },
  { label: "Playfair Display", stack: "'Playfair Display', Georgia, serif", category: "serif" },
  { label: "Iowan (system)", stack: "'Iowan Old Style', Palatino, Georgia, serif", category: "serif" },
  { label: "Inter", stack: "'Inter', system-ui, sans-serif", category: "sans" },
  { label: "Archivo", stack: "'Archivo', system-ui, sans-serif", category: "sans" },
  { label: "System Sans", stack: "system-ui, -apple-system, sans-serif", category: "sans" },
  { label: "Roboto Slab", stack: "'Roboto Slab', Georgia, serif", category: "slab" },
  { label: "JetBrains Mono", stack: "'JetBrains Mono', ui-monospace, monospace", category: "mono" },
];

/** All family names we bundle, for `document.fonts.ready` gating on export. */
export const BUNDLED_FAMILIES = [
  "EB Garamond",
  "Playfair Display",
  "Inter",
  "Archivo",
  "Roboto Slab",
  "JetBrains Mono",
];
