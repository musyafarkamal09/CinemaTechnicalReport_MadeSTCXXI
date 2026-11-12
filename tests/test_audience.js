/* Tes backend Data Penonton per-show + migrasi. Jalankan: node tests/test_audience.js */
'use strict';
const assert = require('assert');
const { makeEnv } = require('./gas-harness');

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  GAGAL ' + name + '\n      ' + (e && e.message)); } }
const ok = (r) => { assert.ok(r.ok, 'harus ok, dapat: ' + r.message); return r.data; };
const bad = (r, re) => { assert.ok(!r.ok, 'harus gagal'); if (re) assert.ok(re.test(r.message), 'pesan: ' + r.message); };

const env = makeEnv();
['adm:ADMIN:Admin Satu', 'tek:USER:Teknisi A', 'tek2:USER:Teknisi B', 'rep:REPORTER:Pelapor C', 'gs:GUIDE_SECURITY:Guide D'].forEach((s) => { const p = s.split(':'); env.addUser(p[0], p[1], p[2]); });
const tk = {}; ['adm', 'tek', 'tek2', 'rep', 'gs'].forEach((u) => (tk[u] = env.login(u)));
const call = (u, a, p) => env.call(a, Object.assign({ token: tk[u] }, p || {}));
const D = '2026-11-10';
const show = (studio, sh, extra) => Object.assign({ studio, show: sh, film: 'Film ' + studio + sh, jam: '12:00', tiket: 10, penonton: 9 }, extra || {});

