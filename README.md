# 📰 RO NEWS — Backend Node.js + SQLite

Portal berita modern dengan admin panel lengkap.

---

## 🚀 Cara Menjalankan

### 1. Install Node.js
Download di https://nodejs.org (pilih versi LTS)

### 2. Extract folder ini, buka terminal di dalamnya

```bash
cd ro-news-backend
```

### 3. Install dependencies

```bash
npm install
```

### 4. Jalankan server

```bash
npm start
```

### 5. Buka di browser

| Halaman | URL |
|---|---|
| 🌐 Website Berita | http://localhost:3000 |
| 🔧 Admin Panel | http://localhost:3000/admin.html |

---

## 🔐 Login Admin Default

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `admin123` |

> ⚠️ Ganti password di file `.env` sebelum deploy!

---

## 📁 Struktur Folder

```
ro-news-backend/
├── server.js          ← Backend utama (Express + SQLite)
├── database.db        ← Database (otomatis dibuat)
├── .env               ← Konfigurasi (port, password, secret)
├── package.json
├── uploads/           ← Folder gambar (otomatis dibuat)
└── public/
    ├── index.html     ← Halaman berita publik
    └── admin.html     ← Panel admin
```

---

## ✏️ Cara Tambah Berita

1. Buka http://localhost:3000/admin.html
2. Login dengan username & password
3. Klik **"Tulis Berita"**
4. Isi judul, kategori, isi berita, upload gambar
5. Klik **"Simpan Berita"**
6. Berita langsung tampil di halaman utama!

---

## 🛠️ Edit .env

```env
PORT=3000
JWT_SECRET=ganti_dengan_string_acak_panjang
ADMIN_PASS=password_admin_kamu
```

---

## 📦 Dependencies

- `express` — web server
- `better-sqlite3` — database SQLite
- `bcryptjs` — enkripsi password
- `jsonwebtoken` — autentikasi JWT
- `multer` — upload gambar
- `cors` — Cross-Origin Resource Sharing
- `dotenv` — environment variables
