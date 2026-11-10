// Draws the profile cards (stats, languages, activity, tech stack, featured project)
// as animated night-sky SVGs in dist/. The Last.fm card is drawn live by worker/.
// Runs in GitHub Actions; needs only Node 20+ (no dependencies).
import { mkdir, writeFile } from 'node:fs/promises';
import { C, PALETTE, FONT, esc, trunc, num, sparkle, BASE_STYLE, card } from './theme.mjs';

const GH_USER = process.env.GH_USER || 'liathy';
const FEATURED = process.env.FEATURED_REPO || 'MusiKPL';
const TOKEN = process.env.GITHUB_TOKEN;
const STACK = (process.env.STACK || 'rust,js,ts,angular,tailwind,flutter').split(',');
const STACK_LABELS = { rust: 'Rust', js: 'JavaScript', ts: 'TypeScript', angular: 'Angular', tailwind: 'Tailwind', flutter: 'Flutter' };
const OUT = 'dist';

async function getJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url.split('?')[0]}`);
  return res.json();
}

async function dataURI(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for image`);
  const type = res.headers.get('content-type') || 'image/png';
  return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
}

// ---------- GitHub ----------
async function github() {
  const query = `query($login:String!,$repo:String!){user(login:$login){
    followers{totalCount}
    pullRequests{totalCount} issues{totalCount}
    repositoriesContributedTo(contributionTypes:[COMMIT,PULL_REQUEST,ISSUE,REPOSITORY]){totalCount}
    repositories(ownerAffiliations:OWNER,privacy:PUBLIC,isFork:false,first:100){totalCount nodes{name stargazerCount
      languages(first:10,orderBy:{field:SIZE,direction:DESC}){edges{size node{name}}}}}
    contributionsCollection{totalCommitContributions restrictedContributionsCount
      contributionCalendar{totalContributions weeks{contributionDays{date contributionCount}}}}
    featured:repository(name:$repo){name description url stargazerCount forkCount latestRelease{tagName}
      languages(first:5,orderBy:{field:SIZE,direction:DESC}){totalSize edges{size node{name}}}}
  }}`;
  const json = await getJSON('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'liathy-profile' },
    body: JSON.stringify({ query, variables: { login: GH_USER, repo: FEATURED } }),
  });
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.user;
}

function streaks(days) {
  let longest = 0, run = 0;
  for (const d of days) { run = d.contributionCount > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
  let i = days.length - 1, current = 0;
  if (i >= 0 && days[i].contributionCount === 0) i--; // today isn't over yet
  for (; i >= 0 && days[i].contributionCount > 0; i--) current++;
  return { current, longest };
}

function statsCard(u, days) {
  const cc = u.contributionsCollection;
  const stars_ = u.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0);
  const { current, longest } = streaks(days);
  const rows = [
    ['★', 'stars earned', stars_],
    ['✎', 'commits (past year)', cc.totalCommitContributions + cc.restrictedContributionsCount],
    ['⇄', 'pull requests', u.pullRequests.totalCount],
    ['◎', 'issues', u.issues.totalCount],
    ['☄', 'contributions (past year)', cc.contributionCalendar.totalContributions],
  ];
  const body = rows.map(([icon, l, v], i) => `
  <g class="in" style="animation-delay:${0.15 * i}s">
    <text x="27" y="${74 + i * 25}" style="font:700 14px ${FONT};fill:${PALETTE[i]}">${icon}</text>
    <text class="lbl" x="48" y="${74 + i * 25}">${esc(l)}</text>
    <text class="val" x="290" y="${74 + i * 25}" text-anchor="end">${num(v)}</text>
  </g>`).join('');
  const pct = Math.max(4, Math.min(100, longest ? (current / longest) * 100 : 0));
  const ring = `
  <circle cx="395" cy="104" r="46" fill="none" stroke="${C.border}" stroke-width="9"/>
  <circle class="ring" cx="395" cy="104" r="46" fill="none" stroke="url(#ls)" stroke-width="9" stroke-linecap="round"
    pathLength="100" stroke-dasharray="${pct.toFixed(1)} 100" transform="rotate(-90 395 104)"/>
  <text x="395" y="110" text-anchor="middle" style="font:800 26px ${FONT};fill:${C.text}">${current}</text>
  <text class="small" x="395" y="127" text-anchor="middle">day streak</text>
  <text class="small" x="395" y="174" text-anchor="middle">longest: ${longest} ☾</text>
  ${sparkle(450, 58, 6, C.sky, 0.4)}${sparkle(340, 150, 4.5, C.pink, 1.6)}`;
  return card({
    w: 495, h: 195, title: '✧ stardust stats', seed: 11, label: `${GH_USER} GitHub stats`,
    style: `.ring{animation:ring 1.6s ease-out both}@keyframes ring{from{stroke-dasharray:0 100}}`,
    body: body + ring,
  });
}

