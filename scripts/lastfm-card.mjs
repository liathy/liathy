// The "audio archive" card: a spinning record with the (grayscale, scanlined) album art + the latest Last.fm track.
// Runs in the Cloudflare Worker (live) and can also run in Node.
import { C, FONT, esc, trunc, num, card } from './theme.mjs';

const NO_ART = '2a96cbd8b46e442fc41c2b86b821562f'; // Last.fm's grey star placeholder

function ago(uts) {
  const s = Math.max(0, Date.now() / 1000 - uts);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) { const h = Math.round(s / 3600); return `${h} hour${h > 1 ? 's' : ''} ago`; }
  const d = Math.round(s / 86400); return `${d} day${d > 1 ? 's' : ''} ago`;
}

async function getJSON(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'liathy-profile-card' } });
  if (!res.ok) throw new Error(`Last.fm ${res.status}`);
  return res.json();
}

/** toDataURI(url) -> "data:image/...;base64,..." (differs between Node and Workers) */
export async function lastfmCard({ key, user, toDataURI }) {
  let track = null, playing = false, plays = null, art = null;
  if (key) {
    const base = `https://ws.audioscrobbler.com/2.0/?api_key=${encodeURIComponent(key)}&user=${encodeURIComponent(user)}&format=json`;
    const [recent, info] = await Promise.all([
      getJSON(`${base}&method=user.getrecenttracks&limit=1`),
      getJSON(`${base}&method=user.getinfo`).catch(() => null),
    ]);
    track = [].concat(recent?.recenttracks?.track || [])[0] || null;
    playing = track?.['@attr']?.nowplaying === 'true';
    plays = info?.user?.playcount ? Number(info.user.playcount) : null;
    const imgs = track?.image || [];
    const img = (imgs.find(i => i.size === 'large') || imgs.at(-1))?.['#text'];
    if (img && !img.includes(NO_ART)) art = await toDataURI(img).catch(() => null);
  }

  const cx = 88, cy = 90;
  // drawn music note, so it never depends on the viewer's fonts
  const note = `<g fill="${C.bg}"><ellipse cx="${cx - 5}" cy="${cy + 8}" rx="6.5" ry="5" transform="rotate(-20 ${cx - 5} ${cy + 8})"/><rect x="${cx}" y="${cy - 13}" width="2.6" height="21"/><path d="M${cx + 1} ${cy - 13} q9 3 9 11 q-3 -5 -9 -5z"/></g>`;
  const center = art
    ? `<image href="${art}" x="${cx - 27}" y="${cy - 27}" width="54" height="54" clip-path="url(#art)" preserveAspectRatio="xMidYMid slice" filter="url(#mono)"/>
    <circle cx="${cx}" cy="${cy}" r="27" fill="url(#artscan)"/>`
    : `<circle cx="${cx}" cy="${cy}" r="27" fill="${C.text}"/>${note}`;
  // SMIL rotation around an explicit center: no transform-origin quirks between browsers
  const spin = playing
    ? `<animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="6s" repeatCount="indefinite"/>`
    : '';
  let ticks = '';
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2, r1 = k % 4 ? 64 : 61;
    ticks += `<line x1="${(cx + Math.sin(a) * r1).toFixed(1)}" y1="${(cy - Math.cos(a) * r1).toFixed(1)}" x2="${(cx + Math.sin(a) * 67).toFixed(1)}" y2="${(cy - Math.cos(a) * 67).toFixed(1)}" stroke="${k % 4 ? C.border : C.muted}"/>`;
  }
  const vinyl = `
  ${ticks}
  <circle cx="${cx}" cy="${cy}" r="58" fill="#050505" stroke="${C.border}"/>
  <g>${spin}
    <circle cx="${cx}" cy="${cy}" r="51" fill="none" stroke="#202020"/>
    <circle cx="${cx}" cy="${cy}" r="44" fill="none" stroke="#1a1a1a"/>
    <circle cx="${cx}" cy="${cy}" r="37" fill="none" stroke="#202020"/>
    <path d="M${cx - 43} ${cy - 21} A48 48 0 0 1 ${cx - 13} ${cy - 46}" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="3"/>
    ${center}
  </g>
  <circle cx="${cx}" cy="${cy}" r="3" fill="${C.bg}" stroke="${C.muted}"/>`;

  const eq = playing ? [0, 1, 2, 3].map(i =>
    `<rect class="eq" x="${440 + i * 8}" y="22" width="5" height="18" fill="${i % 2 ? C.muted : C.text}" style="animation-delay:${[0, .35, .15, .5][i]}s;animation-duration:${[.9, 1.1, .8, 1][i]}s"/>`).join('') : '';

  let text;
  if (track) {
    const when = playing ? '◆ NOW PLAYING' : `◇ LAST PLAYED · ${(track.date?.uts ? ago(Number(track.date.uts)) : 'recently').toUpperCase()}`;
    text = `
  <text class="caps in" x="172" y="38" style="fill:${playing ? C.text : C.muted}">${esc(when)}</text>
  <text class="in" x="172" y="70" style="font:600 19px ${FONT};fill:${C.text};animation-delay:.1s">${esc(trunc(track.name, 28))}</text>
  <text class="in" x="172" y="94" style="font:500 14.5px ${FONT};fill:${C.soft};animation-delay:.2s">${esc(trunc(track.artist?.['#text'] || track.artist?.name, 34))}</text>
  ${track.album?.['#text'] ? `<text class="small in" x="172" y="115" style="animation-delay:.3s">${esc(trunc(track.album['#text'], 42))}</text>` : ''}`;
  } else {
    text = `
  <text class="caps" x="172" y="38">◇ AUDIO ARCHIVE</text>
  <text x="172" y="72" style="font:600 18px ${FONT};fill:${C.text}">no signal right now</text>
  <text class="small" x="172" y="96">standing by… check back soon ♪</text>`;
  }
  const footer = plays != null ? `<line x1="172" x2="470" y1="136" y2="136" stroke="${C.border}"/><text class="small" x="172" y="157">${num(plays)} scrobbles on last.fm</text>` : '';

  return card({
    w: 495, h: 180, title: '', seed: 55,
    label: track ? `${playing ? 'Now playing' : 'Last played'}: ${track.name}` : 'Last.fm',
    defs: `<pattern id="artscan" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="1" fill="#000" opacity=".4"/></pattern>
  <clipPath id="art"><circle cx="${cx}" cy="${cy}" r="27"/></clipPath>
  <filter id="mono" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="1.1" intercept="-.03"/><feFuncG type="linear" slope="1.1" intercept="-.03"/><feFuncB type="linear" slope="1.1" intercept="-.03"/></feComponentTransfer></filter>`,
    style: `.eq{transform-box:fill-box;transform-origin:bottom;animation:eq 1s ease-in-out infinite alternate}@keyframes eq{0%{transform:scaleY(.25)}100%{transform:scaleY(1)}}`,
    body: vinyl + eq + text + footer,
  });
}
