// Draws the static YoRHa artwork in assets/ (banner, typing line, profile card, footer).
// Run once after changing it: node scripts/assets.mjs
// assets/2b.gif is pixel art with its flat background keyed out; it gets embedded into assets/2b.svg.
import { readFile, writeFile } from 'node:fs/promises';
import { C, FONT, MONO, esc, diamond, frame, particles, PATTERNS, BASE_STYLE, glitchText, scan, card } from './theme.mjs';

const svg = (w, h, label, body, style = '', defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}>
<defs>${PATTERNS}${defs}</defs>
<style>${BASE_STYLE}${style}</style>
${body}
</svg>
`;

// ---------- banner: title screen ----------
function banner() {
  const w = 1200, h = 300;
  let ruler = '';
  for (let x = 40; x <= 1160; x += 20) {
    const major = (x - 40) % 100 === 0;
    ruler += `<line x1="${x}" x2="${x}" y1="262" y2="${major ? 252 : 257}" stroke="${major ? C.muted : C.border}"/>`;
  }
  return svg(w, h, 'Annie ◆ liathy', `
<rect width="${w}" height="${h}" fill="${C.bg}"/>
<rect width="${w}" height="${h}" fill="url(#vig)"/>
<g class="rot"><circle cx="600" cy="150" r="128" fill="none" stroke="${C.panel}" stroke-width="1.5"/>
<circle cx="600" cy="150" r="112" fill="none" stroke="#1f1f1f" stroke-dasharray="2 7"/></g>
${particles(w, h, 70, 7)}

<g class="hud">
  <text class="caps" x="40" y="44">YORHA // UNIT ANNIE</text>
  <line x1="40" x2="240" y1="54" y2="54" stroke="${C.border}"/>
  <text class="caps" x="1160" y="44" text-anchor="end">STATUS: ONLINE</text>
  <rect class="blink" x="1146" y="50" width="14" height="4" fill="${C.text}"/>
  <text class="caps" x="40" y="242" style="font-size:9px">SYS.VER 2026.11</text>
  <text class="caps" x="1160" y="242" text-anchor="end" style="font-size:9px">RUST · WEB · MOBILE</text>
</g>

<g class="title-in">
  ${glitchText('n', 'ANNIE', 615, 160, 'name', ' text-anchor="middle"')}
  <line class="rule" x1="420" x2="545" y1="196" y2="196" stroke="${C.muted}"/>
  <line class="rule" x1="655" x2="780" y1="196" y2="196" stroke="${C.muted}"/>
  ${diamond(414, 196, 3, C.text)}${diamond(786, 196, 3, C.text)}
  <text class="sub" x="605" y="201" text-anchor="middle">liathy</text>
</g>

