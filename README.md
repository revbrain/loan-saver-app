# Rencana Tabungan Cicilan (Web)

Aplikasi web statis untuk menghitung cicilan bulanan, tabungan mingguan, margin dari harga asli, dan sinkronisasi ke Google Tasks.

## Cara jalanin

1. Buka folder `D:\loan-saver-app`.
2. Jalankan server statis agar OAuth berfungsi.

```powershell
cd D:\loan-saver-app
python -m http.server 5173
```

Lalu buka `http://localhost:5173`.

## Setup Google Tasks (OAuth)

1. Buat Google Cloud Project.
2. Aktifkan Google Tasks API.
3. Buat OAuth Client ID (Web application).
4. Tambahkan Authorized JavaScript origins:
   - `http://localhost:5173`
5. Salin Client ID ke aplikasi.
6. (Opsional) Buat API Key dan tempel ke aplikasi.

Setelah itu klik **Hubungkan Google**, pilih daftar task, dan klik **Sinkronkan jadwal**.

## Catatan

- Gunakan akun Google pribadi.
- Task dibuat sesuai frekuensi (mingguan/bulanan) dengan due date jam 09:00.
- Perhitungan mingguan memakai 52 minggu per 12 bulan.