console.log('== per-show ==');
t('sheet AUDIENCE_SHOWS dibuat', () => assert.ok(env.sheets.AUDIENCE_SHOWS));
t('semua peran dapat mengisi', () => {
  ['adm', 'tek', 'rep', 'gs'].forEach((u, i) => { const d = ok(call(u, 'aud_save', { date: D, shows: [show('Studio 1', 'SHOW' + (i + 1))] })); assert.equal(d.saved.created, 1); });
});
t('laporan harian: progress, petugas, status', () => {
  const d = ok(call('adm', 'aud_day', { date: D }));
  assert.equal(d.progress.filled, 4); assert.equal(d.progress.total, 20); assert.equal(d.status, 'Belum Terisi');
  assert.deepEqual(d.petugas.sort(), ['Admin Satu', 'Guide D', 'Pelapor C', 'Teknisi A']);
  assert.equal(d.studios[0].shows[0].status, 'Terisi'); assert.equal(d.studios[0].shows[4].status, 'Belum Terisi');
  assert.equal(d.total.tiket, 40); assert.equal(d.total.penonton, 36);
});
t('satu data aktif per key: pengisi kedua ditolak (slot sudah terisi)', () => {
  bad(call('tek2', 'aud_save', { date: D, shows: [show('Studio 1', 'SHOW1', { film: 'Lain' })] }), /baru saja diisi/);
  assert.equal(env.rows('AUDIENCE_SHOWS').filter((r) => r.showKey === D + '|Studio 1|SHOW1').length, 1);
});
t('batch atomik: satu gagal = tidak ada yang tersimpan', () => {
  const before = env.rows('AUDIENCE_SHOWS').length;
  bad(call('tek2', 'aud_save', { date: D, shows: [show('Studio 2', 'SHOW1'), show('Studio 1', 'SHOW1')] }));
  assert.equal(env.rows('AUDIENCE_SHOWS').length, before);
});
t('validasi: film/tiket/penonton wajib, bilangan bulat, studio/show valid, duplikat payload', () => {
  bad(call('tek', 'aud_save', { date: D, shows: [show('Studio 2', 'SHOW1', { film: '' })] }), /wajib/);
  bad(call('tek', 'aud_save', { date: D, shows: [show('Studio 2', 'SHOW1', { tiket: '1.5' })] }), /bilangan bulat/);
  bad(call('tek', 'aud_save', { date: D, shows: [show('Studio 99', 'SHOW1')] }), /tidak valid/);
  bad(call('tek', 'aud_save', { date: D, shows: [show('Studio 2', 'SHOW1'), show('studio 2', 'show1')] }), /lebih dari satu kali/);
  bad(call('tek', 'aud_save', { date: '2035-01-01', shows: [show('Studio 2', 'SHOW1')] }), /Tanggal/);
});
t('berbagi: dua user mengisi studio berbeda, satu user mengisi sisanya hingga Terisi', () => {
  const all = []; for (let s = 1; s <= 4; s++) for (let w = 1; w <= 5; w++) if (!(s === 1 && w <= 4)) all.push(show('Studio ' + s, 'SHOW' + w));
  const d = ok(call('tek2', 'aud_save', { date: D, shows: all }));
  assert.equal(d.saved.created, 16); assert.equal(d.status, 'Terisi'); assert.equal(d.progress.filled, 20);
  assert.ok(d.petugas.indexOf('Teknisi B') >= 0);
  assert.equal(env.rows('AUDIENCE_SHOWS').filter((r) => r.status === 'Aktif').length, 20);
});
t('edit: non-pemilik ditolak, pemilik boleh, Admin boleh, konflik baseAt ditolak', () => {
  const d = ok(call('tek', 'aud_day', { date: D })); const w = d.studios[0].shows[1]; // SHOW2 diisi 'tek'
  assert.equal(w.petugas, 'Teknisi A');
  bad(call('tek2', 'aud_save', { date: D, shows: [show('Studio 1', 'SHOW2', { film: 'X', baseAt: w.baseAt })] }), /sudah diisi oleh/);
  const r1 = ok(call('tek', 'aud_save', { date: D, shows: [show('Studio 1', 'SHOW2', { film: 'Koreksi', baseAt: w.baseAt })] })); assert.equal(r1.saved.updated, 1);
  bad(call('adm', 'aud_save', { date: D, shows: [show('Studio 1', 'SHOW2', { film: 'Basi', baseAt: w.baseAt })] }), /baru saja diubah/);
  const w2 = ok(call('adm', 'aud_day', { date: D })).studios[0].shows[1];
  assert.equal(ok(call('adm', 'aud_save', { date: D, shows: [show('Studio 1', 'SHOW2', { film: 'Admin edit', baseAt: w2.baseAt })] })).saved.updated, 1);
  assert.equal(env.rows('AUDIENCE_SHOWS').filter((r) => r.showKey === D + '|Studio 1|SHOW2').length, 1);
});
t('kirim ulang data identik = tidak berubah', () => {
  const w = ok(call('adm', 'aud_day', { date: D })).studios[0].shows[1];
  const r = ok(call('adm', 'aud_save', { date: D, shows: [Object.assign(show('Studio 1', 'SHOW2', { film: 'Admin edit' }), { baseAt: w.baseAt, petugas: w.petugas })] }));
  assert.equal(r.saved.unchanged, 1);
});
t('batas edit pemilik 30 menit', () => {
  const rows = env.sheets.AUDIENCE_SHOWS.rows, h = rows[0], i = h.indexOf('editDeadline');
  const idx = rows.findIndex((r, k) => k > 0 && r[h.indexOf('showKey')] === D + '|Studio 2|SHOW1'); rows[idx][i] = Date.now() - 1000;
  const w = ok(call('tek2', 'aud_day', { date: D })).studios[1].shows[0];
  assert.equal(w.editable, false);
  bad(call('tek2', 'aud_save', { date: D, shows: [show('Studio 2', 'SHOW1', { film: 'Telat', baseAt: w.baseAt })] }), /sudah diisi oleh/);
});
t('daftar harian: hari ini tampil walau kosong, hari terisi tampil', () => {
  const l = ok(call('rep', 'aud_list', {}));
  assert.ok(l.items.some((x) => x.date === D && x.status === 'Terisi'));
  assert.equal(l.items[0].studios, undefined);
});
t('studio/show tambahan ikut dihitung', () => {
  const d = ok(call('tek', 'aud_save', { date: '2026-11-09', shows: [show('Studio 5', 'SHOW7')] }));
  const s5 = d.studios.find((s) => s.studio === 'Studio 5'); assert.equal(s5.total, 7); assert.equal(d.progress.total, 27); assert.equal(d.progress.filled, 1);
});
t('Admin hapus show -> slot kosong lagi, key bebas', () => {
  ok(call('adm', 'aud_del', { date: '2026-11-09', studio: 'Studio 5', show: 'SHOW7' }));
  const d = ok(call('adm', 'aud_day', { date: '2026-11-09' })); assert.equal(d.progress.filled, 0);
  bad(call('tek', 'aud_del', { date: D, studio: 'Studio 1', show: 'SHOW1' }), /Admin/);
  assert.equal(ok(call('tek2', 'aud_save', { date: '2026-11-09', shows: [show('Studio 5', 'SHOW7')] })).saved.created, 1);
});
t('rep_save audience lama diblokir; aksi admin tertutup bagi peran lain', () => {
  bad(call('tek', 'rep_save', { type: 'audience', data: { date: D } }), /per show/);
  bad(call('rep', 'aud_migrate', {}), /Akses ditolak/); bad(call('gs', 'aud_review_list', {}), /Akses ditolak/);
});
t('dashboard menghitung laporan harian', () => { const d = ok(call('adm', 'dashboard')); assert.ok(d.audience >= 2); });
t('sel tanggal/jam terbaca walau berubah jadi Date oleh Sheets', () => {
  const rows = env.sheets.AUDIENCE_SHOWS.rows, h = rows[0], di = h.indexOf('date'), ji = h.indexOf('jam');
  const bak = [rows[1][di], rows[1][ji]]; const dd = rows[1][di];
  rows[1][di] = new Date(dd + 'T00:00:00+07:00'); rows[1][ji] = new Date(Date.UTC(1899, 11, 30, 5, 0));
  const d = ok(call('adm', 'aud_day', { date: dd })); assert.ok(d.progress.filled > 0);
  rows[1][di] = bak[0]; rows[1][ji] = bak[1];
});

