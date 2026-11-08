#!/bin/sh
# Jalankan seluruh pengujian NOVA v16. Butuh: node, Playwright (global), dan server statis di :8765
#   cd nova && python3 -m http.server 8765 &   lalu:  sh tests/run-all.sh
cd "$(dirname "$0")/.." || exit 1
for t in tests/test_*.js; do echo "== $t"; node "$t" | grep -E 'FAIL|HASIL|SEMUA'; done
for W in desktop tablet phone; do
  echo "== run.js (semua modul) $W"; node tests/browser/run.js $W | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);let b=0;for(const[k,v]of Object.entries(j.modules))if(v.overflowPx>0||v.pageErrors.length){b++;console.log('BAD',k)}console.log('modul',Object.keys(j.modules).length,'bermasalah',b,'error global',j.globalErrors.length)})"
  node tests/browser/v14.js $W | grep -E 'FAIL|HASIL'
  node tests/browser/v16.js $W | grep -E 'FAIL|HASIL'
  node tests/browser/audience.js $W | grep -E 'FAIL|HASIL'
  node tests/browser/audience-draft.js $W | grep -E "FAIL|HASIL"
  node tests/browser/ft-dok.js $W | grep -E "FAIL|LULUS|GAGAL"
  node tests/browser/ft-laporan-satu.js $W | grep -E "FAIL|LULUS|GAGAL"
done
for t in ac-download-sidebar ats-countdown pdf-foto audience-export ft-multistudio ft-export-foto ft-laporan-satu; do echo "== $t"; node tests/browser/$t.js | grep -E "FAIL|SEMUA|HASIL|LULUS|GAGAL"; done
