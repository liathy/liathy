// Shared night-sky theme for every card (used by the Action and the Worker).

export const C = {
  bg1: '#130f27', bg2: '#251c4e', border: '#3d3374', text: '#F3EEFF', muted: '#A99BC9',
  lilac: '#C9A7EB', sky: '#9ED2F6', pink: '#F5B8DA',
};
export const PALETTE = ['#C9A7EB', '#9ED2F6', '#F5B8DA', '#B8F2E6', '#FFE5A5', '#A0A6F5'];
export const FONT = `'Segoe UI', Ubuntu, 'Helvetica Neue', Arial, sans-serif`;

export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const trunc = (s, n) => (s = String(s ?? ''), s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
export const num = n => (n >= 10000 ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n) : n.toLocaleString('en-US'));

function rng(seed) { // mulberry32, so stars stay put between redraws
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stars(w, h, count, seed) {
  const r = rng(seed);
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = (r() * w).toFixed(1), y = (r() * h).toFixed(1), rad = (0.6 + r() * 1.1).toFixed(2);
    out += `<circle class="tw" cx="${x}" cy="${y}" r="${rad}" style="animation-delay:${(r() * 3).toFixed(2)}s;animation-duration:${(2.2 + r() * 2.5).toFixed(2)}s"/>`;
  }
  return out;
}

export const sparkle = (x, y, s, fill, delay = 0) =>
  `<path class="spk" fill="${fill}" style="animation-delay:${delay}s" d="M${x} ${y - s} L${x + s * 0.28} ${y - s * 0.28} L${x + s} ${y} L${x + s * 0.28} ${y + s * 0.28} L${x} ${y + s} L${x - s * 0.28} ${y + s * 0.28} L${x - s} ${y} L${x - s * 0.28} ${y - s * 0.28}Z"/>`;

export const BASE_STYLE = `
  .tw{fill:#fff;animation:tw 3s ease-in-out infinite}
  @keyframes tw{0%,100%{opacity:.12}50%{opacity:.9}}
  .spk{transform-box:fill-box;transform-origin:center;animation:spk 3.5s ease-in-out infinite}
  @keyframes spk{0%,100%{opacity:.3;transform:scale(.6) rotate(0)}50%{opacity:1;transform:scale(1) rotate(45deg)}}
  .title{font:700 17px ${FONT};fill:${C.lilac}}
  .lbl{font:500 13.5px ${FONT};fill:${C.muted}}
  .val{font:700 14px ${FONT};fill:${C.text}}
  .small{font:500 12px ${FONT};fill:${C.muted}}
  .in{animation:in .7s ease-out both}
  @keyframes in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
`;

export function card({ w, h, title, body, defs = '', style = '', seed = 1, label }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label || title)}">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.bg1}"/><stop offset="1" stop-color="${C.bg2}"/></linearGradient>
  <linearGradient id="ls" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.lilac}"/><stop offset="1" stop-color="${C.sky}"/></linearGradient>
  <clipPath id="cardclip"><rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="18"/></clipPath>
  ${defs}
</defs>
<style>${BASE_STYLE}${style}</style>
<g clip-path="url(#cardclip)">
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  ${stars(w, h, Math.round((w * h) / 4500), seed)}
</g>
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="18" fill="none" stroke="${C.border}"/>
${title ? `<text class="title" x="25" y="38">${esc(title)}</text>` : ''}
${body}
</svg>
`;
}