console.log('== migrasi ==');
const env2 = makeEnv();
env2.addUser('adm', 'ADMIN', 'Admin'); env2.addUser('tek', 'USER', 'Teknisi A');
const a2 = env2.login('adm'), c2 = (a, p) => env2.call(a, Object.assign({ token: a2 }, p || {}));
const sh = (s, f, tk2, pn, o) => Object.assign({ show: s, film: f, jam: '10:00', tiket: tk2, penonton: pn, petugas: 'P', ket: '' }, o || {});
let ts = 1760000000000;
const L = (id, data, o) => env2.addLegacy(Object.assign({ id, createdAt: (ts += 60000), data }, o || {}));
L('DP-2026-0001', { date: '2026-11-01', note: 'catatan A', studios: [{ studio: 'Studio 1', shows: [sh('SHOW1', 'Film A', 10, 9), sh('SHOW2', 'Film B', 5, 5)] }, { studio: 'Studio 2', shows: [sh('SHOW1', 'Film C', 7, 7)] }] }, { reporter: 'Budi', userId: 'U-b' });
L('DP-2026-0002', { date: '2026-11-01', studios: [{ studio: 'Studio 1', shows: [sh('SHOW1', 'film a ', 10, 9)] }] }); // duplikat identik
L('DP-2026-0003', { date: '2026-11-02', studios: [{ studio: 'Studio 3', shows: [sh('SHOW1', 'Film X', 4, 4)] }] });
L('DP-2026-0004', { date: '2026-11-02', studios: [{ studio: 'Studio 3', shows: [sh('SHOW1', 'Film Y', 8, 8)] }] }); // konflik
L('DP-2026-0005', { date: 'bukan-tanggal', studios: [{ studio: 'Studio 1', shows: [sh('SHOW1', 'F', 1, 1)] }] });
L('DP-2026-0006', { date: '2026-11-03', studios: [{ studio: 'Studio VIP', shows: [sh('SHOW1', 'F', 1, 1)] }, { studio: 'Studio 1', shows: [sh('SHOWX', 'F', 1, 1), sh('SHOW3', '', 1, 1), sh('SHOW4', 'Film Z', '', '')] }] });
L('DP-2026-0007', { date: '2026-11-04', draft: true, studios: [{ studio: 'Studio 6', shows: [sh('SHOW1', 'Extra', 3, 2), sh('SHOW8', 'Extra2', 3, 2)] }] }, { status: 'Diarsipkan' });
env2.addLegacy({ id: 'DP-2026-0008', createdAt: ts + 1 }); // placeholder, lalu dirusak
env2.sheets.REPORTS.rows[env2.sheets.REPORTS.rows.length - 1][env2.sheets.REPORTS.rows[0].indexOf('data')] = '{rusak';
const snap = JSON.stringify(env2.sheets.REPORTS.rows);

