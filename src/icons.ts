const paths: Record<string, string> = {
  bolt: '<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>',
  home: '<path d="m3 11 9-7 9 7v9H3v-9Z"/><path d="M9 20v-6h6v6"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  radio: '<path d="M5 10a10 10 0 0 1 14 0M8 13a6 6 0 0 1 8 0"/><circle cx="12" cy="17" r=".8"/><path d="M12 18v4m-3 0h6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  chain: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7L12 5"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19"/>',
  pump: '<path d="M6 21h12m-10 0V8h8v13M8 8l2-4h4l2 4m0 3h3l2 2v4h-3"/><circle cx="12" cy="13" r="1"/>',
};

export function icon(name: string): string {
  const path = paths[name];
  if (!path) throw new Error(`Unknown icon: ${name}`);

  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}
