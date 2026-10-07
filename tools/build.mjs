// 把上游 HowToLiveBetter 的 book/*.md 解析成 book.json，供 index.html 读取。
// 用法：node tools/build.mjs <上游克隆目录> <输出文件>
// 解析规则照抄上游 index.html 的公开规则（条目字段、成本标签、性价比档）。
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const [up = 'upstream', out = 'book.json'] = process.argv.slice(2);
const COST_W = { money: {'0':0,'少':1,'多':2}, time: {'少':0,'中':1,'多':2}, will: {'否':0,'些':1,'是':2} };
const KEY = {'钱':'money','时间':'time','毅力':'will','收益':'level','口径':'lens'};
const files = readdirSync(join(up,'book')).filter(f=>f.endsWith('.md')).sort();
const sections = [];
for (const f of files) {
  const lines = readFileSync(join(up,'book',f),'utf8').replace(/\r\n/g,'\n').split('\n').map(l=>l.trimEnd());
  const m = /^# (\d+)\. (.+)$/.exec(lines.find(l=>l.startsWith('# ')) || '');
  if (!m) throw new Error(`${f} 没有「# N. 标题」`);
  const sec = { n:+m[1], title:m[2].trim(), file:f, intro:[], entries:[] };
  let e = null;
  for (const line of lines) {
    let mm;
    if ((mm=/^### (\d+)\. (.+)$/.exec(line))) { e={ n:+mm[1], title:mm[2].trim(), cost:'',human:'',gain:'',grade:'',src:'',note:'' }; sec.entries.push(e); continue; }
    if (!e) { if (line && !line.startsWith('#') && !line.startsWith('[←')) sec.intro.push(line); continue; }
    if ((mm=/^<!--\s*成本标签:\s*(.*?)\s*-->/.exec(line))) { for (const kv of mm[1].split(/\s+/)) { const [k,v]=kv.split('='); if (KEY[k]) e[KEY[k]]=v; } continue; }
    if ((mm=/^- 成本：(.*)$/.exec(line))) e.cost=mm[1];
    else if ((mm=/^- 说人话：(.*)$/.exec(line))) e.human=mm[1];
    else if ((mm=/^- 收益：(.*)$/.exec(line))) e.gain=mm[1];
    else if ((mm=/^- 证据等级：\s*([ABC])/.exec(line))) e.grade=mm[1];
    else if ((mm=/^- 来源：(.*)$/.exec(line))) e.src=mm[1];
    else if ((mm=/^- 备注：(.*)$/.exec(line))) e.note=mm[1];
  }
  for (const e of sec.entries) {
    e.dispute = /^争议/.test(e.note);
    e.cs = (COST_W.money[e.money]??0)+(COST_W.time[e.time]??0)+(COST_W.will[e.will]??0);
    e.ratio = e.level==='大' ? (e.cs===0?'极高':(e.cs<=2?'高':'一般')) : e.level==='中' ? (e.cs===0?'高':'一般') : '一般';
  }
  sections.push(sec);
}
const all = sections.flatMap(s=>s.entries);
// 长文：按 README 里出现的顺序取 docs/*.md（跳过目录和引用对照）
const readme = readFileSync(join(up,'README.md'),'utf8').replace(/\r\n/g,'\n');
const docFiles = [...new Set([...readme.matchAll(/\]\((docs\/[^)#/]+\.md)\)/g)].map(m=>m[1]))].filter(p=>!/引用对照/.test(p));
const docs = docFiles.map((p,i)=>{
  const md = readFileSync(join(up,p),'utf8').replace(/\r\n/g,'\n').replace(/^\[← 回总目录\]\([^)]*\)\s*\n/,'');
  const t = /^# (.*)$/m.exec(md);
  return { n:i+1, file:p.replace(/^docs\//,''), title: t?t[1]:p, md };
});
const docsOut = out.replace(/book\.json$/,'docs.json');
// 保护：任何一道不过就整体不写，网站停在上一版。上游真的大删时用 ALLOW_SHRINK=1 人工放行。
const fails = [];
if (existsSync(out)) {
  const prev = JSON.parse(readFileSync(out,'utf8'));
  const prevN = prev.meta?.count ?? 0;
  if (prevN && all.length < prevN*0.95) fails.push(`条数从 ${prevN} 掉到 ${all.length}`);
  for (const ps of prev.sections||[]) {
    const pn = ps.entries.length, cn = sections.find(s=>s.n===ps.n)?.entries.length ?? 0;
    if (pn && (cn===0 || cn < pn/2)) fails.push(`第 ${ps.n} 节从 ${pn} 条掉到 ${cn}`);
  }
}
const prevDocs = existsSync(docsOut) ? JSON.parse(readFileSync(docsOut,'utf8')).length : 0;
if (!docs.length || docs.length < prevDocs) fails.push(`长文从 ${prevDocs} 篇掉到 ${docs.length}`);
const bad = all.filter(e=>!e.human||!e.grade||!e.level||!e.lens||!(e.money in COST_W.money)||!(e.time in COST_W.time)||!(e.will in COST_W.will));
if (bad.length > all.length*0.02) fails.push(`${bad.length} 条缺字段（说人话/证据等级/收益/口径/钱/时间/毅力）`);
if (fails.length) {
  if (process.env.ALLOW_SHRINK==='1') console.warn('ALLOW_SHRINK=1 人工放行：'+fails.join('；'));
  else { console.error(fails.join('；')+'，疑似解析失败，拒绝覆盖'); process.exit(1); }
}
let sha='', date='';
try { sha=execSync('git rev-parse --short HEAD',{cwd:up}).toString().trim(); date=execSync('git log -1 --format=%cd --date=short',{cwd:up}).toString().trim(); } catch {}
// 简介：README 顶部 H1 之后、徽章之前的几段；标语取 og 图的 alt
const readmeTop = readFileSync(join(up,'README.md'),'utf8').replace(/\r\n/g,'\n');
const topBlock = (readmeTop.split('# 高性价比人生指南')[1] || '').split('[![')[0];
const paras = topBlock.split(/\n\s*\n/).map(x=>x.replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'').replace(/\*\*/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').trim()).filter(Boolean);
const tagline = (/alt="高性价比人生指南\s*[—-]+\s*([^"]+)"/.exec(readmeTop) || [,''])[1].trim();
const descLines = (paras[0] || '').split('\n').map(x=>x.trim()).filter(Boolean);
const description = descLines[0] || '';
const descNote = descLines.slice(1).join(' ');
const howto = paras.find(x=>x.startsWith('不用全做')) || '';
const meta = { sha, date, count: all.length, sections: sections.length, tagline, description, descNote, howto,
  grade: Object.fromEntries(['A','B','C'].map(g=>[g, all.filter(e=>e.grade===g).length])),
  ratio: Object.fromEntries(['极高','高','一般'].map(r=>[r, all.filter(e=>e.ratio===r).length])) };
writeFileSync(out, JSON.stringify({ meta, sections }));
writeFileSync(docsOut, JSON.stringify(docs));
// 拆分：data/index.json 只放首屏要用的字段（标题、说人话、标签），data/sNN.json 放各节的详情（成本、收益、来源、备注），按需加载
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
const dataDir = join(dirname(out), 'data'); mkdirSync(dataDir, { recursive: true });
const light = sections.map(s => ({ n:s.n, title:s.title, intro:s.intro, entries: s.entries.map(e => ({ n:e.n, title:e.title, human:e.human, grade:e.grade, level:e.level, lens:e.lens, money:e.money, time:e.time, will:e.will, ratio:e.ratio, dispute:e.dispute, nsrc:(e.src.match(/https?:\/\//g)||[]).length })) }));
writeFileSync(join(dataDir,'index.json'), JSON.stringify({ meta, sections: light }));
for (const s of sections) writeFileSync(join(dataDir, `s${s.n}.json`), JSON.stringify({ n:s.n, entries: s.entries.map(e => ({ n:e.n, cost:e.cost, gain:e.gain, src:e.src, note:e.note })) }));
console.log('data/index.json', JSON.stringify({ meta, sections: light }).length, 'B; sections', sections.length);
console.log('docs', docs.length, docs.map(d=>d.title).join(' / '));

console.log(JSON.stringify(meta));