<line x1="40" x2="1160" y1="262" y2="262" stroke="${C.border}"/>
${ruler}
<path class="mark" d="M40 266l5 7h-10z" fill="${C.text}"/>
${scan(w, h)}
${frame(w, h, { tick: 22 })}`,
  `.name{font:200 84px ${FONT};letter-spacing:30px;fill:${C.text}}
  .sub{font:400 17px ${FONT};letter-spacing:10px;fill:${C.soft}}
  .title-in{animation:tin 2.8s ease-out both}
  @keyframes tin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  .hud{animation:tin 1.5s ease-out 1.2s both}
  .rule{animation:fade 2s ease-out 1s both}@keyframes fade{from{opacity:0}}
  .blink{animation:bl 1.2s steps(1) infinite}@keyframes bl{50%{opacity:0}}
  .rot{transform-box:view-box;transform-origin:600px 150px;animation:rot 90s linear infinite}@keyframes rot{to{transform:rotate(360deg)}}
  .mark{animation:mk 9s ease-in-out infinite alternate}@keyframes mk{to{transform:translateX(1120px)}}`,
  `<radialGradient id="vig" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`);
}

// ---------- typing: system boot ----------
function typing() {
  const w = 760, h = 50, cw = 12, lines = ['> yorha unit ANNIE // boot complete', '> modules loaded: rust · web · mobile', '> current mission: MusiKPL'];
  const TYPE = 0.07, DEL = 0.03, HOLD = 2.2, GAP = 0.45;
  const spans = lines.map(l => ({ l, start: 0, type: (l.length - 2) * TYPE, del: (l.length - 2) * DEL }));
  let t = 0;
  for (const s of spans) { s.start = t; t += s.type + HOLD + s.del + GAP; }
  const dur = t;
  const kt = v => (v / dur).toFixed(5);
  let out = '';
  spans.forEach(({ l, start }, i) => {
    const x0 = (w - l.length * cw) / 2;
    const keys = [], widths = [];
    const push = (time, n) => { keys.push(kt(time)); widths.push(n); };
    if (start > 0) push(0, 0);
    for (let n = 2; n <= l.length; n++) push(start + (n - 2) * TYPE, n);
    const delStart = start + (l.length - 2) * TYPE + HOLD;
    for (let n = l.length - 1; n >= 2; n--) push(delStart + (l.length - 1 - n) * DEL, n);
    push(delStart + (l.length - 2) * DEL, 0);
    keys[0] = '0.00000';
    keys.push('1.00000'); widths.push(0);
    const kts = keys.join(';');
    const wv = widths.map(n => (n * cw).toFixed(1)).join(';');
    const xv = widths.map(n => (x0 + n * cw + 2).toFixed(1)).join(';');
    const ov = widths.map(n => (n ? 1 : 0)).join(';');
    const anim = (attr, values) => `<animate attributeName="${attr}" calcMode="discrete" dur="${dur.toFixed(2)}s" repeatCount="indefinite" keyTimes="${kts}" values="${values}"/>`;
    out += `<clipPath id="c${i}"><rect x="${x0}" y="0" height="${h}" width="0">${anim('width', wv)}</rect></clipPath>
  <text x="${x0}" y="32" clip-path="url(#c${i})" textLength="${l.length * cw}" lengthAdjust="spacingAndGlyphs"><tspan style="fill:${C.muted}">&gt;</tspan>${esc(l.slice(1))}</text>
  <rect class="cur" y="14" width="${cw - 1}" height="23" x="${x0}" opacity="0">${anim('x', xv)}${anim('opacity', ov)}</rect>\n  `;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(lines.map(l => l.slice(2)).join(' / '))}">
  <style>
    text{font:500 20px ${MONO};fill:${C.text}}
    .cur{fill:${C.text};animation:bl 1s steps(1) infinite}
    @keyframes bl{50%{fill-opacity:0}}
  </style>
  ${out}
</svg>
`;
}

