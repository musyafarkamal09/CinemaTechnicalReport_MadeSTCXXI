/* Tes backend integrasi DCP Management + Pelaporan DCP. Jalankan: node tests/test_dcp.js */
'use strict';
const assert = require('assert');
const { makeEnv } = require('./gas-harness');
let pass = 0, fail = 0;
function t(n, f) { try { f(); pass++; console.log('  ok  ' + n); } catch (e) { fail++; console.log('  GAGAL ' + n + '\n      ' + (e && e.message)); } }
const ok = (r) => { assert.ok(r.ok, 'harus ok, dapat: ' + r.message); return r.data; };
const bad = (r, re) => { assert.ok(!r.ok, 'harus gagal'); if (re) assert.ok(re.test(r.message), 'pesan: ' + r.message); };
const env = makeEnv();
['adm:ADMIN:Admin', 'tek:USER:Teknisi A', 'tek2:USER:Teknisi B'].forEach((s) => { const p = s.split(':'); env.addUser(p[0], p[1], p[2]); });
const tk = {}; ['adm', 'tek', 'tek2'].forEach((u) => (tk[u] = env.login(u)));
const call = (u, a, p) => env.call(a, Object.assign({ token: tk[u] }, p || {}));
const kel = [{ name: 'HDD', status: 'Lengkap' }, { name: 'USB', status: 'Lengkap' }];
const pelMasuk = (kd) => ({ jenis: 'MASUK', kodeDisk: kd, film: 'Film ' + kd, ph: 'PH X', asalDari: 'XPDC', namaPengirim: 'Budi', jenisDcp: 'Kecil', kelengkapan: kel });
let pid, lid;
t('Teknisi membuat laporan Pelaporan (PEL)', () => { pid = ok(call('tek', 'pel_save', pelMasuk('D-01'))); assert.ok(/^DCP-IN-/.test(pid)); });
t('Management (Admin) melihat baris PEL dengan data lengkap', () => {
  const r = ok(call('adm', 'dcp_list', {})).filter((x) => x.id === pid)[0];
  assert.equal(r.modul, 'PEL'); assert.equal(r.jenisDcp, 'Kecil'); assert.equal(r.asalDari, 'XPDC'); assert.equal(r.namaPengirim, 'Budi');
});
t('Teknisi tidak boleh membuka DCP Management', () => { bad(call('tek', 'dcp_list', {}), /Admin/); bad(call('tek', 'dcp_del', { id: pid }), /Admin/); });
t('Admin ubah baris PEL lewat dcp_save: aturan Pelaporan dipakai, modul tetap PEL, tidak ada baris ganda', () => {
  const before = env.rows('DCP_TRANSAKSI').length;
  ok(call('adm', 'dcp_save', Object.assign(pelMasuk('D-01'), { id: pid, keterangan: 'revisi admin' })));
  const rows = env.rows('DCP_TRANSAKSI'); assert.equal(rows.length, before);
  const r = rows.filter((x) => x.id === pid)[0]; assert.equal(r.modul, 'PEL'); assert.equal(r.keterangan, 'revisi admin'); assert.equal(r.createdByUserId, 'U-tek');
});
t('Teknisi lain tidak boleh mengubah laporan milik Teknisi A', () => { bad(call('tek2', 'pel_save', Object.assign(pelMasuk('D-01'), { id: pid })), /pembuat|Admin/); });
t('Teknisi lain tidak boleh menambah foto ke laporan milik Teknisi A (server)', () => { bad(call('tek2', 'dcp_photo_save', { id: pid, photos: [{ b64: 'AAAA', kind: 'x' }] }), /pembuat|Admin/); });
t('Admin ubah laporan tervalidasi tanpa batal validasi', () => {
  const sh = env.sheets.DCP_TRANSAKSI, h = sh.rows[0], i = h.indexOf('verifiedAt'), row = sh.rows.findIndex((r) => r[0] === pid);
  sh.rows[row][i] = Date.now(); sh.rows[row][h.indexOf('verifiedBy')] = 'X';
  bad(call('tek', 'pel_save', Object.assign(pelMasuk('D-01'), { id: pid })), /tervalidasi/);
  ok(call('adm', 'pel_save', Object.assign(pelMasuk('D-01'), { id: pid, keterangan: 'admin lagi' })));
});
t('Admin menambah data DCP Management (legacy), lalu mengubahnya lewat pel_save', () => {
  lid = ok(call('adm', 'dcp_save', { jenis: 'KELUAR', tanggal: '2026-11-10', jam: '10:00', film: 'F', kodeDisk: 'L-1', ph: 'P', format: '2D', penyerah: 'a', penerima: 'b', tujuan: 'c', status: 'Diproses', kelengkapan: [{ name: 'HDD', status: 'Lengkap' }, { name: 'USB', status: 'Lengkap' }, { name: 'Kabel Power', status: 'Lengkap' }, { name: 'Adaptor', status: 'Lengkap' }] }));
  ok(call('adm', 'pel_save', { id: lid, jenis: 'KELUAR', keterangan: 'via pel', film: 'F', kodeDisk: 'L-1', ph: 'P', status: 'Diproses', tanggal: '2026-11-10', jam: '10:00', penyerah: 'a', penerima: 'b', tujuan: 'c', format: '2D', kelengkapan: [{ name: 'HDD', status: 'Lengkap' }, { name: 'USB', status: 'Lengkap' }, { name: 'Kabel Power', status: 'Lengkap' }, { name: 'Adaptor', status: 'Lengkap' }] }));
  const r = env.rows('DCP_TRANSAKSI').filter((x) => x.id === lid)[0]; assert.equal(r.keterangan, 'via pel'); assert.ok(r.modul !== 'PEL');
});
t('Teknisi tidak dapat mengubah baris Management', () => { bad(call('tek', 'pel_save', { id: lid, jenis: 'KELUAR', kodeDisk: 'L-1' }), /Admin/); });
t('Admin hapus laporan tervalidasi; Teknisi tidak bisa', () => {
  bad(call('tek', 'dcp_del', { id: pid }), /Admin/);
  ok(call('adm', 'dcp_del', { id: pid })); assert.ok(!env.rows('DCP_TRANSAKSI').some((x) => x.id === pid));
});
t('Hapus KELUAR tertaut: MASUK tetap ada, tautan dilepas', () => {
  const k = ok(call('adm', 'dcp_save', { jenis: 'KELUAR', tanggal: '2026-11-11', jam: '10:00', film: 'G', kodeDisk: 'L-2', ph: 'P', penyerah: 'a', penerima: 'b', tujuan: 'c', status: 'Diproses', kelengkapan: ['HDD', 'USB', 'Kabel Power', 'Adaptor'].map((n) => ({ name: n, status: 'Lengkap' })) }));
  const m = ok(call('adm', 'dcp_save', { jenis: 'MASUK', relasiId: k, tanggal: '2026-11-12', jam: '10:00', film: 'G', kodeDisk: 'L-2', ph: 'P', penyerah: 'a', penerima: 'b', tujuan: 'c', status: 'Selesai', kelengkapan: ['HDD', 'USB', 'Kabel Power', 'Adaptor'].map((n) => ({ name: n, status: 'Lengkap' })) }));
  ok(call('adm', 'dcp_del', { id: k }));
  const r = env.rows('DCP_TRANSAKSI').filter((x) => x.id === m)[0]; assert.ok(r); assert.equal(String(r.relasiId || ''), '');
});
console.log('\n' + pass + ' lulus, ' + fail + ' gagal'); process.exit(fail ? 1 : 0);