function languagesCard(u) {
  const totals = {};
  for (const r of u.repositories.nodes)
    for (const e of r.languages.edges) totals[e.node.name] = (totals[e.node.name] || 0) + e.size;
  const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  const top = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const barX = 150, barW = 255;
  const body = top.length ? top.map(([name, size], i) => {
    const p = size / sum, y = 70 + i * 26;
    return `
  <g class="in" style="animation-delay:${0.12 * i}s">
    <circle cx="31" cy="${y - 4.5}" r="5" fill="${PALETTE[i]}"/>
    <text class="lbl" x="44" y="${y}" style="fill:${C.text}">${esc(trunc(name, 14))}</text>
    <rect x="${barX}" y="${y - 10}" width="${barW}" height="10" rx="5" fill="${C.border}" opacity=".6"/>
    <rect class="grow" x="${barX}" y="${y - 10}" width="${Math.max(10, p * barW).toFixed(1)}" height="10" rx="5" fill="${PALETTE[i]}" style="animation-delay:${0.12 * i + 0.2}s"/>
    <text class="small" x="470" y="${y}" text-anchor="end">${(p * 100).toFixed(1)}%</text>
  </g>`;
  }).join('') : `<text class="lbl" x="25" y="90">no public code yet ☾</text>`;
  return card({
    w: 495, h: 195, title: '✧ top languages', seed: 22, label: `${GH_USER} top languages`,
    style: `.grow{transform-box:fill-box;transform-origin:left;animation:grow 1.3s cubic-bezier(.2,.8,.2,1) both}@keyframes grow{from{transform:scaleX(0)}}`,
    body: body + sparkle(455, 32, 6, C.pink, 0.8),
  });
}

function smoothPath(pts) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