// ---------- 2B: the pixel-art gif (background keyed out) standing in the YoRHa scene ----------
// 360x400 so that at 39% width it matches the profile card (545x400) at 59%.
async function unit2b() {
  const w = 360, h = 400, ground = 344;
  const bytes = await readFile('assets/2b.gif'); // smoke removed, transparent
  const gif = `data:image/gif;base64,${bytes.toString('base64')}`;
  const gh = 292, gw = gh * bytes.readUInt16LE(6) / bytes.readUInt16LE(8); // GIF header: width, height
  let ruins = '';
  const blocks = [[6, 240, 26], [36, 212, 34], [74, 262, 22], [264, 254, 26], [294, 204, 36], [334, 236, 22]];
  for (const [x, y, bw] of blocks) {
    const bh = ground - y;
    ruins += `<path d="M${x} ${ground}V${y + 6}l${bw * 0.35} -6l${bw * 0.2} 9l${bw * 0.45} -4V${ground}Z" fill="#121212" stroke="#262626"/>`;
    for (let wy = y + 14; wy < y + bh - 12; wy += 13)
      for (let wx = x + 5; wx < x + bw - 6; wx += 9)
        if ((wx * 7 + wy * 3) % 5 > 1) ruins += `<rect x="${wx}" y="${wy}" width="4" height="6" fill="#1d1d1d"/>`;
  }
  return svg(w, h, 'pixel art of 2B with her swords, standing in a ruined city', `
<rect width="${w}" height="${h}" fill="${C.bg}"/>
<rect width="${w}" height="${h}" fill="url(#glow)"/>
<g class="rot">
  <circle cx="180" cy="180" r="132" fill="none" stroke="#1d1d1d" stroke-width="1.2"/>
  <circle cx="180" cy="180" r="114" fill="none" stroke="#262626" stroke-dasharray="2 8"/>
  <path d="M180 48v10M180 302v10M48 180h10M302 180h10" stroke="#3a3a3a"/>
</g>
${ruins}
<rect y="280" width="${w}" height="120" fill="url(#fog)"/>
<line x1="0" x2="${w}" y1="${ground + 0.5}" y2="${ground + 0.5}" stroke="${C.border}"/>
${particles(w, h, 34, 2)}
<image href="${gif}" x="${(180 - gw / 2).toFixed(1)}" y="${ground - gh}" width="${gw.toFixed(1)}" height="${gh}" filter="url(#outline)"/>
<g>
  ${diamond(22, 27, 3.5)}
  <text class="caps" x="32" y="31" style="font-size:9.5px">UNIT DATA</text>
  <text class="caps" x="${w - 18}" y="31" text-anchor="end" style="font-size:9.5px;fill:${C.text}">2B</text>
  <line x1="18" x2="${w - 18}" y1="40" y2="40" stroke="${C.border}"/>
  <text class="caps" x="18" y="388" style="font-size:8.5px;letter-spacing:2px">YORHA No.2 TYPE B</text>
  <rect class="blink" x="${w - 30}" y="382" width="12" height="4" fill="${C.text}"/>
</g>
${scan(w, h)}
${frame(w, h, { tick: 16 })}`,
  `.rot{transform-box:view-box;transform-origin:180px 180px;animation:rot 80s linear infinite}@keyframes rot{to{transform:rotate(360deg)}}
  .blink{animation:bl 1.2s steps(1) infinite}@keyframes bl{50%{opacity:0}}`,
  `<radialGradient id="glow" cx=".5" cy=".45" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset=".6" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <linearGradient id="fog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1a1a" stop-opacity="0"/><stop offset="1" stop-color="#1a1a1a"/></linearGradient>
  <filter id="outline" x="-10%" y="-5%" width="120%" height="110%">
    <feMorphology in="SourceAlpha" operator="dilate" radius="1" result="grown"/>
    <feGaussianBlur in="grown" stdDeviation="1.2" result="soft"/>
    <feFlood flood-color="#000" flood-opacity=".6"/>
    <feComposite in2="soft" operator="in" result="shadow"/>
    <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>`);
}

// ---------- unit profile: the about-me bullets as a character data screen ----------
// Sized 545x400 so that at 59% width it matches the 2B gif (1280x1422) at 39% width.
function profile() {
  const b = s => `<tspan style="font-weight:700;fill:${C.white}">${s}</tspan>`;
  const entries = [
    ['current mission', [`building ${b('MusiKPL')}, a cozy music player for Windows,`, 'Linux &amp; Android, written in Rust']],
    ['capabilities', ['it finds new music for you, makes auto mixes, hosts', 'listening jams with friends &amp; scrobbles to Last.fm']],
    ['research', [`currently exploring ${b('Angular')}, ${b('Tailwind')} &amp; ${b('Flutter')}`]],
    ['fun fact', ['my music player knows my taste better than i do']],
  ];
  let y = 160, rows = ''; // last entry's text lands at y≈363 of 400
  entries.forEach(([label, lines], i) => {
    rows += `<g class="in" style="animation-delay:${0.35 + i * 0.18}s">
  ${diamond(30, y - 4, 3, i ? C.muted : C.text)}
  <text class="caps" x="42" y="${y}">${label.toUpperCase()}</text>
  ${lines.map((l, k) => `<text class="lbl" x="42" y="${y + 19 + k * 17}" style="fill:${C.soft}">${l}</text>`).join('')}
</g>`;
    y += 19 + lines.length * 17 + 14;
  });
  return card({
    w: 545, h: 400, title: 'unit profile', seed: 77,
    label: "hi, i'm annie, a dev who codes best after dark. building MusiKPL, a cozy music player for Windows, Linux & Android, written in Rust. it finds new music for you, makes auto mixes, hosts listening jams with friends & scrobbles to Last.fm. currently exploring Angular, Tailwind & Flutter. fun fact: my music player knows my taste better than i do",
    style: `.blink{animation:bl 1.2s steps(1) infinite}@keyframes bl{50%{opacity:0}}`,
    body: `
<g class="in" style="animation-delay:.1s">
  <text x="27" y="98" style="font:200 34px ${FONT};letter-spacing:9px;fill:${C.text}">ANNIE</text>
  <text class="small" x="29" y="121">a dev who codes best after dark</text>
  <text class="caps" x="518" y="98" text-anchor="end" style="font-size:9.5px">STATUS</text>
  <text class="caps" x="518" y="118" text-anchor="end" style="fill:${C.text}">ONLINE</text>
  <rect class="blink" x="452" y="110" width="8" height="8" fill="${C.text}"/>
</g>
<line x1="25" x2="520" y1="136" y2="136" stroke="${C.border}" stroke-dasharray="2 4"/>
${rows}`,
  });
}

