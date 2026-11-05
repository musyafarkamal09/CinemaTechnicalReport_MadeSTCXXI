// Build tailwind.css dari src/tailwind.input.css. Pakai: `npm i -D tailwindcss@4` lalu `node tools/build-css.mjs`
import { compile } from 'tailwindcss';
import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
const root = path.resolve(import.meta.dirname, '..');
const twDir = path.dirname(createRequire(import.meta.url).resolve('tailwindcss/package.json'));
const input = fs.readFileSync(path.join(root, 'src/tailwind.input.css'), 'utf8');
const c = await compile(input, { base: root, loadStylesheet: async (id, base) => {
  const p = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.resolve(base, id);
  return { path: p, base: path.dirname(p), content: fs.readFileSync(p, 'utf8') }; } });
// kandidat kelas = semua token di html/js (Tailwind membuang yang tidak dikenal)
const files = fs.readdirSync(root).filter(f => /\.(html|js)$/.test(f) && f !== 'sw.js');
const cand = new Set();
for (const f of files) for (const t of fs.readFileSync(path.join(root, f), 'utf8').matchAll(/[^\s"'`<>=(){};,]+/g)) cand.add(t[0]);
fs.writeFileSync(path.join(root, 'tailwind.css'), c.build([...cand]));
console.log('tailwind.css', fs.statSync(path.join(root, 'tailwind.css')).size, 'bytes');