let m1;
t('dry run tidak menulis apa pun', () => {
  const r = ok(c2('aud_migrate', { dryRun: true })); assert.equal(r.dryRun, true);
  assert.equal(env2.rows('AUDIENCE_SHOWS').length, 0); assert.ok(r.itemSumber > 0);
});
t('migrasi: hasil sesuai', () => {
  m1 = ok(c2('aud_migrate', {}));
  const rows = env2.rows('AUDIENCE_SHOWS'), act = rows.filter((r) => r.status === 'Aktif'), rv = rows.filter((r) => r.status === 'Review');
  assert.equal(m1.laporanSumber, 8);
  assert.equal(m1.digabung, 1, 'duplikat identik digabung');
  const keys = act.map((r) => r.showKey).sort();
  assert.deepEqual(keys, ['2026-11-01|Studio 1|SHOW1', '2026-11-01|Studio 1|SHOW2', '2026-11-01|Studio 2|SHOW1', '2026-11-04|Studio 6|SHOW1', '2026-11-04|Studio 6|SHOW8'].sort());
  assert.equal(new Set(keys).size, keys.length, 'key unik');
  assert.equal(act.find((r) => r.showKey === '2026-11-01|Studio 1|SHOW1').sourceRef.split(',').length, 1);
  const a = act.find((r) => r.showKey === '2026-11-01|Studio 1|SHOW1'); assert.equal(a.reporter, 'Budi'); assert.equal(a.catatan, 'catatan A'); assert.equal(a.sourceId, 'DP-2026-0001');
  // review: 2 konflik, tanggal salah, studio VIP, show X, film kosong, tiket kosong, JSON rusak
  assert.equal(rv.length, m1.review); assert.equal(rv.length, 8);
  assert.ok(rv.every((r) => !r.showKey && r.sourceKey && r.review));
  assert.ok(rv.filter((r) => /Konflik/.test(r.review)).length === 2);
  assert.ok(rv.some((r) => /rusak/.test(r.review)));
});
t('sumber (REPORTS) tidak berubah sama sekali', () => assert.equal(JSON.stringify(env2.sheets.REPORTS.rows), snap));
t('migrasi ulang idempoten: tidak ada duplikasi/perubahan', () => {
  const before = JSON.stringify(env2.sheets.AUDIENCE_SHOWS.rows);
  const r = ok(c2('aud_migrate', {}));
  assert.equal(r.dimigrasi + r.digabung + r.review, 0); assert.ok(r.dilewati >= m1.itemSumber - 1);
  assert.equal(JSON.stringify(env2.sheets.AUDIENCE_SHOWS.rows), before);
});
t('data baru dari user + laporan lama bentrok -> review, tidak menimpa', () => {
  ok(env2.call('aud_save', { token: env2.login('tek'), date: '2026-11-05', shows: [{ studio: 'Studio 1', show: 'SHOW1', film: 'Baru', tiket: 1, penonton: 1 }] }));
  L('DP-2026-0009', { date: '2026-11-05', studios: [{ studio: 'Studio 1', shows: [sh('SHOW1', 'Beda', 2, 2), sh('SHOW2', 'Aman', 2, 2)] }] });
  const r = ok(c2('aud_migrate', {})); assert.equal(r.dimigrasi, 1); assert.equal(r.review, 1);
  assert.equal(env2.rows('AUDIENCE_SHOWS').find((x) => x.showKey === '2026-11-05|Studio 1|SHOW1').film, 'Baru');
  const r2 = ok(c2('aud_migrate', {})); assert.equal(r2.dimigrasi + r2.review + r2.digabung, 0);
});
t('review: daftar, koreksi+terapkan, abaikan; hasil muncul di laporan harian', () => {
  const list = ok(c2('aud_review_list', {})); assert.equal(list.length, 9);
  const kx = list.find((r) => r.studio === 'Studio 1' && r.show === 'SHOW3' && r.date === '2026-11-03');
  assert.ok(kx, 'item film kosong');
  const ap = ok(c2('aud_review_save', { sourceKey: kx.sourceKey, fix: { film: 'Dikoreksi' } })); assert.equal(ap.key, '2026-11-03|Studio 1|SHOW3');
  assert.equal(ok(c2('aud_day', { date: '2026-11-03' })).progress.filled, 1);
  bad(c2('aud_review_save', { sourceKey: kx.sourceKey }), /tidak ditemukan/);
  const kc = list.find((r) => /Konflik/.test(r.review) && r.date === '2026-11-02');
  const ap2 = ok(c2('aud_review_save', { sourceKey: kc.sourceKey })); assert.equal(ap2.replaced, false);
  const other = ok(c2('aud_review_list', {})).find((r) => r.date === '2026-11-02');
  ok(c2('aud_review_del', { sourceKey: other.sourceKey }));
  assert.equal(env2.rows('AUDIENCE_SHOWS').filter((r) => r.status === 'Aktif' && r.date === '2026-11-02').length, 1);
  const before = JSON.stringify(env2.sheets.AUDIENCE_SHOWS.rows); ok(c2('aud_migrate', {}));
  assert.equal(JSON.stringify(env2.sheets.AUDIENCE_SHOWS.rows), before, 'migrasi ulang setelah review tetap idempoten');
});
t('migrasi tidak mengubah data legacy meski review selesai', () => {
  assert.equal(JSON.stringify(env2.sheets.REPORTS.rows.slice(0, 9)), JSON.parse(JSON.stringify(snap)) && JSON.stringify(JSON.parse(snap).slice(0, 9)));
});


