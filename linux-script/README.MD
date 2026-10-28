# Integra Commander — Ubuntu Server (CLI)

Versi terminal dari Integra Commander. Tanpa tampilan/GUI — semua lewat menu CLI.

Dokumentasi lengkap: **[README-COMMANDER.md](README-COMMANDER.md)**

---

## Remote ke Ubuntu Server

1. Pastikan server sudah power-on.
2. Buka MobaXTerm → **Session → Start new session**.
3. Pilih tab **SSH**.
4. Isi **Remote host** dengan IP server Ubuntu.

---

## Instalasi cepat

1. Copy **seluruh folder** `linux-script` ke server, mis. `/home/merindo/integra-commander`.
2. Masuk ke folder tersebut dan beri izin eksekusi:
   ```bash
   cd /home/merindo/integra-commander
   chmod +x *.sh
   ```
3. Jalankan:
   ```bash
   sudo ./commander.sh
   ```

Menu utama: **Dashboard**, **Setting**, **PM2 Management**, **Nginx Management**.

Pasang dependensi (Git, Node.js, Nginx, PM2, PostgreSQL) dari
**Setting → 7) Install dependencies**.

---

## Entry point lama

`install.sh` tetap ada dan masih berfungsi:

- `install.sh` → menu lama (installer paket, configuration, installer)
- `mertrack-config.sh` → diteruskan ke **Setting**
- `mertrack-installer.sh` → diteruskan ke **Deploy / Install**
- `app-installer.sh` → dipakai dari **Setting → Install dependencies**

Konfigurasi sekarang terpusat di `/etc/integra-commander/commander.conf`
(tidak lagi memakai `export` di `~/.bashrc`).

---

## Catatan

- Script Bash **wajib LF**, bukan CRLF. Jika diedit di Windows, simpan dengan
  line ending LF.
- Log: `/var/log/integra-commander/`.
- Referensi perintah Ubuntu: [Ubuntu-Command.MD](Ubuntu-Command.MD).
