# Deploy Streaxie frontend dari nol

Panduan berbahasa Indonesia ini menganggap frontend dan backend belum dideploy. Disusun 13 November 2026 berdasarkan konfigurasi dan riwayat perbaikan repo. Tujuannya agar kamu bisa deploy sendiri melalui dashboard/terminal atau bekerja bersama AI sambil memahami setiap langkah. Tampilan dashboard, versi alat, dan kuota provider dapat berubah.

Repo ini **streaxie-react**, biasanya folder lokal `frontend`. Backend adalah **streaxie-go**, biasanya `backend`. Keduanya repo Git terpisah. Untuk provisioning Neon, Gmail, migrasi, dan API, ikuti [panduan backend](https://github.com/ardalepa-hyposelenia/streaxie-go/blob/main/docs/DEPLOYMENT-GUIDE.md), atau buka `../../backend/docs/DEPLOYMENT-GUIDE.md` di workspace lokal.

## 1. Gambaran deployment

```text
Browser pengguna
  -> https://streaxie-react.vercel.app
     -> aset React/Vite dari Vercel
     -> /api/v1/* -> middleware.ts -> rewrite -> https://streaxie-go.vercel.app
                                                  -> Neon PostgreSQL
                                                  -> Gmail SMTP
                                                  -> Turnstile Siteverify
```

Frontend mempunyai dua bagian: bundle publik React/Vite dan middleware routing yang berjalan di Vercel. Karena itu frontend memerlukan satu key publik untuk Turnstile dan satu secret privat untuk middleware.

Browser selalu menggunakan API relatif pada origin frontend. Refresh cookie disimpan sebagai HttpOnly dengan SameSite Strict; production memakai Secure. Topologi proxy ini membantu menjaga alur sesi tetap pada situs yang dibuka pengguna. Jangan mengganti panggilan browser dengan URL backend langsung untuk mengatasi routing tanpa meninjau autentikasi/cookie.

Cloudflare digunakan untuk widget Turnstile, bukan tempat hosting frontend pada susunan ini. Neon dan Gmail hanya dikonfigurasi pada backend. Tidak perlu membuat Worker, Pages, atau database kedua untuk frontend.

## 2. Urutan pengerjaan kedua repo

1. Siapkan akun GitHub, Vercel, Neon, Cloudflare, dan Google pengirim.
2. Tetapkan nama project serta domain stabil backend dan frontend.
3. Buat Neon baru dan simpan pooled/direct URL secara privat.
4. Aktifkan Google 2-Step Verification dan buat App Password Gmail.
5. Buat Turnstile Managed dengan hostname frontend stabil.
6. Buat JWT secret untuk backend dan proxy secret yang sama di kedua project.
7. Jalankan migrasi database dari repo backend pada target Neon baru.
8. Isi environment backend lalu deploy API ke Vercel Singapore `sin1`.
9. Sesuaikan routing frontend, isi environment, lalu build/deploy frontend.
10. Uji health, register, challenge, email, sesi, data, dan offline dari situs pengguna.

Langkah 3–8 dijelaskan terperinci dalam panduan backend. Kamu boleh membuat project frontend kosong lebih dahulu untuk memastikan domain tersedia, lalu menerbitkan aplikasi setelah backend siap. Jangan menunggu frontend berhasil register untuk menyadari database belum dimigrasi.

Contoh origin proyek ini:

| Komponen | Origin |
| --- | --- |
| Frontend stabil | `https://streaxie-react.vercel.app` |
| Backend stabil | `https://streaxie-go.vercel.app` |
| Backend `WEB_ORIGIN` | Harus origin frontend di atas |
| Hostname Turnstile | `streaxie-react.vercel.app`, tanpa protokol/path |

Gunakan domain yang benar-benar diberikan Vercel pada akunmu. Nama contoh mungkin tidak tersedia. URL deployment acak digunakan untuk memeriksa suatu deployment, bukan alamat pengguna permanen.

## 3. Persiapan lokal

Pasang Git, Bun sesuai `package.json` (saat penulisan 1.4.4), dan Vercel CLI. Go 1.25+ diperlukan jika kamu juga menyiapkan backend. Contoh perintah menggunakan PowerShell:

```powershell
git --version
bun --version
bun add --global vercel
vercel --version
vercel login
vercel whoami
```

Clone repo bila belum ada:

```powershell
git clone https://github.com/ardalepa-hyposelenia/streaxie-react.git frontend
Set-Location frontend
git status
git branch --show-current
git log -1 --oneline
bun install --frozen-lockfile
```

Jalankan perintah satu per satu; hentikan dan periksa error jika gagal. Parent workspace yang menampung `frontend`/`backend` bukan repo Git. Jalankan perintah Git pada repo yang sesuai.

`bun.lock` adalah lockfile repo. Jangan menghapusnya agar build tampak lolos. Gunakan `bun add` untuk perubahan dependency yang disengaja. `bun run test` menjalankan Vitest; `bun test` adalah runner bawaan Bun dan bukan perintah test proyek ini.

## 4. Buat widget Cloudflare Turnstile

Jika belum dibuat melalui panduan backend:

1. Buka Cloudflare Dashboard, masuk ke Turnstile, tambahkan widget.
2. Beri nama seperti `Streaxie Production`.
3. Tambahkan hostname frontend stabil, tanpa `https://` atau slash.
4. Pilih Managed, simpan widget.
5. Simpan site key untuk frontend dan secret key untuk backend secara terpisah.
6. Pastikan backend memakai secret dari widget yang sama dan `WEB_ORIGIN` sesuai situs.

Turnstile mendukung hostname yang tidak diproksikan melalui DNS Cloudflare. Lihat [pengelolaan hostname](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/).

Frontend memuat script `https://challenges.cloudflare.com/turnstile/v0/api.js` dari `src/Turnstile.tsx`. CSP pada `vercel.json` sudah mengizinkan domain yang diperlukan. Backend memeriksa hostname dan action, bukan hanya apakah widget terlihat berhasil. Action aplikasi adalah `register`, `forgot`, dan `resend`.

Token harus baru untuk percobaan baru; token Turnstile berlaku singkat dan sekali pakai menurut [dokumentasi validasi server](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/). Setelah register, backend memberi satu pengiriman verifikasi awal dalam dua menit bagi akun terautentikasi; resend selanjutnya memerlukan challenge.

## 5. Isi environment pada project yang tepat

Frontend Production hanya membutuhkan:

| Variable | Nilai | Lokasi pemakaian |
| --- | --- | --- |
| `VITE_TURNSTILE_SITE_KEY` | Site key widget Production | Dibaca saat build, masuk bundle browser; publik |
| `PROXY_SHARED_SECRET` | Nilai acak minimal 32 byte yang sama dengan backend | Middleware Vercel; privat, tanpa awalan `VITE_` |

Jangan mengisi `DATABASE_URL`, `JWT_SECRET`, `GMAIL_APP_PASSWORD`, atau `TURNSTILE_SECRET_KEY` di frontend. Kode browser tidak membutuhkannya. `BACKEND_ORIGIN` juga bukan variable deployment yang digunakan konfigurasi akhir repo; alamat backend ada secara statis pada `vercel.json`.

Untuk produksi, masukkan variable pada Vercel project frontend, target **Production**. `.env.local` di laptop hanya untuk penggunaan lokal dan diabaikan Git/deploy. File itu tidak otomatis mengisi variable cloud.

Untuk build lokal yang menyertakan widget, masukkan site key publik ke file lokal bila belum ada:

```dotenv
VITE_TURNSTILE_SITE_KEY=SITE_KEY_MILIKMU
```

Ganti placeholder; jangan commit file tersebut. Vite development biasa dapat berjalan tanpa Turnstile key, tetapi build Vercel Production diwajibkan memiliki key oleh `scripts/service-worker.mjs`. Pengujian widget nyata secara lokal memerlukan hostname/widget development yang sesuai; jangan menambahkan banyak hostname latihan pada widget Production tanpa alasan.

Perubahan site key memerlukan **build baru** karena `import.meta.env` dimasukkan ke bundle. Perubahan secret middleware juga memerlukan redeploy. Lihat [environment variables Vercel](https://vercel.com/docs/environment-variables/managing-environment-variables).

## 6. Periksa routing dan build configuration

Sumber kebenaran ada pada [vercel.json](../vercel.json):

| Pengaturan | Konfigurasi repo |
| --- | --- |
| Framework | `vite` |
| Runtime Bun | `bunVersion: "1.4.x"` |
| Install | `bun --version && bun install --frozen-lockfile` |
| Build | `bun run test && bun run build` |
| Output | `dist` |
| Deployment Git | Hanya `main`; branch lain dinonaktifkan |

Vercel memilih patch Bun dalam garis versi yang dikonfigurasi; lokal dipatok melalui `packageManager` di `package.json`. Periksa versi pada Build Logs, bukan hanya versi laptop. Lihat [referensi konfigurasi Vercel](https://vercel.com/docs/project-configuration/vercel-json).

Bagian routing yang perlu dipahami:

```json
"rewrites": [
  {
    "source": "/api/:path*",
    "destination": "https://streaxie-go.vercel.app/api/:path*"
  },
  {
    "source": "/healthz",
    "destination": "https://streaxie-go.vercel.app/healthz"
  },
  { "source": "/(.*)", "destination": "/index.html" }
]
```

Ini potongan file, bukan keseluruhan `vercel.json` pengganti. API dan health harus di atas fallback SPA. Jika fallback menangkap API, browser bisa menerima HTML ketika mengharapkan JSON. Fallback diperlukan agar membuka `/verify-email` atau `/reset-password` langsung tetap menyajikan aplikasi React.

Jika nama backend milikmu berbeda, ubah **kedua** destination HTTPS tersebut. Sesuaikan ekspektasi domain dalam `src/deployment.test.ts` ke domain baru yang sama; tests saat ini memang memeriksa domain proyek asli. Jangan menghapus tests agar nama baru lolos tanpa memeriksa route.

`middleware.ts` mencocokkan `/api/:path*`, memeriksa secret, mengganti header proxy dari pemanggil, dan meneruskan IP dari header Vercel. `/healthz` tidak melalui matcher API ini. Karena itu health sukses **belum membuktikan** middleware secret benar; uji login/register lewat frontend juga diperlukan.

`.vercelignore` mengecualikan `.env*`, `.git/`, `.vercel/`, `node_modules/`, `dist/`, dokumentasi, dan hasil pengujian. Vercel membangun `dist` dari source, bukan memakai hasil build lokal yang diunggah.

## 7. Validasi lokal sebelum deploy

Dari root repo frontend:

```powershell
bun install --frozen-lockfile
bun run test
bun run build
bun run format:check
```

Jalankan satu per satu dan periksa exit code. Build menjalankan TypeScript browser, TypeScript middleware, Vite, lalu pembuatan service worker. Build lokal tanpa `VERCEL_ENV=production` tidak menguji guard environment Production; untuk memeriksanya dengan site key yang sudah diisi, gunakan terminal khusus:

```powershell
$env:VERCEL_ENV = 'production'
bun run build
Remove-Item Env:VERCEL_ENV -ErrorAction SilentlyContinue
```

Jika key belum tersedia, build seharusnya berhenti dengan pesan key wajib. Jangan menghapus guard itu untuk meloloskan deployment.

E2E memakai Edge headless dan **backend uji terisolasi** menurut [README](../README.md). Jangan menjalankan `bun run test:e2e` ke situs/live DB pengguna: suite membuat akun/habit. Fixture E2E mensimulasikan beberapa respons email sehingga lulus E2E tidak membuktikan Gmail benar-benar mengirim.

## 8. Deploy lewat dashboard tanpa AI

1. Pastikan backend Ready dan health backend dapat dibuka.
2. Pastikan branch `main` frontend sudah berisi konfigurasi final dan checks lulus.
3. Di Vercel, pilih workspace yang sama dengan rencana deployment.
4. Pilih **Add New / Project**, import repo frontend dari GitHub.
5. Jika repo tidak ada, periksa akses instalasi Vercel GitHub App.
6. Untuk repo frontend mandiri, Root Directory adalah `.`. Jangan mengisi `frontend` hanya karena itu nama folder checkout di laptop.
7. Pilih framework Vite; biarkan konfigurasi repo menentukan install/build/output.
8. Isi `VITE_TURNSTILE_SITE_KEY` dan `PROXY_SHARED_SECRET` pada Production. Tandai secret privat sebagai Sensitive jika tersedia.
9. Jalankan Deploy. Periksa Build Logs: versi Bun, install frozen, tests, TypeScript, Vite, service worker, dan middleware.
10. Tunggu Ready lalu cek domain stabil pada halaman Domains/project.
11. Bila domain yang diberikan berbeda dari rencana, cocokkan hostname widget dan backend `WEB_ORIGIN`; redeploy backend jika origin berubah.
12. Buka situs pada domain stabil dan lanjutkan pemeriksaan manual.

Import dapat memulai build sebelum konfigurasi lengkap. Jika deployment awal gagal, isi environment yang kurang dan redeploy; tidak perlu membuat ulang project/database.

Git integration akan membangun push `main` sesuai konfigurasi branch. Branch lain tidak otomatis memiliki preview pada setup ini. Jangan menganggap variable Production tersedia pada Preview atau Development; environment berbeda mempunyai nilai terpisah.

## 9. Alternatif deploy lewat CLI

Dari root repo frontend:

```powershell
vercel link
vercel env ls --environment production
```

Pilih workspace serta **project frontend**, bukan backend. File `.vercel/project.json` membantu memeriksa nama project yang terhubung; jangan menyalin file link backend ke sini. Tambahkan nilai melalui prompt:

```powershell
vercel env add VITE_TURNSTILE_SITE_KEY --environment production
vercel env add PROXY_SHARED_SECRET --environment production
vercel --prod
```

Gunakan `--sensitive` untuk secret jika didukung versi CLI, atau isi melalui dashboard. Periksa `vercel env add --help`. Jangan menaruh secret sebenarnya pada argumen terminal/history atau membagikan seluruh environment ke AI.

CLI mengunggah source lokal yang diizinkan `.vercelignore`, termasuk perubahan belum di-commit. Deployment Git menggunakan commit di GitHub. Bandingkan `git diff` dan commit sebelum publish agar kode yang diuji sama dengan source yang dideploy.

Untuk memeriksa deployment dan build log, ganti placeholder berikut dengan URL deployment yang baru dihasilkan:

```text
vercel inspect URL_DEPLOYMENT
vercel inspect URL_DEPLOYMENT --logs
vercel list --environment production
```

Build Logs digunakan untuk instalasi/kompilasi. Gunakan Runtime Logs dashboard ketika build sukses tetapi request gagal. Jika terminal tidak bisa menjangkau API Vercel sementara dashboard bisa, periksa jaringan/izin/login CLI sebelum mengubah kode aplikasi.

## 10. Pemeriksaan setelah deploy

### Health dan API proxy

```powershell
Invoke-RestMethod https://streaxie-go.vercel.app/healthz
Invoke-RestMethod https://streaxie-react.vercel.app/healthz
```

Keduanya harus menghasilkan `status: ok`; ganti domain sesuai akunmu. Jika backend sukses tetapi frontend gagal, periksa rewrite/domain/protection frontend. Jika keduanya gagal, periksa backend startup, DB, migrasi, dan environment.

### Browser, challenge, email, dan sesi

1. Buka domain stabil frontend melalui HTTPS.
2. Di DevTools Network, pastikan request aplikasi menuju `/api/v1/...` pada origin frontend.
3. Selesaikan Turnstile dan register dengan email yang kamu kendalikan.
4. Minta email verifikasi; cek inbox/spam. Pastikan URL dimulai origin frontend dan path `/verify-email`.
5. Buka link dan periksa status verified; uji bahwa reload/direct navigation tetap memuat aplikasi.
6. Login lalu reload untuk memeriksa refresh sesi. Pada DevTools Application/Cookies, refresh cookie harus HttpOnly/Secure pada production. Access token di memori tidak diharapkan bertahan sendiri setelah reload.
7. Buat habit/check-in, reload, dan periksa persistensi. Logout lalu login ulang.
8. Uji forgot password dengan akun sendiri; periksa origin link reset dan pencabutan sesi lama.

Jangan membagikan URL email bertoken, cookie, atau header Authorization pada screenshot/log. Health dan status Ready tidak menggantikan uji email dari inbox.

### Offline dan service worker

1. Buka situs secara online sampai service worker terpasang; kunjungi ulang bila perlu.
2. Pastikan data habit yang akan dipakai sudah tersedia.
3. Aktifkan Offline pada DevTools Network dan reload untuk memeriksa app shell.
4. Lakukan check-in pada habit yang sudah ada; periksa status pending.
5. Kembalikan Online dan pastikan antrean terkirim serta status diperbarui.

Offline mendukung check-in habit yang sudah ada dan data cache; pembuatan habit, pengaturan, serta operasi akun membutuhkan koneksi. API tidak disimpan oleh service worker. Browser tertutup tidak melakukan pengiriman latar belakang. Vite dev server tidak memasang service worker production, jadi `bun run dev` tidak cukup untuk membuktikan alur offline hasil deploy.

## 11. Kendala nyata yang membentuk konfigurasi akhir

Berikut jejak perbaikan dalam Git. Nama error tidak ditambahkan bila log aslinya tidak tersedia.

| Kendala | Mengapa muncul / implikasi | Solusi pada repo |
| --- | --- | --- |
| Runtime Bun dan format lockfile | Build image tidak boleh diasumsikan sama dengan laptop | `bunVersion: "1.4.x"`; commit `b3064eb` |
| Konfigurasi programatik sebelum dependencies siap | Memproses konfigurasi berbasis dependency dapat membuat bootstrap rumit | Routing dipindahkan ke `vercel.json` statis, dependency konfigurasi tidak dipakai; `e7d7f11` |
| Installer yang melakukan bootstrap tambahan | Tidak perlu menjalankan Bun lain ketika runtime sudah dipilih | Install akhir `bun --version && bun install --frozen-lockfile`; `90a4a5a` |
| Tipe Vite/browser memengaruhi build middleware | Ambient types global ikut terbawa ke konteks server/middleware | `src/vite-env.d.ts`, `types: []`, dan `tsconfig.deploy.json`; `ad34acf` |
| Email production masih mengarah localhost | Link dibentuk backend, bukan oleh React atau Vite proxy | Update `WEB_ORIGIN` backend Production lalu redeploy backend |

Untuk menelusuri sendiri, gunakan `git show SHA` pada repo yang benar. Jangan kembali memakai `BACKEND_ORIGIN` atau konfigurasi dinamis dari commit lama tanpa meninjau konfigurasi akhir.

Pada perbaikan email, nilai lama Vercel Sensitive tidak dapat dibaca kembali lewat respons API yang dipakai. Tindakan yang tercatat adalah menetapkan ulang origin frontend, redeploy backend, memastikan Ready/alias dan health frontend HTTP 200. Itu belum merupakan bukti email baru tiba; uji inbox tetap diperlukan. Mengedit `.env` frontend tidak memperbaiki sumber link email backend.

## 12. Troubleshooting cepat

| Gejala | Yang perlu diperiksa |
| --- | --- |
| Install frozen lockfile gagal | Versi Bun pada Build Logs, `bun.lock`, dan perubahan dependencies; jangan hapus lockfile sebagai jalan pintas. |
| Build gagal karena site key | Isi `VITE_TURNSTILE_SITE_KEY` pada target Production, rebuild. |
| TypeScript middleware gagal | Periksa `tsconfig.deploy.json`, `types: []`, dan ambient Vite pada `src`; baca error pertama sebelum mengubah dependencies. |
| Halaman `/verify-email` 404 | Periksa fallback SPA terakhir pada rewrites. |
| API mengembalikan HTML | Periksa path API dan urutan rewrite sebelum fallback SPA. |
| `PROXY_UNAVAILABLE` | Secret frontend kosong/terlalu pendek; isi minimal 32 byte dan redeploy. Health saja tidak melewati middleware API. |
| Turnstile tidak muncul | Periksa site key hasil build, CSP, akses script Cloudflare, ekstensi browser, dan console. |
| `CHALLENGE_REQUIRED` | Periksa domain stabil, hostname widget, `WEB_ORIGIN`, pasangan site/secret key, action, dan token baru. |
| `CHALLENGE_UNAVAILABLE` | Periksa runtime log backend/provider/DB; jangan melewati validasi saat gangguan. |
| Email localhost / domain salah | Perbaiki `WEB_ORIGIN` di backend Production, redeploy backend, minta email baru. |
| Email tidak sampai | Periksa Gmail/App Password/runtime log backend, kuota, inbox/spam; bukan semata masalah frontend. |
| Login berhasil tetapi reload logout | Periksa cookie, HTTPS, proxy origin, dan request refresh. |
| Data tampak dari versi lama | Periksa deployment/alias dan service worker; jangan langsung menghapus IndexedDB dengan antrean pending. |
| API gagal hanya lewat frontend | Bandingkan health langsung/proxy, rewrite, environment middleware, serta protection masing-masing project. |
| HTTP 429 | Hormati `Retry-After`; hindari percobaan berulang saat diagnosis. |
| CLI ditolak sandbox/jaringan | Periksa lewat dashboard atau perbaiki akses tool; jangan menafsirkan kegagalan tool sebagai kegagalan build. |

Jika perlu membersihkan data situs untuk diagnosis, pastikan tidak ada check-in pending yang belum tersinkron. Menghapus IndexedDB dapat membuang antrean lokal; gunakan profil browser lain terlebih dahulu jika hanya ingin membandingkan versi.

## 13. Memperbarui, mengganti domain, dan rollback

**Update frontend:** periksa diff, jalankan checks, lalu push `main` untuk Git deploy atau jalankan `vercel --prod` untuk source lokal. Verifikasi alias, API, dan aplikasi. Deployment Ready tidak berarti pengguna pasti sedang membuka deployment terbaru; cek domain stabil.

**Update environment:** ubah variable pada project/target benar, lalu redeploy. Untuk build ulang source deployment tertentu:

```text
vercel redeploy URL_DEPLOYMENT_TERPILIH --environment production
```

Ganti placeholder dan pastikan source deployment tersebut benar. Untuk kode lokal baru gunakan deployment baru, bukan redeploy source lama. Lihat [CLI redeploy](https://vercel.com/docs/cli/redeploy).

**Rotasi secret proxy:** ubah kedua project dan deploy keduanya secara terkoordinasi. Kode backend belum menerima dua secret bersamaan, sehingga perpindahan bisa menimbulkan gangguan sementara. Jangan merotasi secret ini hanya untuk memperbaiki site key yang salah.

**Custom domain:** tambahkan pada Vercel, ikuti record DNS, tunggu HTTPS aktif. Jika DNS ada di Cloudflare, ubah record sesuai petunjuk Vercel; memakai Turnstile sendiri tidak mewajibkan DNS Cloudflare. Perbarui hostname widget dan backend `WEB_ORIGIN`, lalu redeploy backend. Jika domain backend berubah, ubah rewrite dan ekspektasi tests lalu deploy frontend. Backend memvalidasi satu hostname dari `WEB_ORIGIN`, jadi alias tambahan tidak otomatis lolos challenge.

**Rollback:** pilih deployment known-good melalui dashboard setelah memeriksa kompatibilitas backend/environment. Rollback frontend tidak mengembalikan skema Neon atau membatalkan email. Service worker dan antrean lokal juga perlu dipertimbangkan saat membandingkan perilaku antarversi.

## 14. Cara menggunakan AI sebagai pendamping

Tanpa AI, jalankan urutan tutorial dan simpan catatan project, domain, SHA, migrasi, serta hasil checks tanpa rahasia. Ketika gagal, tentukan dahulu apakah masalah terjadi saat install/build, routing, runtime backend, atau layanan eksternal.

Dengan AI, minta penjelasan tujuan perintah dan bukti hasilnya. Berikan file konfigurasi publik, SHA, log yang disensor, serta project/environment target. Login/2FA dan nilai secret dimasukkan melalui mekanisme privat, bukan chat. Jangan meminta AI mengunduh seluruh secrets untuk memeriksa satu URL.

Contoh persiapan:

```text
Baca docs/DEPLOYMENT-GUIDE.md. Pastikan Bun/lockfile, rewrite, CSP, middleware,
site key dan secret proxy terpetakan dengan benar. Jalankan checks lokal dan
laporkan hasil. Jangan tampilkan secret atau deploy sebelum targetnya jelas.
```

Contoh publish dengan lingkup jelas:

```text
Deploy frontend commit [SHA] ke project [NAMA] pada workspace [WORKSPACE].
Backend stabil adalah [ORIGIN]; Production env sudah saya isi. Periksa domain
rewrite dan tests, deploy, lalu cek Ready, alias dan health. Jangan ubah DB.
Laporkan pemeriksaan browser/email mana yang masih perlu saya lakukan.
```

Contoh diagnosis:

```text
Situs [DOMAIN] mendapat PROXY_UNAVAILABLE pada login. Bandingkan middleware
dan environment frontend Production. Jangan tampilkan nilai secret. Periksa
apakah deployment terbaru sudah memakai konfigurasi yang benar.
```

Saat menilai jawaban AI, bedakan bukti: tests lulus, build lulus, Ready, alias benar, health sukses, dan alur pengguna sukses adalah pemeriksaan yang berbeda. Minta hasil yang sesuai klaimnya.

## 15. Checklist akhir

- [ ] Backend/Neon/migrasi/Gmail siap menurut panduan backend.
- [ ] Domain stabil sudah pasti, bukan URL acak deployment.
- [ ] Site key publik dan secret middleware berada pada project/target benar.
- [ ] Secret proxy cocok dengan backend; tidak ada secret privat berawalan `VITE_`.
- [ ] Rewrite backend dan ekspektasi tests cocok dengan origin milikmu.
- [ ] Frozen install, tests, build dan format check lulus.
- [ ] Deployment Ready; alias production benar.
- [ ] Health backend dan frontend sukses; request API melewati origin frontend.
- [ ] Register/challenge, email domain benar, login/reload/logout dan reset diuji.
- [ ] Offline/pending/sync diuji tanpa membuang antrean pengguna.
- [ ] Catatan commit, konfigurasi tanpa rahasia, dan cara rollback tersedia.
