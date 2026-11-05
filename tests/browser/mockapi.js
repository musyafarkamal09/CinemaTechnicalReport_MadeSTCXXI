// Mock backend untuk uji browser. Data contoh hanya untuk pengujian layout, tidak disimpan ke mana pun.
const ts = s => Date.parse(s + ':00+07:00');
const SVG = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#3b2a5c"/><text x="300" y="450" font-size="60" fill="#fff" text-anchor="middle">POSTER</text></svg>').toString('base64');
const user = { userId: 'U1', name: 'Musyafar Kamal', fullName: 'Musyafar Kamal', username: 'admin', role: 'ADMIN', mustChange: false, photo: false };
const films = [
  { id: 'F1', title: 'LAGI PROBATION: KERJA NGEJAR APA SIH?', genre: 'Drama, Comedy', duration: '1 Jam 30 Menit', rating: 'Remaja 13+', status: 'ATS Open', atsAt: ts('2026-10-30T00:00'), showAt: ts('2026-11-12T15:15'), poster: 'P1', posterUrl: SVG },
  { id: 'F3', title: 'SUDAH LEWAT TAYANG', genre: 'Drama', duration: '1 Jam', rating: 'Semua', status: 'ATS Open', atsAt: ts('2026-10-01T00:00'), showAt: ts('2026-11-01T10:00'), poster: 'P3', posterUrl: SVG },
  { id: 'F5', title: 'HITUNG MUNDUR 4 DETIK', genre: 'Komedi', duration: '1 Jam', rating: 'Remaja 13+', status: 'ATS Open', atsAt: ts('2026-10-01T00:00'), showAt: Date.now() + 4000, poster: 'P5', posterUrl: SVG },
  { id: 'F2', title: 'DEWI SILUMAN ULAR', genre: 'Horor', duration: '1 Jam 34 Menit', rating: 'Dewasa 17+', status: 'ATS Open', atsAt: ts('2026-10-30T00:00'), showAt: ts('2026-11-12T14:50'), poster: 'P2', posterUrl: SVG },
];
const handlers = {
  login: () => ({ token: 't', user }),
  me: () => user,
  dashboard: () => ({ work: 12, meter: 5, purchase: 3, issue: 2, issueOpen: 1, recent: [], announcements: [] }),
  ats_list: () => films,
  img: () => ({ url: SVG, mime: 'image/svg+xml', data: SVG }),
  rep_list: () => ({ items: [], total: 0, page: 1, pages: 1 }),
  notif_poll: () => ({ items: [], count: 0, version: 'x' }),
  gloss_list: () => [],
  ann_list: () => [],
  audit: () => ({ items: [], total: 0 }),
  usr_list: () => [user],
  meter_prev: () => ({ locations: [], count: 0, cum: 0 }),
  meter_stats: () => ({ rows: [], total: 0, series: [], locations: [] }),
  ac_cfg_get: () => ({ min: 23, max: 23.5, def: { min: 23, max: 23.5 } }),
  dcp_list: () => [], dcp_dash: () => ({ totalKeluar: 0, totalMasuk: 0, belumKembali: 0, dalamProses: 0, bermasalah: 0, overdue: [], terbaru: [], batasHari: 7 }),
  ft_list: () => [], ft_dash: () => ({ hariIni: 0, passed: 0, failed: 0, retest: 0, belumDites: [], perluTindakan: [], terbaru: [] }),
  pel_list: () => [], perm_me: () => ({ perms: ['view','create','edit','delete','verify','photo','pdf'] }),
  store_list: () => [], dcp_meta: () => ({ komponen: [], komponenStatus: [], formatDcp: [], statusDcp: [], formatFt: [], checklist: [], checklistItem: [], status: [] }),
};
async function install(page) {
  await page.route('https://script.google.com/**', async route => {
    const req = route.request();
    if (req.method() !== 'POST') return route.fulfill({ status: 200, contentType: 'text/plain', body: 'STC XXI API aktif' });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (e) {}
    const h = handlers[body.action];
    const data = h ? h(body) : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data, now: Date.now() }) });
  });
}
module.exports = { install, user, films, handlers };
