# Rancangan web Streaxie

Status: rancangan yang disepakati sudah diimplementasikan pada aplikasi React di repo ini, terhubung ke backend Go. Pembaruan: 13 November 2026. `docs/design-preview/` tetap menjadi acuan visual mandiri dengan data simulasi. Petunjuk menjalankan aplikasi tersedia di [README](../README.md).

## Keputusan yang disepakati

| Aspek | Keputusan |
| --- | --- |
| Perangkat | Desktop dan ponsel sama penting. Dua panel di desktop; satu kolom dengan detail terpisah di ponsel. |
| Fokus halaman utama | Check-in habit hari ini. Progres dan streak sebagai pendukung. |
| Kepadatan | Dioptimalkan untuk 3–7 habit aktif; ini bukan batas jumlah habit. |
| Kepadatan Today | Lebih ringkas daripada prototipe awal: kurangi ruang dan tinggi kartu agar lebih banyak habit terlihat sekaligus. |
| Kesan visual | Tenang dan personal. |
| Palet | Krem dengan aksen terracotta lembut. |
| Editor check-in | Input kuantitas dan jam mengembang di dalam kartu habit. |
| Aktivasi kartu | Tanpa tombol History atau Update. Klik kartu untuk interaksi check-in; kuantitas/waktu membuka editor inline. Habit centang mengikuti penyimpanan langsung yang sudah dipilih. |
| Streak pada kartu | Streak aktif setiap habit selalu terlihat pada kartu yang tertutup, pada posisi yang konsisten agar mudah dibandingkan antarkebiasaan. |
| Riwayat lengkap | Berada di Insights, bukan di dalam editor kartu Today. |
| Penyimpanan | Habit centang langsung tersimpan; kuantitas dan jam memakai tombol Save. |
| Pengguna baru | Panduan singkat membuat habit pertama: nama, cara mencatat, dan target. |
| Tema | Tema terang dahulu untuk MVP. |
| Bahasa | Bahasa Inggris. |
| Pengunjung belum login | Landing page lengkap sebelum login/register. |
| Pesan landing page | Pencatatan harian yang sederhana. |
| Akses MVP | Semua fitur gratis setelah mendaftar. |
| Monetisasi berikutnya | Pengguna menginginkan fitur berbayar di masa depan, bukan sekarang. Fitur premium, harga, paket, dan waktu peluncurannya belum diputuskan. |
| Audiens awal | Pengguna global. |
| Timezone onboarding | Tawarkan timezone perangkat untuk dikonfirmasi pengguna. |
| Rollover onboarding | Default 00:00, dengan pilihan mengubahnya sebelum membuat habit pertama. |
| Akun saat peluncuran web | Verifikasi email dan pemulihan password diperlukan untuk pendaftaran publik. |
| Metode verifikasi email | Tautan yang diklik dari email. |
| Akses sebelum verifikasi | Pengguna boleh langsung memakai aplikasi, dengan pengingat verifikasi email. |
| Masa tenggang verifikasi | 7 hari. |
| Setelah masa tenggang | Aplikasi menjadi hanya-baca sampai email terverifikasi. Habit dan riwayat tetap terlihat; check-in serta perubahan baru menunggu verifikasi. |
| Toleransi pada form habit | Opsional setelah target utama, melalui pilihan “Allow some flexibility”. |
| Navigasi ponsel | Navigasi bawah Today, Insights, Settings. New habit berada di Today; Archive diakses melalui Settings. |
| Penyimpanan gagal karena koneksi | Coba kembali otomatis setelah koneksi pulih; kartu menampilkan pending sampai server mengonfirmasi. |
| Check-in tertunda melewati rollover | Kirim melalui sync dengan timestamp pencatatan asli, mengikuti TTL offline yang dikonfigurasi. |
| Antrean pending | Tetap tersimpan di perangkat setelah reload atau tab ditutup; pengiriman dilanjutkan setelah aplikasi dibuka kembali. |
| Cakupan offline | Check-in habit yang sudah ada dan membaca data yang tersimpan. Pembuatan, perubahan, dan pengarsipan habit membutuhkan koneksi. |
| Logout dengan pending | Peringatkan pengguna, lalu pertahankan antrean khusus akun itu. Pengiriman berhenti sampai akun yang sama login kembali. |
| Pemulihan password | Tautan email membuka form password baru; pengguna kemudian login ulang. Reset mengakhiri seluruh sesi lama. |

## Usulan yang belum menjadi keputusan final

- Arah headline: “A simpler way to track your daily habits.” Pesan kesederhanaan sudah dipilih; teks headline persisnya masih berupa usulan.
- Detail tipografi, logo sementara, jarak, susunan copy, dan presentasi panel pada prototipe masih berupa usulan visual untuk mendapatkan tanggapan pengguna.
- Tanggapan pada prototipe awal: pengguna memilih Today yang lebih ringkas, lalu meminta tombol History dan Update dihapus dan kartu dapat diklik. Seluruh permukaan kartu kini merupakan target interaksi yang juga dapat diaktifkan melalui keyboard. Editor tetap memiliki tombol Save dan Cancel; mengoperasikan input tidak mengaktifkan ulang klik kartu. Input tetap memiliki tinggi 46 piksel.

## Prototipe untuk review

