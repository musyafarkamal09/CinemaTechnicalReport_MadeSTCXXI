# Hasil pengujian NOVA v16

`sh tests/run-all.sh` — keluaran asli:

```
== tests/test_auth.js
HASIL: 10/10 lulus
== tests/test_backend.js
HASIL: 22/22 lulus
== tests/test_cellsafe.js
SEMUA LULUS
== tests/test_dcp_batch.js
HASIL: 9/9 lulus
== tests/test_draft.js
== tests/test_pdfkit.js
HASIL: 6/6 lulus
== tests/test_photoflow.js
HASIL: 47/47 lulus
== tests/test_uniq.js
SEMUA LULUS
== run.js (semua modul) desktop
modul 18 bermasalah 0 error global 0
PASS FT: temuan FAIL masuk laporan
HASIL desktop: 25/25
HASIL desktop: 14/14
== run.js (semua modul) tablet
modul 18 bermasalah 0 error global 0
PASS FT: temuan FAIL masuk laporan
HASIL tablet: 25/25
HASIL tablet: 14/14
== run.js (semua modul) phone
modul 18 bermasalah 0 error global 0
PASS FT: temuan FAIL masuk laporan
HASIL phone: 25/25
HASIL phone: 14/14
== ac-download-sidebar
SEMUA LULUS
== ats-countdown
SEMUA LULUS
== pdf-foto
HASIL: 10/10
```

Tidak tercakup: PDF dengan jsPDF asli (visual), Apps Script live, Figma.