function activityCard(days) {
  const last = days.slice(-31);
  const w = 900, h = 270, x0 = 55, x1 = 870, y0 = 70, y1 = 220;
  const max = Math.max(4, ...last.map(d => d.contributionCount));
  const top = Math.ceil(max / 4) * 4;
  const X = i => x0 + (i * (x1 - x0)) / (last.length - 1);
  const Y = v => y1 - (v / top) * (y1 - y0);
  const pts = last.map((d, i) => [X(i), Y(d.contributionCount)]);
  const line = smoothPath(pts);
  const area = `${line} L${x1},${y1} L${x0},${y1} Z`;
  const total = last.reduce((s, d) => s + d.contributionCount, 0);
  let grid = '';
  for (let k = 0; k <= 4; k++) {
    const v = (top / 4) * k, y = Y(v);
    grid += `<line x1="${x0}" x2="${x1}" y1="${y}" y2="${y}" stroke="${C.border}" stroke-dasharray="3 6" opacity=".7"/>
    <text class="small" x="${x0 - 12}" y="${y + 4}" text-anchor="end">${v}</text>`;
  }
  const labels = last.map((d, i) => (i % 5 === 0 || i === last.length - 1)
    ? `<text class="small" x="${X(i)}" y="${y1 + 24}" text-anchor="middle">${new Date(d.date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).toLowerCase()}</text>` : '').join('');
  const dots = pts.map(([x, y], i) => last[i].contributionCount
    ? `<circle class="dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" fill="${i % 2 ? C.sky : C.lilac}" style="animation-delay:${(1.2 + i * 0.03).toFixed(2)}s, ${(i * 0.17 % 3).toFixed(2)}s"/>` : '').join('');
  return card({
    w, h, title: '✧ moonlit activity · last 31 days', seed: 33, label: `${GH_USER} contribution graph`,
    defs: `<linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.lilac}" stop-opacity=".45"/><stop offset="1" stop-color="${C.sky}" stop-opacity="0"/></linearGradient>`,
    style: `.draw{stroke-dasharray:1;stroke-dashoffset:1;animation:draw 2.2s ease-out .2s forwards}@keyframes draw{to{stroke-dashoffset:0}}
      .area{animation:fade 1.5s ease-out 1s both}@keyframes fade{from{opacity:0}}
      .dot{opacity:0;animation:pop .4s ease-out forwards, glim 3s ease-in-out infinite}
      @keyframes pop{to{opacity:1}}@keyframes glim{50%{opacity:.45}}`,
    body: `
  <text class="small" x="${x1}" y="38" text-anchor="end">${total} contributions ☾</text>
  ${grid}${labels}
  <path class="area" d="${area}" fill="url(#area)"/>
  <path class="draw" d="${line}" pathLength="1" fill="none" stroke="url(#ls)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  ${dots}`,
  });
}