// ---------- footer: Ending E nod ----------
function footer() {
  const w = 1200, h = 90;
  let ticks = '';
  for (let x = 0; x <= w; x += 40) ticks += `<line x1="${x}" x2="${x}" y1="14" y2="${x % 200 ? 18 : 22}" stroke="${x % 200 ? C.border : C.muted}"/>`;
  return svg(w, h, 'everything that lives is designed to end.', `
<rect width="${w}" height="${h}" fill="${C.bg}"/>
${particles(w, h, 26, 9)}
<line x1="0" x2="${w}" y1="14" y2="14" stroke="${C.border}"/>${ticks}
<g class="q">
  ${diamond(380, 50, 3, C.muted)}${diamond(842, 50, 3, C.muted)}
  ${glitchText('q', 'everything that lives is designed to end.', 600, 56, 'quote', ' text-anchor="middle"')}
</g>
${scan(w, h)}
${frame(w, h, { tick: 16 })}`,
  `.quote{font:300 19px ${FONT};letter-spacing:3px;fill:${C.text}}
  .q{animation:q 12s ease-in-out infinite}
  @keyframes q{0%,72%{opacity:1}84%,90%{opacity:0}100%{opacity:1}}`);
}

// ---------- divider between README sections ----------
function divider() {
  const w = 1200, h = 28, y = 14;
  let ticks = '';
  for (let x = 20; x <= w - 20; x += 40) if (Math.abs(x - 600) > 40) ticks += `<line x1="${x}" x2="${x}" y1="${y}" y2="${y + ((x - 20) % 200 ? 4 : 7)}" stroke="${(x - 20) % 200 ? C.border : C.muted}"/>`;
  return svg(w, h, '', `
<line x1="20" x2="575" y1="${y + 0.5}" y2="${y + 0.5}" stroke="${C.border}"/>
<line x1="625" x2="${w - 20}" y1="${y + 0.5}" y2="${y + 0.5}" stroke="${C.border}"/>
${ticks}
<rect x="16" y="${y - 2}" width="5" height="5" fill="${C.text}"/><rect x="${w - 21}" y="${y - 2}" width="5" height="5" fill="${C.text}"/>
<g class="pulse">${diamond(600, y + 0.5, 6, C.text)}</g>
${diamond(584, y + 0.5, 2.5, C.muted)}${diamond(616, y + 0.5, 2.5, C.muted)}`,
  `.pulse{animation:pu 3s ease-in-out infinite}@keyframes pu{50%{opacity:.35}}`);
}

await writeFile('assets/banner.svg', banner());
await writeFile('assets/typing.svg', typing());
await writeFile('assets/profile.svg', profile());
await writeFile('assets/2b.svg', await unit2b());
await writeFile('assets/footer.svg', footer());
await writeFile('assets/divider.svg', divider());
console.log('wrote banner, typing, profile, 2b, footer, divider');
