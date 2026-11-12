// Bulk import parser. Returns [{label, text}]
// Supported: Markdown (## ID + prompt), JSON, CSV (id,prompt), blocks separated by --- / blank lines.
function bpiParse(raw) {
  const t = String(raw || '').replace(/\r\n/g, '\n').replace(/^﻿/, '').trim();
  if (!t) return [];

  // 1) JSON
  if (/^[\[{]/.test(t)) {
    try {
      let j = JSON.parse(t);
      if (!Array.isArray(j)) j = j.prompts || j.items || [];
      return j
        .map((x, i) =>
          typeof x === 'string'
            ? { label: 'P' + (i + 1), text: x }
            : { label: String(x.id || x.name || x.label || 'P' + (i + 1)), text: String(x.prompt || x.text || '') }
        )
        .filter((x) => x.text.trim());
    } catch (e) { /* fall through */ }
  }

  // 2) Markdown: "## ID" headings, everything below = prompt
  if (/^##\s+\S/m.test(t)) {
    const out = [];
    let cur = null;
    for (const line of t.split('\n')) {
      const m = line.match(/^##\s+(.+?)\s*$/);
      if (m) { if (cur) out.push(cur); cur = { label: m[1].trim(), lines: [] }; }
      else if (cur) cur.lines.push(line);
    }
    if (cur) out.push(cur);
    return out
      .map((o) => ({ label: o.label, text: o.lines.join('\n').replace(/^\s*---+\s*$/gm, '').trim() }))
      .filter((o) => o.text);
  }

  // 3) CSV with header id,prompt
  if (/^(id|label|name)\s*[,;\t]\s*(prompt|text)/i.test(t)) {
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (q) {
        if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',' || c === ';' || c === '\t') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    row.push(cell); rows.push(row);
    return rows.slice(1)
      .filter((r) => r[1] && r[1].trim())
      .map((r, i) => ({ label: (r[0] || 'P' + (i + 1)).trim(), text: r.slice(1).join(',').trim() }));
  }

  // 4) Plain blocks: split by --- lines, else blank lines
  const blocks = /^\s*---+\s*$/m.test(t) ? t.split(/^\s*---+\s*$/m) : t.split(/\n\s*\n/);
  return blocks.map((b) => b.trim()).filter(Boolean).map((b, i) => ({ label: 'P' + (i + 1), text: b }));
}
if (typeof module !== 'undefined') module.exports = bpiParse;
