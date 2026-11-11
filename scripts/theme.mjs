// Shared YoRHa monochrome theme for every card (used by the Action and the Worker).

export const C = {
  bg: '#0A0A0A', panel: '#161616', border: '#3A3A3A', dim: '#5A5A5A',
  muted: '#8C8C8C', soft: '#BDBDBD', text: '#F2F2F2', white: '#FFFFFF',
};
// languages are told apart by shade *and* texture, never by hue
export const FILLS = [C.text, 'url(#p-hatch)', C.muted, 'url(#p-dots)', 'url(#p-cross)', C.dim];
export const FONT = `'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif`;
export const MONO = `'Cascadia Code', 'JetBrains Mono', Consolas, 'Courier New', monospace`;

export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const trunc = (s, n) => (s = String(s ?? ''), s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
export const num = n => (n >= 10000 ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n) : n.toLocaleString('en-US'));

export function rng(seed) { // mulberry32, so particles stay put between redraws
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tiny white flecks drifting upward, like the light/ash particles in the menus. */
export function particles(w, h, count, seed) {
  const r = rng(seed);
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = (r() * w).toFixed(1), y = (r() * h).toFixed(1), s = (1 + r() * 1.8).toFixed(2);
    const diamond = r() < 0.35 ? ` transform="rotate(45 ${x} ${y})"` : '';
    out += `<rect class="pt" x="${x}" y="${y}" width="${s}" height="${s}"${diamond} style="animation-delay:-${(r() * 9).toFixed(2)}s;animation-duration:${(6 + r() * 6).toFixed(2)}s"/>`;
  }
  return out;
}

/** The ◆ marker, drawn so it never depends on fonts. */
export const diamond = (x, y, s = 4, fill = C.text) => `<path d="M${x} ${y - s}L${x + s} ${y}L${x} ${y + s}L${x - s} ${y}Z" fill="${fill}"/>`;

/** NieR menu frame: hairline border + brighter L-shaped corner ticks. */
export function frame(w, h, { x = 0, y = 0, tick = 12, color = C.text, border = C.border } = {}) {
  const x1 = x + 0.5, y1 = y + 0.5, x2 = x + w - 0.5, y2 = y + h - 0.5;
  return `<rect x="${x1}" y="${y1}" width="${w - 1}" height="${h - 1}" fill="none" stroke="${border}"/>
<path d="M${x1} ${y1 + tick}V${y1}H${x1 + tick}M${x2 - tick} ${y1}H${x2}V${y1 + tick}M${x2} ${y2 - tick}V${y2}H${x2 - tick}M${x1 + tick} ${y2}H${x1}V${y2 - tick}" fill="none" stroke="${color}" stroke-width="1.5"/>`;
}

export const PATTERNS = `
  <pattern id="p-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="${C.panel}"/><rect width="2" height="5" fill="${C.text}"/></pattern>
  <pattern id="p-dots" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="${C.panel}"/><rect x="1" y="1" width="2" height="2" fill="${C.soft}"/></pattern>
  <pattern id="p-cross" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${C.panel}"/><path d="M0 0L6 6M6 0L0 6" stroke="${C.muted}" stroke-width="1.2"/></pattern>
  <pattern id="scan" width="4" height="3" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#fff" opacity=".045"/></pattern>  <linearGradient id="ls" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.white}"/><stop offset="1" stop-color="${C.soft}"/></linearGradient>`;

export const BASE_STYLE = `
  .pt{fill:#fff;opacity:0;animation:pt 9s linear infinite}
  @keyframes pt{0%{opacity:0;transform:translateY(0)}15%{opacity:.55}80%{opacity:.25}100%{opacity:0;transform:translateY(-40px)}}
  .title{font:600 13px ${FONT};letter-spacing:3.5px;fill:${C.text}}
  .lbl{font:500 13.5px ${FONT};fill:${C.muted}}
  .val{font:700 14px ${FONT};fill:${C.text}}
  .small{font:500 12px ${FONT};fill:${C.muted}}
  .caps{font:600 10.5px ${FONT};letter-spacing:2.5px;fill:${C.muted}}
  .in{animation:in .7s ease-out both}
  @keyframes in{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}
  .g1,.g2{opacity:0;animation:gl 8s steps(1) infinite}
  .g2{animation-delay:.08s}
  @keyframes gl{0%,91%{opacity:0;transform:none}92%{opacity:1;transform:translateX(4px)}93%{opacity:1;transform:translateX(-3px)}94%{opacity:0;transform:none}96%{opacity:.8;transform:translateX(2px)}97%,100%{opacity:0}}
  .base{animation:bf 8s steps(1) infinite}
  @keyframes bf{0%,91%{opacity:1}92%,93%{opacity:.35}94%,100%{opacity:1}}
`;

/** Glitchy title: a base copy plus two horizontal slices that jump sideways for a split second. */
export function glitchText(id, text, x, y, cls = 'title', extra = '') {
  return `<clipPath id="${id}a"><rect x="0" y="${y - 14}" width="2000" height="5"/></clipPath>
<clipPath id="${id}b"><rect x="0" y="${y - 6}" width="2000" height="4"/></clipPath>
<text class="${cls} base" x="${x}" y="${y}"${extra}>${text}</text>
<text class="${cls} g1" x="${x}" y="${y}" clip-path="url(#${id}a)"${extra}>${text}</text>
<text class="${cls} g2" x="${x}" y="${y}" clip-path="url(#${id}b)"${extra}>${text}</text>`;
}

/** Faint static scanline overlay. */
export const scan = (w, h) => `<rect width="${w}" height="${h}" fill="url(#scan)"/>`;

export function card({ w, h, title, body, defs = '', style = '', seed = 1, label }) {
  const header = title ? `${diamond(29, 33, 4.5)}
${glitchText('t', esc(title.toUpperCase()), 42, 38)}
<line x1="25" y1="52" x2="${w - 25}" y2="52" stroke="${C.border}"/>
<rect x="${w - 29}" y="50" width="4" height="4" fill="${C.text}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label || title)}">
<defs>${PATTERNS}
  <clipPath id="cardclip"><rect width="${w}" height="${h}"/></clipPath>
  ${defs}
</defs>
<style>${BASE_STYLE}${style}</style>
<g clip-path="url(#cardclip)">
  <rect width="${w}" height="${h}" fill="${C.bg}"/>
  ${particles(w, h, Math.round((w * h) / 5000), seed)}
</g>
${header}
${body}
<g clip-path="url(#cardclip)" pointer-events="none">${scan(w, h)}</g>
${frame(w, h)}
</svg>
`;
}
