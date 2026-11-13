# Referensi antarmuka Streaxie

Dokumen ini mempertahankan wireframe awal sebagai referensi. Implementasi web terkini berada di `frontend/` dan mengikuti `WEB-DESIGN.md`: kartu dapat diklik, streak per habit selalu terlihat, editor inline, serta Today/Insights/Settings pada navigasi ponsel. Keputusan tersebut menggantikan wireframe lama yang berbeda. Mobile masih menjadi pekerjaan berikutnya; kontrak backend ada di `backend/API.md`.

## Mobile: local-first

```text
+---------------------------------------------------+
| Tanggal aktif                      Status sync      |
| Senin, 9 Nov 2026                   Rollover 03:00   |
| [Sen 9] Sel 10 Rab 11 Kam 12                       |
|===================================================|
| Pagi — urut menurut jadwal evaluasi                |
| [✓] Tidur maksimal 21:00 kemarin      Streak 14     |
|     Target 8 Nov 21:00 | Aktual 8 Nov 20:50         |
|     PERFECT · 10 menit lebih awal          [Ubah]  |
|                                                   |
| [!] Bangun 06:00                      Streak 12    |
|     Aktual 06:15 · PASSED_TOLERATED         [Ubah]  |
|                                                   |
| Sepanjang hari                                    |
| [~] Minum air 2000 ml                  Streak 8     |
|     1800/2000 ml · kurang 200 ml                    |
|     [-250 ml] [+250 ml]                     [Edit] |
|                                                   |
| [ ] Baca buku satu bab                 Streak 5     |
|     [Tandai selesai hari ini]                     |
|---------------------------------------------------|
| [Beranda]       [+ Buat habit]       [Statistik]    |
+---------------------------------------------------+
```

Form habit memuat nama, tipe, operator, target, toleransi, unit, dan jadwal evaluasi. Untuk TIME_LIMIT, tampilkan pilihan tanggal target: hari evaluasi atau hari sebelumnya. Form check-in waktu harus memperlihatkan tanggal kejadian agar input setelah tengah malam tidak ambigu. Tampilkan pratinjau PERFECT, PASSED_TOLERATED, dan FAILED berdasarkan aturan.

SQLite/Room menjadi sumber tampilan lokal. Simpan satu state DIRTY terakhir per habit/tanggal dan debounce 2–3 detik. Status sync harus membedakan sedang mengirim, tersinkron, retry, dan konflik/perlu koreksi. Item rejected tidak boleh ditandai SYNCED. Jika ada perubahan aturan atau pengaturan waktu pending, perlihatkan kapan perubahan tersebut mulai berlaku.

Pemilihan hari lampau untuk membaca histori tetap tersedia. Pengeditan online hanya tersedia untuk hari logis aktif. Input kuantitas dapat dicicil, nilai dapat dikoreksi, dan check-in dapat dibatalkan pada hari aktif.

## Web: dashboard split view

```text
+---------------------------------------------------------------------------------------+
| STREAXIE          Hari aktif                    Timezone             Rollover          |
+-----------------+--------------------------------------+------------------------------+
| Hari ini        | Daftar habit menurut waktu evaluasi  | Detail habit aktif            |
| Analitik        |                                      | Current / longest streak      |
| Arsip           | Tidur maksimal 21:00 kemarin          |                              |
| Pengaturan      | Tanggal + jam aktual                 | Kualitas 30 hari              |
|-----------------| [Update] [Uncheck]                   | PERFECT / TOLERATED / FAILED  |
| Filter tipe     |                                      |                              |
| Semua           | Bangun 06:00                         | Kalender riwayat              |
| Binary          | Aktual 06:15                         | P / T / X / belum diisi       |
| Quantity        | [Update] [Uncheck]                   |                              |
| Waktu           |                                      | Target dan toleransi          |
|-----------------| Minum air 2000 ml                    | Aturan aktif / pending        |
| Jam pergantian  | [1800] ml [+250] [Update] [Uncheck]   | [Edit aturan] [Arsipkan]      |
| hari            |                                      |                              |
| [03:00]         | Baca buku satu bab                   |                              |
| [Simpan]        | [Centang selesai]                    |                              |
+-----------------+--------------------------------------+------------------------------+
```

Web menggunakan Direct REST. Setelah reload, muat habit dan log pada logical_date aktif; jangan menganggap daftar habit sudah menyertakan nilai check-in. Analitik menggunakan status dan delta dari snapshot log masing-masing hari. Jangan menilai ulang histori menggunakan target terbaru.

Edit aturan menampilkan bahwa perubahan berlaku besok. Pengaturan timezone/rollover menampilkan waktu aktivasi pending. Saat mendapat CONFLICT atau STALE_WRITE, tarik state terbaru dan minta pengguna meninjau perubahan sebelum mencoba lagi. Arsip/unarsip dan hapus harus memakai versi metadata terbaru.

Login email/password, refresh sesi, dan logout menggunakan endpoint autentikasi. UI client mendatang perlu memilih penyimpanan token yang sesuai platform dan menjelaskan status sesi berakhir. Nilai streak hari aktif bersifat provisional: uncheck mengembalikan streak kemarin sampai rollover.
