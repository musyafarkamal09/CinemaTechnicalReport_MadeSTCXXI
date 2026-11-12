/* Mock Google Apps Script minimal (spreadsheet dalam memori) untuk menjalankan backend/Code.gs di Node.
   Dipakai tes Data Penonton: node tests/test_audience.js */
'use strict';
const fs = require('fs'), vm = require('vm'), crypto = require('crypto'), path = require('path');

function makeEnv(opts) {
  opts = opts || {};
  const props = {}, cache = {};
  const sheets = {}; // name -> {rows: [[...]], fmt}
  function Sheet(name) {
    const s = { name, rows: [] };
    s.getName = () => name;
    s.getLastRow = () => s.rows.length;
    s.getLastColumn = () => s.rows.reduce((m, r) => Math.max(m, r.length), 0);
    s.getMaxRows = () => Math.max(s.rows.length, 1000);
    s.getDataRange = () => ({ getValues: () => s.rows.map(r => r.slice()) });
    s.appendRow = (a) => { s.rows.push(a.slice()); return s; };
    s.insertRowsAfter = () => s;
    s.deleteRow = (n) => { s.rows.splice(n - 1, 1); };
    s.setFrozenRows = () => s; s.setColumnWidth = () => s;
    s.getRange = (r, c, nr, nc) => {
      nr = nr || 1; nc = nc || 1;
      const g = {
        getValues: () => { const o = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { const v = (s.rows[r - 1 + i] || [])[c - 1 + j]; row.push(v === undefined ? '' : v); } o.push(row); } return o; },
        setValues: (vs) => { for (let i = 0; i < nr; i++) { while (s.rows.length < r + i) s.rows.push([]); const row = s.rows[r - 1 + i]; for (let j = 0; j < nc; j++) row[c - 1 + j] = vs[i][j]; } return g; },
        setValue: (v) => g.setValues([[v]]),
      };
      ['setNumberFormat', 'setFontWeight', 'setBackground', 'setFontColor', 'setWrap'].forEach(k => g[k] = () => g);
      return g;
    };
    return s;
  }
  const ss = {
    getId: () => 'SS1',
    getSheetByName: (n) => sheets[n] || null,
    insertSheet: (n) => (sheets[n] = Sheet(n)),
    getSheets: () => Object.values(sheets),
  };
  const sandbox = {
    console, Date, Math, JSON, Object, Array, String, Number, isFinite, isNaN, parseInt, parseFloat, RegExp, Error,
    Logger: { log: (m) => { if (opts.verbose) console.log('[LOG]', m); } },
    SpreadsheetApp: { openById: () => ss, getActiveSpreadsheet: () => ss },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (k in props ? props[k] : null),
      setProperty: (k, v) => { props[k] = String(v); },
      setProperties: (o) => Object.assign(props, o) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: (k) => { delete cache[k]; } }) },
    ContentService: { createTextOutput: (t) => ({ t, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create() {} }) }) }) }), deleteTrigger() {} },
    DriveApp: {},
    Utilities: {
      Charset: { UTF_8: 'utf8' }, DigestAlgorithm: { SHA_256: 'sha256' },
      getUuid: () => crypto.randomUUID(),
      computeDigest: (a, s) => Array.from(crypto.createHash('sha256').update(s).digest()).map(b => (b > 127 ? b - 256 : b)),
      computeHmacSha256Signature: (m, k) => Array.from(crypto.createHmac('sha256', k).update(m).digest()).map(b => (b > 127 ? b - 256 : b)),
      formatDate: (d, tz, f) => {
        const t = new Date(d.getTime() + 7 * 3600000), p = (n, l) => String(n).padStart(l || 2, '0');
        const M = { yyyy: t.getUTCFullYear(), MM: p(t.getUTCMonth() + 1), dd: p(t.getUTCDate()), HH: p(t.getUTCHours()), mm: p(t.getUTCMinutes()), ss: p(t.getUTCSeconds()) };
        return f.replace(/yyyy|MM|dd|HH|mm|ss/g, (x) => M[x]);
      },
    },
  };
  const ctx = vm.createContext(sandbox);
  ['Code.gs', 'dcp.gs'].forEach((f) => {
    const p = path.join(__dirname, '..', 'backend', f);
    vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f });
  });
  // setup awal: lembar + akun
  props.SHEET_ID = 'SS1';
  // setupAwal memakai Drive; ditiru di sini: semua lembar lama sudah ada (skema 16), AUDIENCE_SHOWS dibuat oleh ensureSchema_ saat permintaan pertama (simulasi upgrade)
  vm.runInContext(`Object.keys(SH).forEach(function(n){if(n==='AUDIENCE_SHOWS')return;var s=ss_().insertSheet(n);s.appendRow(SH[n]);});
    Object.keys(PHS).forEach(function(t){ss_().insertSheet(PHS[t]);});`, ctx);
  props.SCHEMA = '16';
  props.ARCH_DAY = ctx.Utilities.formatDate(new Date(), 'x', 'yyyyMMdd');
  const env = { ctx, sheets, props };
  env.call = (action, params) => {
    const out = JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(Object.assign({ action }, params || {})) } }).t);
    return out;
  };
  env.addUser = (username, role, name) => {
    const salt = 'salt-' + username, now = Date.now();
    vm.runInContext(`add_('USERS',{userId:'U-${username}',fullName:${JSON.stringify(name || username)},username:'${username}',role:'${role}',status:'Aktif',salt:'${salt}',hash:hash_('pw1234','${salt}'),mustChange:'N',createdAt:${now},updatedAt:${now}})`, ctx);
  };
  env.login = (username) => { const r = env.call('login', { username, password: 'pw1234' }); if (!r.ok) throw new Error(r.message); return r.data.token; };
  env.rows = (n) => { const s = sheets[n]; const h = s.rows[0]; return s.rows.slice(1).map(r => Object.fromEntries(h.map((k, i) => [k, r[i]]))); };
  env.addLegacy = (o) => {
    const now = o.createdAt || Date.now();
    ctx.__o = Object.assign({ type: 'audience', status: 'Aktif', userId: 'U-x', reporter: 'X', createdAt: now, updatedAt: now, editDeadline: now + 1800000 }, o, { data: JSON.stringify(o.data) });
    vm.runInContext("add_('REPORTS',__o)", ctx);
  };
  return env;
}
module.exports = { makeEnv };
