'use strict';
const { PDFDocument, degrees, StandardFonts, rgb } = PDFLib;

/* ---------- helpers ---------- */
const buf = f => f.arrayBuffer();
const load = async f => PDFDocument.load(await buf(f), { ignoreEncryption: true });
const pdfBlob = async doc => new Blob([await doc.save()], { type: 'application/pdf' });
const base = f => f.name.replace(/\.[^.]+$/, '');

// "1-3, 5, 8-" -> [[0,1,2],[4],[7..max-1]]  (0-based groups, one per comma part)
function parseRanges(str, max) {
  const groups = [];
  for (const part of str.split(',').map(s => s.trim()).filter(Boolean)) {
    const m = part.match(/^(\d*)\s*-\s*(\d*)$/) || part.match(/^(\d+)$/);
    if (!m) throw new Error(`Invalid range: "${part}"`);
    let a = +m[1] || 1, b = m[2] === undefined ? a : (+m[2] || max);
    if (a > b) [a, b] = [b, a];
    if (a < 1 || b > max) throw new Error(`Range "${part}" is outside 1–${max}`);
    groups.push(Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i));
  }
  if (!groups.length) throw new Error('Enter at least one page or range');
  return groups;
}

async function imageToPng(file) {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d').drawImage(bmp, 0, 0);
  return new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/png'))).arrayBuffer());
}