Prototipe mandiri berada pada [design-preview/index.html](design-preview/index.html). Buka di browser; tidak memerlukan instalasi atau koneksi ke backend. Halaman awal yang tersedia: Landing, Today, dan onboarding tiga langkah. Kontrol review menyediakan lebar ponsel, simulasi offline, masa verifikasi berakhir/hanya-baca, daftar kosong, dan loading.

Seluruh nilai habit dan histori merupakan data contoh yang ditandai secara eksplisit. Interaksi dan konfirmasi penyimpanan disimulasikan. Tidak ada akun yang dibuat, email yang dikirim, atau data backend yang diubah. Contoh perubahan disimpan terpisah pada browser hanya untuk eksplorasi prototipe.

Pratinjau Today desktop/ponsel, landing desktop/ponsel, dan langkah awal onboarding sudah dirender serta diperiksa pada browser. Pemeriksaan interaksi mencakup input inline, selisih waktu lintas tengah malam +210 menit, pending offline, penyimpanan contoh lokal, larangan perubahan pada mode hanya-baca, dan pembuatan contoh habit kuantitas dengan operator maksimum. Tampilan ponsel diperiksa pada viewport 390 piksel tanpa overflow horizontal pada area produk.

Revisi kartu tanpa tombol History/Update juga telah diperiksa dengan klik mouse pada permukaan kartu dan aktivasi keyboard Enter/Space. Klik input, stepper, dan Save tidak mengaktifkan ulang kartu. Draft editor tetap dipertahankan ketika pengiriman contoh pada kartu lain selesai. Pada mode hanya-baca, kartu membuka detail tanpa mengubah data.

Streak aktif kini tampil langsung di setiap kartu, sejajar dengan nama habit dan pada kolom yang konsisten untuk perbandingan. Data contoh menggunakan hitungan terpisah per habit; panel samping memakai sumber hitungan yang sama. Pemeriksaan browser mencakup penambahan satu hari saat lulus, pengembalian ke streak kemarin saat uncheck/gagal, tidak ada tambahan ganda saat berpindah dari tolerated ke perfect, penanda pending, serta habit baru dengan 0 hari. Badge diperiksa sejajar tanpa overflow pada lebar 320 dan 390 piksel. Pada frontend produksi, sumber streak aktif adalah current_streak dari backend; nilai optimistis yang belum tersinkron harus tetap ditandai pending.

Insights, Settings, Archive, dan login pada prototipe masih berupa panel awal atau placeholder yang ditandai. Rancangan lengkap autentikasi/pemulihan password dan penanganan konflik belum ditampilkan. Petunjuk review ada pada [design-preview/README.md](design-preview/README.md).

## Acuan dan hal yang masih perlu diselesaikan

Aturan bisnis mengikuti [PRD versi 1.2](https://github.com/ardalepa-hyposelenia/streaxie-go/blob/main/docs/PRD.md) dan [kontrak API](https://github.com/ardalepa-hyposelenia/streaxie-go/blob/main/API.md) pada repo streaxie-go. [UI.md](UI.md) menjadi referensi wireframe sebelumnya, dengan keputusan wawancara ini sebagai arahan yang lebih baru.

Registrasi memakai DEFAULT_TIMEZONE sementara. Endpoint satu kali `/settings/onboarding` mengaktifkan timezone dan rollover pilihan pengguna sebelum habit pertama, lalu menutup setup awal. Perubahan berikutnya melalui `/settings` tetap berlaku setelah boundary berikutnya.

Verifikasi email dan pemulihan password sudah diimplementasikan menggunakan tautan sekali pakai. Masa tenggang 7 hari ditegakkan di backend. Reset password mencabut seluruh sesi. Pengguna memilih SMTP Gmail: backend mewajibkan STARTTLS port 587 dengan Google App Password untuk seluruh email. Kredensial harus dikonfigurasi pada environment backend; pengiriman melalui akun yang dipilih perlu diverifikasi. Lihat [panduan konfigurasi email](https://github.com/ardalepa-hyposelenia/streaxie-go/blob/main/EMAIL.md).

Today, Insights, Settings, Archive, autentikasi, dan form habit tersedia dalam aplikasi React. Error per item tetap berada dalam antrean untuk ditinjau, dicoba ulang dengan timestamp asli, atau dibuang dari perangkat. Metadata konflik ditarik ulang tanpa menerapkan otomatis draft yang ditolak. Urutan habit tetap berdasarkan waktu evaluasi; belum ada keputusan untuk memindahkan habit selesai ke kelompok lain.

## Penyesuaian arsitektur web yang disetujui

PRD versi 1.1 menetapkan Direct REST untuk web. Keputusan wawancara memperluas alur check-in: web memakai Direct REST saat online dan mekanisme sync yang sudah tersedia untuk check-in tertunda, termasuk yang baru terkirim setelah rollover. Timestamp pencatatan dan logical_date asli harus dipertahankan; status pending baru berubah menjadi tersimpan setelah respons server mengonfirmasi item diterima. Penolakan per item harus ditampilkan, bukan dianggap sebagai keberhasilan batch.

Antrean IndexedDB dipisahkan per akun dan bertahan setelah reload/penutupan tab. Pengiriman berhenti saat logout atau akun berganti. Cakupan offline hanya check-in habit yang sudah ada dan membaca cache. Pending dihapus setelah konfirmasi server serta penarikan state terbaru; respons lama tidak boleh menghapus edit lokal penggantinya. Service worker build produksi menyimpan shell publik untuk membuka aplikasi kembali saat offline, tanpa menyimpan respons API atau token. Panduan pengujian ada di frontend/README.md.
