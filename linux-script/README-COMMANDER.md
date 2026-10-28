# Integra Commander CLI — Ubuntu Server

Versi CLI (tanpa GUI) dari Integra Commander. Semua operasi dijalankan dari terminal
Ubuntu Server: dashboard resource, setting, PM2 management, dan Nginx management.

Kode Windows/Tauri **tidak diubah**. Folder ini berdiri sendiri dan hanya memakai
Bash + tools sistem (PM2, Nginx, Git, Node.js).

---

## 1. Kebutuhan

- Ubuntu Server 22.04 / 24.04 (systemd)
- Akses `sudo` / root
- Git, Node.js + npm, PM2, Nginx
- PostgreSQL atau MSSQL (sesuai `DB_DIALECT`)

Pasang dependensi dari menu **Setting → 7) Install dependencies**
(menjalankan `app-installer.sh` yang sudah ada).

---

## 2. Menjalankan

```bash
cd /path/ke/linux-script
chmod +x commander.sh

sudo ./commander.sh
```

Menu utama:

```
1) Dashboard
2) Setting
3) PM2 Management
4) Nginx Management
0) Keluar
```

Bisa juga langsung ke satu menu:

```bash
sudo ./commander.sh --dashboard
sudo ./commander.sh --settings
sudo ./commander.sh --pm2
sudo ./commander.sh --nginx
sudo ./commander.sh --deploy
```

---

## 3. Struktur folder

```
linux-script/
├─ commander.sh              # entry point
├─ lib/
│  ├─ common.sh              # config, user/root helper, util
│  └─ deploy.sh              # deploy backend/frontend, PM2, Nginx
├─ modules/
│  ├─ dashboard.sh
│  ├─ settings.sh
│  ├─ pm2.sh
│  └─ nginx.sh
├─ config/
│  └─ commander.conf.example # contoh konfigurasi
├─ install.sh                # menu lama (tetap berfungsi)
├─ app-installer.sh          # installer paket (dipanggil dari Setting)
├─ mertrack-config.sh        # legacy → commander.sh --settings
└─ mertrack-installer.sh     # legacy → commander.sh --deploy
```

---

## 4. Konfigurasi

Disimpan di:

```
/etc/integra-commander/commander.conf   (root-only, chmod 600)
```

Semua nilai bisa diubah dari **Setting**. Contoh lengkap ada di
`config/commander.conf.example`.