function wrap(text, max) {
  const lines = [];
  let cur = '';
  for (const word of text.split(/\s+/)) {
    if ((cur + ' ' + word).trim().length > max) { lines.push(cur); cur = word; } else cur = (cur + ' ' + word).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

function projectCard(repo) {
  const desc = repo.description || 'a lightweight music player for Windows, Linux & Android, built with Rust. streams YouTube audio, makes auto mixes, hosts listening jams & scrobbles to Last.fm';
  const lines = wrap(desc, 62).slice(0, 3);
  if (wrap(desc, 62).length > 3) lines[2] = trunc(lines[2], 60) + '…';
  const langs = repo.languages.edges, total = repo.languages.totalSize || 1;
  let x = 25;
  const seg = langs.map((e, i) => {
    const wSeg = (e.size / total) * 445, s = `<rect x="${x.toFixed(1)}" y="128" width="${wSeg.toFixed(1)}" height="8" fill="${PALETTE[i]}"/>`;
    x += wSeg; return s;
  }).join('');
  let lx = 25;
  const legend = langs.slice(0, 3).map((e, i) => {
    const s = `<circle cx="${lx + 4}" cy="157" r="4" fill="${PALETTE[i]}"/><text class="small" x="${lx + 13}" y="161">${esc(e.node.name)}</text>`;
    lx += 22 + e.node.name.length * 7; return s;
  }).join('');
  const tag = repo.latestRelease?.tagName;
  return card({
    w: 495, h: 180, title: '', seed: 44, label: `${repo.name} project card`,
    defs: `<clipPath id="bar"><rect x="25" y="128" width="445" height="8" rx="4"/></clipPath>`,
    style: `.note{font:700 18px ${FONT};animation:note 5s ease-in-out infinite;opacity:0}
      @keyframes note{0%{opacity:0;transform:translate(0,8px)}25%{opacity:1}100%{opacity:0;transform:translate(14px,-30px) rotate(14deg)}}
      .bars{transform-box:fill-box;transform-origin:left;animation:grow 1.4s cubic-bezier(.2,.8,.2,1) .2s both}@keyframes grow{from{transform:scaleX(0)}}`,
    body: `
  <text x="25" y="42" style="font:800 22px ${FONT};fill:url(#ls)">♪ ${esc(repo.name)}</text>
  ${tag ? (tx => `<rect x="${tx}" y="25" width="${tag.length * 8 + 18}" height="22" rx="11" fill="${C.border}"/><text class="small" x="${tx + 9}" y="40" style="fill:${C.sky}">${esc(tag)}</text>`)(25 + (repo.name.length + 2) * 13.5 + 10) : ''}
  <text class="note" x="420" y="50" style="fill:${C.lilac}">♪</text>
  <text class="note" x="446" y="44" style="fill:${C.sky};animation-delay:1.7s">♫</text>
  <text class="note" x="400" y="40" style="fill:${C.pink};animation-delay:3.3s">♪</text>
  ${lines.map((l, i) => `<text class="lbl in" x="25" y="${76 + i * 18}" style="animation-delay:${0.1 * i}s">${esc(l)}</text>`).join('')}
  <g clip-path="url(#bar)"><rect x="25" y="128" width="445" height="8" fill="${C.border}"/><g class="bars">${seg}</g></g>
  ${legend}
  <text class="small" x="470" y="161" text-anchor="end"><tspan style="fill:${C.lilac}">★</tspan> ${repo.stargazerCount}   <tspan style="fill:${C.sky}">⑂</tspan> ${repo.forkCount}</text>`,
  });
}

// ---------- tech stack ----------
async function techCard() {
  const size = 58, gap = 46, w = STACK.length * size + (STACK.length - 1) * gap + 60, h = 112;
  const icons = await Promise.all(STACK.map(id => dataURI(`https://skillicons.dev/icons?i=${encodeURIComponent(id)}`).catch(() => null)));
  const items = STACK.map((id, i) => {
    const x = 30 + i * (size + gap);
    const img = icons[i]
      ? `<image href="${icons[i]}" x="${x}" y="12" width="${size}" height="${size}"/>`
      : `<rect x="${x}" y="12" width="${size}" height="${size}" rx="14" fill="${C.bg2}"/><text x="${x + size / 2}" y="47" text-anchor="middle" class="lbl">${esc(id)}</text>`;
    return `<g class="bob" style="animation-delay:${(i * 0.3).toFixed(1)}s">${img}
      <text x="${x + size / 2}" y="96" text-anchor="middle" style="font:600 12.5px ${FONT};fill:${PALETTE[i % PALETTE.length]}">${esc(STACK_LABELS[id] || id)}</text></g>`;
  }).join('');
  const spk = STACK.slice(1).map((_, i) => sparkle(30 + (i + 1) * (size + gap) - gap / 2, 40 + (i % 2) * 14, 4, i % 2 ? C.sky : C.lilac, i * 0.5)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="tech stack: ${esc(STACK.map(s => STACK_LABELS[s] || s).join(', '))}">
<style>${BASE_STYLE}.bob{animation:bob 3s ease-in-out infinite}@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}</style>
${items}${spk}
</svg>
`;
}

// ---------- main ----------
await mkdir(OUT, { recursive: true });
const jobs = [];
const save = (name, svg) => writeFile(`${OUT}/${name}`, svg).then(() => console.log('wrote', name));
const attempt = (name, fn) => jobs.push(fn().then(svg => save(name, svg)).catch(e => { console.error(`✗ ${name}:`, e.message); process.exitCode = 1; }));

if (TOKEN) {
  const u = await github();
  const days = u.contributionsCollection.contributionCalendar.weeks.flatMap(w => w.contributionDays);
  attempt('stats.svg', async () => statsCard(u, days));
  attempt('languages.svg', async () => languagesCard(u));
  attempt('activity.svg', async () => activityCard(days));
  if (u.featured) attempt('project.svg', async () => projectCard(u.featured));
} else console.warn('GITHUB_TOKEN not set, skipping GitHub cards');
attempt('stack.svg', techCard);
await Promise.all(jobs);
