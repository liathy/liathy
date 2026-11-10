// The "on my headphones" card: a spinning vinyl with the album art + the latest Last.fm track.
// Runs in the Cloudflare Worker (live) and can also run in Node.
import { C, FONT, esc, trunc, num, sparkle, card } from './theme.mjs';

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
  const note = `<g fill="${C.bg1}"><ellipse cx="${cx - 5}" cy="${cy + 8}" rx="6.5" ry="5" transform="rotate(-20 ${cx - 5} ${cy + 8})"/><rect x="${cx}" y="${cy - 13}" width="2.6" height="21" rx="1"/><path d="M${cx + 1} ${cy - 13} q9 3 9 11 q-3 -5 -9 -5z"/></g>`;
  const center = art
    ? `<image href="${art}" x="${cx - 27}" y="${cy - 27}" width="54" height="54" clip-path="url(#art)" preserveAspectRatio="xMidYMid slice"/>`
    : `<circle cx="${cx}" cy="${cy}" r="27" fill="url(#ls)"/>${note}`;
  // SMIL rotation around an explicit center: no transform-origin quirks between browsers
  const spin = playing
    ? `<animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="6s" repeatCount="indefinite"/>`
    : '';
  const vinyl = `
  <circle cx="${cx}" cy="${cy}" r="60" fill="#0b0918" stroke="${C.border}"/>
  <g>${spin}
    <circle cx="${cx}" cy="${cy}" r="52" fill="none" stroke="#2a2350"/>
    <circle cx="${cx}" cy="${cy}" r="45" fill="none" stroke="#231d45"/>
    <circle cx="${cx}" cy="${cy}" r="38" fill="none" stroke="#2a2350"/>
    <path d="M${cx - 44} ${cy - 22} A50 50 0 0 1 ${cx - 14} ${cy - 47}" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="3" stroke-linecap="round"/>
    ${center}
  </g>
  <circle cx="${cx}" cy="${cy}" r="3" fill="${C.bg1}" stroke="${C.border}"/>`;

  const eq = playing ? [0, 1, 2, 3].map(i =>
    `<rect class="eq" x="${440 + i * 8}" y="22" width="5" height="18" rx="2.5" fill="${i % 2 ? C.sky : C.lilac}" style="animation-delay:${[0, .35, .15, .5][i]}s;animation-duration:${[.9, 1.1, .8, 1][i]}s"/>`).join('') : '';

  let text;
  if (track) {
    const when = playing ? '♪ now playing' : `☾ last played · ${track.date?.uts ? ago(Number(track.date.uts)) : 'recently'}`;
    text = `
  <text class="small in" x="170" y="40" style="fill:${playing ? C.sky : C.muted};font-weight:600">${esc(when)}</text>
  <text class="in" x="170" y="72" style="font:700 19px ${FONT};fill:${C.text};animation-delay:.1s">${esc(trunc(track.name, 28))}</text>
  <text class="in" x="170" y="96" style="font:600 14.5px ${FONT};fill:${C.lilac};animation-delay:.2s">${esc(trunc(track.artist?.['#text'] || track.artist?.name, 34))}</text>
  ${track.album?.['#text'] ? `<text class="small in" x="170" y="117" style="animation-delay:.3s">${esc(trunc(track.album['#text'], 42))}</text>` : ''}`;
  } else {
    text = `
  <text class="small" x="170" y="40" style="fill:${C.muted};font-weight:600">☾ on my headphones</text>
  <text x="170" y="74" style="font:700 18px ${FONT};fill:${C.text}">the stars are quiet right now</text>
  <text class="small" x="170" y="98">come back in a little while ♪</text>`;
  }
  const footer = plays != null ? `<text class="small" x="170" y="156">✧ ${num(plays)} scrobbles on last.fm</text>` : '';

  return card({
    w: 495, h: 180, title: '', seed: 55,
    label: track ? `${playing ? 'Now playing' : 'Last played'}: ${track.name}` : 'Last.fm',
    defs: `<clipPath id="art"><circle cx="${cx}" cy="${cy}" r="27"/></clipPath>`,
    style: `.eq{transform-box:fill-box;transform-origin:bottom;animation:eq 1s ease-in-out infinite alternate}@keyframes eq{0%{transform:scaleY(.25)}100%{transform:scaleY(1)}}`,
    body: vinyl + eq + text + footer + sparkle(470, 150, 5, C.pink, 1),
  });
}