| Grup | Key |
| --- | --- |
| Application | `APP_NAME`, `APP_USER`, `APP_DIR`, `SERVER_IP`, `APP_TIMEZONE`, `APP_MODE`, `LOGIN_TIMEOUT`, `RANGE_TRANSACTION` |
| Network | `BACKEND_PORT`, `BACKEND_BRANCH`, `FRONTEND_PORT`, `FRONTEND_BRANCH` |
| Database | `DB_DIALECT`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` |
| BPOM | `BPOM_URL`, `BPOM_EMAIL`, `BPOM_PASSWORD`, `BPOM_APP_NAME`, `BPOM_APP_PORT` |
| Repository | `CORE_REPO`, `FRONTEND_REPO`, `BPOM_REPO` |
| Nginx | `NGINX_SITE_NAME`, `NGINX_SERVER_NAME` |

Catatan:

- `APP_USER` adalah user Linux pemilik aplikasi (bukan root).
- `APP_DIR` adalah folder dasar; `services/`, `temp/`, `public/` dibuat langsung di dalamnya.
- Password disimpan di config (600) dan di `.env` (600, milik `APP_USER`).
- Kredensial Git **tidak** disimpan; ditanyakan setiap deploy.

---

## 5. Struktur runtime

```
$APP_DIR/
├─ services/     # API Core + BPOM (dipakai bersama, overwrite tanpa hapus)
├─ temp/         # clone/build sementara (dihapus setelah deploy)
├─ staging/      # staging frontend (dihapus setelah swap)
└─ public/       # frontend aktif (root Nginx)
```

> Layout ini sama dengan GUI Windows: `workingDirectory/services`, `temp`,
> `staging`, `public`, tanpa segmen versi tambahan.
>
> `services/` dipakai bersama oleh API Core dan BPOM, sama seperti versi
> Windows (`TabPm2.jsx`). Isi lama di-overwrite, folder tidak dihapus,
> sehingga entry script kedua aplikasi tetap ada. Konsekuensinya:
>
> - `.env` juga satu file bersama (`APP_*` untuk Core, `CONNECTOR_BPOM*`
>   untuk BPOM) — konsisten dengan Windows yang menulis `.env` dari setting
>   Core + BPOM.
> - Deploy BPOM **tidak** menyentuh `node_modules` (sama seperti Windows
>   yang melewati `npm install` untuk API_BPOM). Deploy API Core lebih dulu.
>
> Server yang dulu memakai script lama (`$PATH_MERTRACK/integra_v4.2/...`)
> perlu memindahkan isi `integra_v4.2/services` dan `integra_v4.2/public`
> ke `$APP_DIR/services` dan `$APP_DIR/public` (atau set `APP_DIR` ke
> `.../mertrack/integra_v4.2`).

---

## 6. Fitur per menu

### Dashboard
- Host, OS, IP, uptime, load average
- CPU / memory / disk (bar)
- Tabel proses PM2 + total RAM
- Status Nginx dan database
- Ringkasan konfigurasi + versi Node/npm/PM2/Nginx
- Auto-refresh 5 detik (`q` untuk keluar)

### Setting
- Application, Network/Port, Database, BPOM, Repository, Nginx
- Install dependencies
- Buat struktur folder
- Tampilkan / reset konfigurasi

### PM2 Management
- List proses (auto-refresh saat menu dibuka)
- Start / stop / restart / reload / delete
- Lihat & flush log
- Save session (`pm2 save`)
- Reload `.env`:
  - **soft** → `pm2 reload <name> --update-env`
  - **force** → `pm2 delete` + `pm2 start` ulang (downtime singkat)
- Deploy / install:
  - Reload backend
  - Install Backend + Seed (fresh)
  - Install Backend (update)
  - Install / update BPOM API
  - Install Frontend
  - PM2 log rotate
  - PM2 auto-start (systemd)

### Nginx Management
- Status / test / reload / start-stop-restart
- Daftar site (port, domain, root, proxy)
- Buat / update site frontend dari Setting
- Enable / disable site
- Edit site (backup otomatis)
- Hapus site (dipindah ke `*.removed.<timestamp>`, tidak permanen)
- Lihat log error/access
- Deploy / update frontend

---

## 7. Alur deploy

Backend (API Core / BPOM):

1. Clone repo ke `temp/` (branch opsional untuk Core)
2. Tulis `.env` dari Setting
3. `npm install`
4. `npx sequelize-cli db:seed:all` (khusus fresh install Core)
5. `npm run build`
6. Salin hasil build ke `services/` (overwrite, folder tidak dihapus)
7. `pm2 start` / `pm2 reload`
8. `pm2 save`

Catatan BPOM: sama seperti GUI, hasil build BPOM masuk ke `services/` yang
sama, memakai `.env` bersama, dan tidak menjalankan `npm install` di
`services/` (bergantung pada `node_modules` hasil deploy Core).

Frontend:

1. Clone ke `staging/frontend`
2. Tulis `.env` (`VUE_APP_URL_API_MERTRACK`, `VUE_APP_DEFAULT_DATE_FILTER`)
3. `npm install` + `npm run build`
4. Verifikasi `index.html`
5. Swap atomik ke `public/` (public lama diparkir, bisa rollback)
6. Tulis konfigurasi Nginx, `nginx -t`, reload

Konfigurasi Nginx yang dihasilkan:

```nginx
server {
    listen $FRONTEND_PORT;
    server_name $NGINX_SERVER_NAME;
    root "$APP_DIR/public";
    location / { try_files $uri $uri/ /index.html; }
    location /api { proxy_pass http://$SERVER_IP:$BACKEND_PORT; }
}
```

File: `/etc/nginx/sites-available/<NGINX_SITE_NAME>`,
symlink ke `/etc/nginx/sites-enabled/`.

Jika `nginx -t` gagal, file lama dikembalikan otomatis.

---

## 8. Log

```
/var/log/integra-commander/commander.log
/var/log/integra-commander/deploy-YYYYmmdd-HHMMSS.log
```

Log deploy berisi seluruh output `git`, `npm`, `pm2`, dan `nginx`.

---

## 9. Entry point lama

`install.sh` tetap ada. Menu 2 dan 3 sekarang diteruskan ke CLI:

- `mertrack-config.sh` → `commander.sh --settings`
- `mertrack-installer.sh` → `commander.sh --deploy`

`app-installer.sh` tidak berubah dan dipakai dari **Setting → Install dependencies**.

Cara lama (`.bashrc` export) tidak dipakai lagi. Konfigurasi sekarang terpusat di
`/etc/integra-commander/commander.conf`.

---

## 10. Troubleshooting

**`PM2 tidak ditemukan untuk user`**
PM2 belum ada di PATH user tersebut. Install sebagai user:
```bash
sudo -u <app_user> -i
npm install -g pm2
exit
```

**`permission denied` saat deploy**
Pastikan `APP_DIR` dimiliki `APP_USER`:
```bash
sudo chown -R <app_user>:<app_user> <APP_DIR>
```
Atau jalankan **Setting → 8) Buat struktur folder aplikasi**.

**`nginx -t` gagal**
Perubahan dibatalkan otomatis. Periksa backup:
```bash
ls /etc/nginx/sites-available/*.bak.*
```

**Clone gagal / autentikasi Git**
Masukkan username + password/token saat diminta. Untuk repo publik, kosongkan
username. Periksa juga `BACKEND_BRANCH` / `FRONTEND_BRANCH`.

**Port 80 bentrok**
Site `default` Nginx mungkin masih aktif. Disable lewat
**Nginx Management → 6) Enable / disable site**.

**Node/npm tidak ketemu saat deploy**
Pastikan `~/.bashrc` milik `APP_USER` memuat PATH Node (nvm/NodeSource).
Script menjalankan perintah sebagai user dengan `bash -ic`.

---

## 11. Catatan keamanan

- Config `600 root:root`; jangan menyalinnya ke lokasi publik.
- `.env` dibuat `600` milik `APP_USER`.
- Kredensial Git tidak disimpan di disk.
- Aplikasi sebaiknya tidak dijalankan sebagai `root` (`APP_USER` ≠ root).
- Batasi akses SSH dan gunakan user dengan `sudo` terbatas.