/* ---------- tools ---------- */
const TOOLS = [
  {
    id: 'merge', icon: '🧩', name: 'Merge PDF', desc: 'Combine several PDFs into one. Drag order with ↑ ↓.',
    accept: '.pdf', multiple: true, min: 2,
    async run(files) {
      const out = await PDFDocument.create();
      for (const f of files) {
        const src = await load(f);
        (await out.copyPages(src, src.getPageIndices())).forEach(p => out.addPage(p));
      }
      return [{ name: 'merged.pdf', blob: await pdfBlob(out) }];
    }
  },
  {
    id: 'split', icon: '✂️', name: 'Split PDF', desc: 'Split into separate files by page ranges.',
    accept: '.pdf', multiple: false,
    opts: `<label>Ranges (each comma part becomes its own file; leave blank for one file per page)
           <input id="o-ranges" placeholder="e.g. 1-3, 4, 5-"></label>`,
    async run([f], o) {
      const src = await load(f), n = src.getPageCount();
      const groups = o.ranges.trim() ? parseRanges(o.ranges, n) : src.getPageIndices().map(i => [i]);
      const res = [];
      for (const [i, g] of groups.entries()) {
        const d = await PDFDocument.create();
        (await d.copyPages(src, g)).forEach(p => d.addPage(p));
        res.push({ name: `${base(f)}-part${i + 1}.pdf`, blob: await pdfBlob(d) });
      }
      return res;
    }
  },
  {
    id: 'remove', icon: '🗑️', name: 'Remove pages', desc: 'Delete the pages you don\'t want.',
    accept: '.pdf', multiple: false,
    opts: `<label>Pages to remove <input id="o-ranges" placeholder="e.g. 2, 5-7"></label>`,
    async run([f], o) {
      const src = await load(f), n = src.getPageCount();
      const drop = new Set(parseRanges(o.ranges, n).flat());
      if (drop.size >= n) throw new Error('You can\'t remove every page');
      [...drop].sort((a, b) => b - a).forEach(i => src.removePage(i));
      return [{ name: `${base(f)}-edited.pdf`, blob: await pdfBlob(src) }];
    }
  },
  {
    id: 'rotate', icon: '🔄', name: 'Rotate PDF', desc: 'Rotate all pages, or just some.',
    accept: '.pdf', multiple: false,
    opts: `<label>Angle <select id="o-angle"><option value="90">90° clockwise</option>
             <option value="180">180°</option><option value="270">90° counter-clockwise</option></select></label>
           <label>Pages (blank = all) <input id="o-ranges" placeholder="e.g. 1-3"></label>`,
    async run([f], o) {
      const doc = await load(f), n = doc.getPageCount();
      const idx = o.ranges.trim() ? parseRanges(o.ranges, n).flat() : doc.getPageIndices();
      for (const i of idx) {
        const p = doc.getPage(i);
        p.setRotation(degrees((p.getRotation().angle + +o.angle) % 360));
      }
      return [{ name: `${base(f)}-rotated.pdf`, blob: await pdfBlob(doc) }];
    }
  },
  {
    id: 'img2pdf', icon: '🖼️', name: 'Images to PDF', desc: 'Turn JPG, PNG, WebP images into one PDF.',
    accept: 'image/*', multiple: true, min: 1,
    async run(files) {
      const doc = await PDFDocument.create();
      for (const f of files) {
        const isJpg = /jpe?g$/i.test(f.type) || /\.jpe?g$/i.test(f.name);
        const bytes = isJpg ? new Uint8Array(await buf(f)) : await imageToPng(f);
        const img = isJpg ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
        doc.addPage([img.width, img.height]).drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }
      return [{ name: 'images.pdf', blob: await pdfBlob(doc) }];
    }
  },
  {
    id: 'numbers', icon: '🔢', name: 'Page numbers', desc: 'Add page numbers to the bottom of each page.',
    accept: '.pdf', multiple: false,
    opts: `<label>Position <select id="o-pos"><option value="c">Center</option><option value="r">Right</option><option value="l">Left</option></select></label>`,
    async run([f], o) {
      const doc = await load(f), font = await doc.embedFont(StandardFonts.Helvetica);
      const n = doc.getPageCount();
      doc.getPages().forEach((p, i) => {
        const t = `${i + 1} / ${n}`, w = font.widthOfTextAtSize(t, 11), { width } = p.getSize();
        const x = o.pos === 'l' ? 30 : o.pos === 'r' ? width - 30 - w : (width - w) / 2;
        p.drawText(t, { x, y: 20, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
      });
      return [{ name: `${base(f)}-numbered.pdf`, blob: await pdfBlob(doc) }];
    }
  },
];

/* ---------- UI ---------- */
const $ = id => document.getElementById(id);
let tool = null, files = [];

$('grid').innerHTML = TOOLS.map(t =>
  `<a class="card" href="#/${t.id}"><div class="ic">${t.icon}</div><h3>${t.name}</h3><p>${t.desc}</p></a>`).join('');

function route() {
  tool = TOOLS.find(t => '#/' + t.id === location.hash) || null;
  $('home').hidden = !!tool; $('tool').hidden = !tool;
  files = []; $('results').innerHTML = ''; $('status').textContent = '';
  if (!tool) return;
  $('tool-title').textContent = tool.name;
  $('tool-desc').textContent = tool.desc;
  $('opts').innerHTML = tool.opts || '';
  const inp = $('file');
  inp.value = ''; inp.accept = tool.accept; inp.multiple = tool.multiple;
  renderFiles();
}

function renderFiles() {
  const ul = $('files'); ul.innerHTML = '';
  files.forEach((f, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="n"></span>
      ${tool.multiple ? '<button data-a="up" title="Move up">↑</button><button data-a="down" title="Move down">↓</button>' : ''}
      <button data-a="rm" title="Remove">✕</button>`;
    li.querySelector('.n').textContent = f.name;
    li.onclick = e => {
      const a = e.target.dataset.a; if (!a) return;
      if (a === 'rm') files.splice(i, 1);
      else { const j = i + (a === 'up' ? -1 : 1); if (j >= 0 && j < files.length) [files[i], files[j]] = [files[j], files[i]]; }
      renderFiles();
    };
    ul.append(li);
  });
  $('run').disabled = files.length < (tool.min || 1);
}

function addFiles(list) {
  const incoming = [...list];
  files = tool.multiple ? files.concat(incoming) : incoming.slice(0, 1);
  renderFiles();
}

$('file').onchange = e => { addFiles(e.target.files); e.target.value = ''; };
const drop = $('drop');
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));

$('run').onclick = async () => {
  const o = {};
  document.querySelectorAll('#opts [id^="o-"]').forEach(el => o[el.id.slice(2)] = el.value);
  $('run').disabled = true; $('status').textContent = 'Quacking…'; $('results').innerHTML = '';
  try {
    const out = await tool.run(files, o);
    out.forEach(r => {
      const url = URL.createObjectURL(r.blob);
      const li = document.createElement('li');
      li.innerHTML = `<span class="n"></span><a download>Download</a>`;
      li.querySelector('.n').textContent = `${r.name} (${(r.blob.size / 1024).toFixed(0)} KB)`;
      const a = li.querySelector('a'); a.href = url; a.download = r.name;
      $('results').append(li);
    });
    $('status').textContent = 'Done! Quack! 🎉';
  } catch (err) {
    console.error(err);
    $('status').textContent = 'Oops, the duck tripped: ' + (err.message || err);
  } finally {
    $('run').disabled = files.length < (tool.min || 1);
  }
};

const root = document.documentElement, themeBtn = $('theme');
const isDark = () => root.dataset.theme
  ? root.dataset.theme === 'dark'
  : matchMedia('(prefers-color-scheme: dark)').matches;
const paintTheme = () => themeBtn.textContent = isDark() ? '☀️' : '🌙';
themeBtn.onclick = () => {
  const next = isDark() ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) {}
  paintTheme();
};
paintTheme();

addEventListener('hashchange', route);
route();
