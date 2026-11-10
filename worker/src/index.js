// Cloudflare Worker: draws the Last.fm "on my headphones" card on every request,
// so the profile always shows the current song.
import { lastfmCard } from '../../scripts/lastfm-card.mjs';

async function toDataURI(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image ${res.status}`);
  const type = res.headers.get('content-type') || 'image/jpeg';
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(bin)}`;
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname !== '/' && pathname !== '/nowplaying.svg') return new Response('not found', { status: 404 });

    let svg;
    try {
      svg = await lastfmCard({ key: env.LASTFM_API_KEY, user: env.LASTFM_USER, toDataURI });
    } catch (e) {
      console.error(e);
      svg = await lastfmCard({ key: null, user: env.LASTFM_USER, toDataURI }); // friendly placeholder
    }
    return new Response(svg, {
      headers: {
        'content-type': 'image/svg+xml; charset=utf-8',
        // tell GitHub's image proxy not to keep old copies
        'cache-control': 'no-cache, no-store, max-age=0, must-revalidate',
        expires: '0',
      },
    });
  },
};