console.log('== audit: edge case ==');
const env3 = makeEnv(); ['adm:ADMIN:Admin', 'u1:USER:User Satu', 'r1:REPORTER:Pelapor'].forEach((x) => { const p = x.split(':'); env3.addUser(p[0], p[1], p[2]); });
const t3 = { adm: env3.login('adm'), u1: env3.login('u1'), r1: env3.login('r1') };
const c3 = (u, a, p) => env3.call(a, Object.assign({ token: t3[u] }, p || {}));
const base = (o) => Object.assign({ studio: 'Studio 1', show: 'SHOW1', film: 'F', jam: '10:00', tiket: 1, penonton: 1 }, o || {});
t('tanpa token / token palsu ditolak', () => { bad(env3.call('aud_list', {}), /Sesi/); bad(env3.call('aud_list', { token: 'x.1.2' }), /Sesi/); });
t('shows bukan array / kosong / terlalu banyak', () => {
  bad(c3('u1', 'aud_save', { date: D, shows: 'x' }), /Tidak ada show/); bad(c3('u1', 'aud_save', { date: D, shows: [] }), /Tidak ada show/);
  bad(c3('u1', 'aud_save', { date: D, shows: new Array(200).fill(0).map((_, i) => base({ studio: 'Studio ' + (1 + i % 12), show: 'SHOW' + (1 + (i / 12 | 0)) })) }), /Terlalu banyak/);
  bad(c3('u1', 'aud_save', { date: D }), /Tidak ada show/); bad(c3('u1', 'aud_save', { date: D, shows: [null] }), /tidak valid/);
});
t('injeksi rumus & HTML tersimpan sebagai teks, tidak merusak', () => {
  ok(c3('u1', 'aud_save', { date: D, shows: [base({ film: '=HYPERLINK("http://x","y")', ket: '<img src=x onerror=alert(1)>', petugas: '+cmd' })] }));
  const d = ok(c3('u1', 'aud_day', { date: D })).studios[0].shows[0];
  assert.ok(/HYPERLINK/.test(d.film)); assert.ok(/onerror/.test(d.ket));
});
t('angka batas: 0 valid, 7 digit valid, 8 digit / negatif / desimal / huruf ditolak', () => {
  ok(c3('u1', 'aud_save', { date: D, shows: [base({ show: 'SHOW2', tiket: 0, penonton: 0 })] }));
  ok(c3('u1', 'aud_save', { date: D, shows: [base({ show: 'SHOW3', tiket: 9999999, penonton: '0007' })] }));
  ['12345678', '-1', '1.5', 'abc', '1e3'].forEach((v) => bad(c3('u1', 'aud_save', { date: D, shows: [base({ show: 'SHOW4', tiket: v })] }), /bilangan bulat/));
  const d = ok(c3('u1', 'aud_day', { date: D })); assert.equal(d.studios[0].shows[1].tiket, 0); assert.equal(d.studios[0].shows[2].penonton, 7);
  assert.equal(d.progress.filled, 3);
});
t('nilai 0 dihitung Terisi (bukan kosong)', () => assert.equal(ok(c3('u1', 'aud_day', { date: D })).studios[0].shows[1].status, 'Terisi'));
t('jam tidak valid, studio/show variasi huruf & spasi dinormalisasi', () => {
  bad(c3('u1', 'aud_save', { date: D, shows: [base({ show: 'SHOW5', jam: '25:00' })] }), /Jam/);
  const r = ok(c3('u1', 'aud_save', { date: D, shows: [base({ studio: ' studio 02 ', show: 'show 03' })] }));
  assert.ok(r.studios.find((s) => s.studio === 'Studio 2').shows[2].status === 'Terisi');
  bad(c3('u1', 'aud_save', { date: D, shows: [base({ studio: 'Studio 13' })] }), /tidak valid/); bad(c3('u1', 'aud_save', { date: D, shows: [base({ show: 'SHOW16' })] }), /tidak valid/);
});
t('tanggal: format salah, sebelum 2020, masa depan jauh', () => {
  ['2026-13-40', '10/11/2026', '', '2019-12-31', '2099-01-01'].forEach((d) => bad(c3('u1', 'aud_save', { date: d, shows: [base()] }), /Tanggal/));
  bad(c3('u1', 'aud_day', { date: 'xx' }), /Tanggal/); bad(c3('u1', 'aud_range', { from: D, to: '2020-01-01' }), /Rentang/);
});
t('aud_range mengembalikan hari terisi saja, terurut', () => {
  ok(c3('u1', 'aud_save', { date: '2026-11-08', shows: [base()] }));
  const r = ok(c3('u1', 'aud_range', { from: '2026-11-01', to: '2026-11-30' })); assert.deepEqual(r.days.map((x) => x.date), ['2026-11-08', D]);
});
t('legacy audience: tidak bisa diedit lewat rep_get (editable=false)', () => {
  env3.addLegacy({ id: 'DP-2026-0100', data: { date: D, studios: [{ studio: 'Studio 1', shows: [{ show: 'SHOW1', film: 'A', tiket: 1, penonton: 1 }] }] } });
  const r = ok(c3('adm', 'rep_get', { id: 'DP-2026-0100' })); assert.equal(r.editable, false);
});
t('hari kosong hari ini muncul sekali, rentang tanpa hari ini tidak', () => {
  const l = ok(c3('r1', 'aud_list', { from: '2026-11-01', to: '2026-11-09' })); assert.deepEqual(l.items.map((x) => x.date), ['2026-11-08']);
  const m = ok(c3('r1', 'aud_list', { q: 'tidak-ada-xyz' })); assert.equal(m.total, 0);
});
t('pagination: 40 hari -> 3 halaman, tanpa duplikasi antar halaman', () => {
  for (let i = 1; i <= 40; i++) { const dd = new Date(Date.UTC(2026, 9, 1) - i * 864e5).toISOString().slice(0, 10); ok(c3('u1', 'aud_save', { date: dd, shows: [base()] })); }
  const seen = new Set(); let tot = 0; for (let p = 1; p <= 4; p++) { const l = ok(c3('r1', 'aud_list', { page: p })); l.items.forEach((x) => { assert.ok(!seen.has(x.date)); seen.add(x.date); }); tot = l.total; }
  assert.equal(seen.size, tot);
});
t('migrasi: ribuan item tetap cepat & tanpa duplikat key aktif', () => {
  const e4 = makeEnv(); e4.addUser('adm', 'ADMIN', 'A'); const tk4 = e4.login('adm');
  for (let i = 0; i < 300; i++) { const dd = new Date(Date.UTC(2026, 0, 1) + (i % 150) * 864e5).toISOString().slice(0, 10); const sh = []; for (let s = 1; s <= 4; s++) { const rr = []; for (let w = 1; w <= 5; w++) rr.push({ show: 'SHOW' + w, film: 'F' + (i % 2), jam: '10:00', tiket: 5, penonton: 5, petugas: 'P' }); sh.push({ studio: 'Studio ' + s, shows: rr }); } e4.addLegacy({ id: 'DP-2026-' + String(i + 1).padStart(4, '0'), data: { date: dd, studios: sh }, createdAt: 1e12 + i }); }
  const t0 = Date.now(); const r = e4.call('aud_migrate', { token: tk4 }).data; const ms = Date.now() - t0;
  const act = e4.rows('AUDIENCE_SHOWS').filter((x) => x.status === 'Aktif'); assert.equal(new Set(act.map((x) => x.showKey)).size, act.length);
  assert.equal(r.dimigrasi + r.digabung + r.review, 300 * 20, 'semua item tercatat: ' + JSON.stringify(r));
  assert.ok(/Maksimal 93/.test(e4.call('aud_range', { token: tk4, from: '2026-01-01', to: '2026-12-31' }).message), 'batas 93 hari'); const r2 = e4.call('aud_migrate', { token: tk4 }).data; assert.equal(r2.dimigrasi + r2.digabung + r2.review, 0); assert.ok(ms < 20000, ms + 'ms');
});
t('migrasi dengan sel tanggal/jam bertipe Date & angka sebagai string', () => {
  const e5 = makeEnv(); e5.addUser('adm', 'ADMIN', 'A'); const tk5 = e5.login('adm');
  e5.addLegacy({ id: 'DP-2026-0001', data: { date: '2026-11-02', studios: [{ studio: 'studio 1', shows: [{ show: 'show 1', film: 'Z', jam: '09:05', tiket: '12', penonton: '10' }] }] } });
  const r = e5.call('aud_migrate', { token: tk5 }).data; assert.equal(r.dimigrasi, 1);
  const x = e5.rows('AUDIENCE_SHOWS')[0]; assert.equal(x.showKey, '2026-11-02|Studio 1|SHOW1');
});

console.log('\n' + pass + ' lulus, ' + fail + ' gagal');
process.exit(fail ? 1 : 0);
