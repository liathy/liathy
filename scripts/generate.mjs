// Draws the profile cards (stats, languages, activity, tech stack, featured project)
// as animated YoRHa-monochrome SVGs in dist/. The Last.fm card is drawn live by worker/.
// Runs in GitHub Actions; needs only Node 20+ (no dependencies).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { C, FILLS, FONT, esc, trunc, num, diamond, frame, particles, BASE_STYLE, card } from './theme.mjs';

const GH_USER = process.env.GH_USER || 'liathy';
const FEATURED = process.env.FEATURED_REPO || 'MusiKPL';
const TOKEN = process.env.GITHUB_TOKEN;
const STACK = (process.env.STACK || 'rust,js,ts,angular,tailwind,flutter').split(',');
const STACK_LABELS = { rust: 'Rust', js: 'JavaScript', ts: 'TypeScript', angular: 'Angular', tailwind: 'Tailwind', flutter: 'Flutter' };
// simpleicons.org slugs: single-colour logos we can paint white
const STACK_ICONS = { rust: 'rust', js: 'javascript', ts: 'typescript', angular: 'angular', tailwind: 'tailwindcss', flutter: 'flutter' };
const OUT = 'dist';

async function getJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url.split('?')[0]}`);
  return res.json();
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
    ['stars earned', stars_],
    ['commits (past year)', cc.totalCommitContributions + cc.restrictedContributionsCount],
    ['pull requests', u.pullRequests.totalCount],
    ['issues', u.issues.totalCount],
    ['contributions (past year)', cc.contributionCalendar.totalContributions],
  ];
  const body = rows.map(([l, v], i) => {
    const y = 80 + i * 23;
    return `
  <g class="in" style="animation-delay:${0.15 * i}s">
    ${diamond(31, y - 4.5, 3, i === 0 ? C.text : C.muted)}
    <text class="lbl" x="44" y="${y}">${esc(l)}</text>
    <line x1="${50 + l.length * 6.9}" x2="${262 - String(num(v)).length * 8.5}" y1="${y - 4}" y2="${y - 4}" stroke="${C.border}" stroke-dasharray="1 4"/>
    <text class="val" x="290" y="${y}" text-anchor="end">${num(v)}</text>
  </g>`;
  }).join('');
  const pct = Math.max(4, Math.min(100, longest ? (current / longest) * 100 : 0));
  // gauge with tick marks, like the hacking/HUD readouts
  let ticks = '';
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2, r1 = k % 5 ? 56 : 53, r2 = 59;
    ticks += `<line x1="${(395 + Math.sin(a) * r1).toFixed(1)}" y1="${(118 - Math.cos(a) * r1).toFixed(1)}" x2="${(395 + Math.sin(a) * r2).toFixed(1)}" y2="${(118 - Math.cos(a) * r2).toFixed(1)}" stroke="${k % 5 ? C.border : C.muted}"/>`;
  }
  const ring = `
  ${ticks}
  <circle cx="395" cy="118" r="45" fill="none" stroke="${C.panel}" stroke-width="7"/>
  <circle class="ring" cx="395" cy="118" r="45" fill="none" stroke="${C.text}" stroke-width="7"
    pathLength="100" stroke-dasharray="${pct.toFixed(1)} 100" transform="rotate(-90 395 118)"/>
  <g class="spin"><path d="M395 66 l3 -5 h-6z" fill="${C.text}"/></g>
  <text x="395" y="124" text-anchor="middle" style="font:300 30px ${FONT};fill:${C.text}">${current}</text>
  <text class="caps" x="395" y="142" text-anchor="middle" style="font-size:8.5px;letter-spacing:2px">STREAK</text>
  <text class="small" x="395" y="190" text-anchor="middle">longest: ${longest}</text>`;
  return card({
    w: 495, h: 205, title: 'unit status', seed: 11, label: `${GH_USER} GitHub stats`,
    style: `.ring{animation:ring 1.6s ease-out both}@keyframes ring{from{stroke-dasharray:0 100}}
      .spin{transform-box:view-box;transform-origin:395px 118px;animation:spin 14s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`,
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
    const p = size / sum, y = 82 + i * 24;
    return `
  <g class="in" style="animation-delay:${0.12 * i}s">
    <rect x="26" y="${y - 10}" width="10" height="10" fill="${FILLS[i]}" stroke="${C.dim}" stroke-width=".8"/>
    <text class="lbl" x="44" y="${y}" style="fill:${i ? C.soft : C.text}">${esc(trunc(name, 14))}</text>
    <rect x="${barX}" y="${y - 9}" width="${barW}" height="8" fill="${C.panel}" stroke="${C.border}" stroke-width=".8"/>
    <rect class="grow" x="${barX}" y="${y - 9}" width="${Math.max(6, p * barW).toFixed(1)}" height="8" fill="${FILLS[i]}" style="animation-delay:${0.12 * i + 0.2}s"/>
    <text class="small" x="470" y="${y}" text-anchor="end">${(p * 100).toFixed(1)}%</text>
  </g>`;
  }).join('') : `<text class="lbl" x="25" y="95">no public code yet</text>`;
  return card({
    w: 495, h: 205, title: 'language analysis', seed: 22, label: `${GH_USER} top languages`,
    style: `.grow{transform-box:fill-box;transform-origin:left;animation:grow 1.3s cubic-bezier(.2,.8,.2,1) both}@keyframes grow{from{transform:scaleX(0)}}`,
    body,
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
  const w = 900, h = 280, x0 = 55, x1 = 870, y0 = 80, y1 = 230;
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
    grid += `<line x1="${x0}" x2="${x1}" y1="${y}" y2="${y}" stroke="${C.border}" stroke-dasharray="2 6"/>
    <text class="small" x="${x0 - 12}" y="${y + 4}" text-anchor="end">${v}</text>`;
  }
  const labels = last.map((d, i) => (i % 5 === 0 || i === last.length - 1)
    ? `<line x1="${X(i)}" x2="${X(i)}" y1="${y1}" y2="${y1 + 5}" stroke="${C.muted}"/><text class="small" x="${X(i)}" y="${y1 + 22}" text-anchor="middle">${new Date(d.date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).toLowerCase()}</text>` : '').join('');
  const dots = pts.map(([x, y], i) => last[i].contributionCount
    ? `<rect class="dot" x="${(x - 3).toFixed(1)}" y="${(y - 3).toFixed(1)}" width="6" height="6" transform="rotate(45 ${x.toFixed(1)} ${y.toFixed(1)})" fill="${C.bg}" stroke="${C.text}" stroke-width="1.5" style="animation-delay:${(1.2 + i * 0.03).toFixed(2)}s, ${(i * 0.17 % 3).toFixed(2)}s"/>` : '').join('');
  return card({
    w, h, title: 'activity log · last 31 days', seed: 33, label: `${GH_USER} contribution graph`,
    defs: `<linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
    style: `.draw{stroke-dasharray:1;stroke-dashoffset:1;animation:draw 2.2s ease-out .2s forwards}@keyframes draw{to{stroke-dashoffset:0}}
      .area{animation:fade 1.5s ease-out 1s both}@keyframes fade{from{opacity:0}}
      .dot{opacity:0;animation:pop .4s ease-out forwards, glim 3s ease-in-out infinite}
      @keyframes pop{to{opacity:1}}@keyframes glim{50%{opacity:.45}}`,
    body: `
  <text class="caps" x="${x1}" y="38" text-anchor="end">${total} CONTRIBUTIONS</text>
  ${grid}${labels}
  <path class="area" d="${area}" fill="url(#area)"/>
  <path class="draw" d="${line}" pathLength="1" fill="none" stroke="${C.text}" stroke-width="2" stroke-linejoin="round"/>
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
    const wSeg = (e.size / total) * 445, s = `<rect x="${x.toFixed(1)}" y="128" width="${wSeg.toFixed(1)}" height="8" fill="${FILLS[i]}"/>`;
    x += wSeg; return s;
  }).join('');
  let lx = 25;
  const legend = langs.slice(0, 3).map((e, i) => {
    const s = `<rect x="${lx}" y="152" width="9" height="9" fill="${FILLS[i]}" stroke="${C.dim}" stroke-width=".8"/><text class="small" x="${lx + 14}" y="161">${esc(e.node.name)}</text>`;
    lx += 24 + e.node.name.length * 7; return s;
  }).join('');
  const tag = repo.latestRelease?.tagName;
  const tx = 25 + repo.name.length * 13.5 + 14;
  return card({
    w: 495, h: 180, title: '', seed: 44, label: `${repo.name} project card`,
    style: `.note{font:700 18px ${FONT};fill:${C.text};animation:note 5s ease-in-out infinite;opacity:0}
      @keyframes note{0%{opacity:0;transform:translate(0,8px)}25%{opacity:.9}100%{opacity:0;transform:translate(14px,-30px)}}
      .bars{transform-box:fill-box;transform-origin:left;animation:grow 1.4s cubic-bezier(.2,.8,.2,1) .2s both}@keyframes grow{from{transform:scaleX(0)}}`,
    body: `
  <text class="caps" x="25" y="26" style="font-size:9.5px">◆ CURRENT MISSION</text>
  <text x="25" y="52" style="font:300 24px ${FONT};letter-spacing:2px;fill:${C.text}">${esc(repo.name)}</text>
  ${tag ? `<rect x="${tx}" y="35" width="${Math.ceil(tag.length * 6.6) + 14}" height="20" fill="none" stroke="${C.muted}"/><text class="small" x="${tx + 7}" y="49" textLength="${Math.ceil(tag.length * 6.6)}" style="fill:${C.text}">${esc(tag)}</text>` : ''}
  <text class="note" x="420" y="52">♪</text>
  <text class="note" x="446" y="46" style="animation-delay:1.7s;fill:${C.soft}">♫</text>
  <text class="note" x="400" y="42" style="animation-delay:3.3s;fill:${C.muted}">♪</text>
  ${lines.map((l, i) => `<text class="lbl in" x="25" y="${80 + i * 17}" style="animation-delay:${0.1 * i}s">${esc(l)}</text>`).join('')}
  <rect x="25" y="128" width="445" height="8" fill="${C.panel}"/><g class="bars">${seg}</g>
  <rect x="25" y="128" width="445" height="8" fill="none" stroke="${C.border}" stroke-width=".8"/>
  ${legend}
  <text class="small" x="470" y="161" text-anchor="end"><tspan style="fill:${C.text}">★</tspan> ${repo.stargazerCount}   <tspan style="fill:${C.text}">⑂</tspan> ${repo.forkCount}</text>`,
  });
}

// ---------- tech stack ----------
async function techCard() {
  const size = 64, gap = 40, w = STACK.length * size + (STACK.length - 1) * gap + 40, h = 124;
  // icons are vendored in assets/icons (Simple Icons, CC0): the CDN refuses requests from Actions runners
  const icons = await Promise.all(STACK.map(id =>
    readFile(`assets/icons/${STACK_ICONS[id] || id}.svg`, 'utf8')
      .then(svg => [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map(m => m[1]))
      .catch(e => { console.error(`✗ icon ${id}:`, e.message); process.exitCode = 1; return null; })));
  const items = STACK.map((id, i) => {
    const x = 20 + i * (size + gap);
    const inner = icons[i]?.length
      ? `<g transform="translate(${x + 16} 22) scale(${(size - 32) / 24})" fill="${C.text}">${icons[i].map(d => `<path d="${d}"/>`).join('')}</g>`
      : `<text x="${x + size / 2}" y="${44}" text-anchor="middle" class="lbl" style="fill:${C.text}">${esc(id)}</text>`;
    return `<g class="bob" style="animation-delay:${(i * 0.3).toFixed(1)}s">
      <rect x="${x}" y="6" width="${size}" height="${size}" fill="${C.bg}"/>
      ${frame(size, size, { x, y: 6, tick: 9 })}${inner}
      <text class="caps" x="${x + size / 2}" y="98" text-anchor="middle" style="letter-spacing:1.8px">${esc((STACK_LABELS[id] || id).toUpperCase())}</text></g>`;
  }).join('');
  const links = STACK.slice(1).map((_, i) => {
    const x = 20 + (i + 1) * (size + gap) - gap;
    return `<line x1="${x + 6}" x2="${x + gap - 6}" y1="38" y2="38" stroke="${C.border}" stroke-dasharray="2 4"/>${diamond(x + gap / 2, 38, 2.5, C.muted)}`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="tech stack: ${esc(STACK.map(s => STACK_LABELS[s] || s).join(', '))}">
<style>${BASE_STYLE}.bob{animation:bob 3.4s ease-in-out infinite}@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}</style>
${particles(w, h, 14, 66)}${links}${items}
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
