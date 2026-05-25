username: merindo
password: mmDS8899

**Jika ada error "Permission denied" saat eksekusi maka tambahkan 'sudo' pada awal command,
** e.g. shotdown now -> sudo shutdown now

Show IP & Mac address:
$ ip a

Shutdown:
$ shutdown now

Restart:
$ reboot

Lihat isi folder:
$ ls

Lihat Current directory:
$ pwd

Buat Folder:
$ mkdir nama_folder

Hapus Folder:
$ rmdir nama_folder

Hapus Folder paksa (beserta isi):
$ rm -rf nama_folder

Membuat file .sh agar bisa diexekusi:
$ chmod +x ./nama_file.sh

Exekusi file:
./nama_file.sh

Install paket/aplikasi:
$ apt install nama_aplikasi

Uninstall paket/aplikasi:
$ apt remove nama_aplikasi

Uninstall paket/aplikasi (hapus aplikasi + konfigurasi):
$ apt purge nama_aplikasi

Hapus dependensi yang tidak terpakai:
$ apt autoremove

Mengambil daftar paket terbaru dari repository (tidak meng-install apa pun)
$ apt update

Meng-update paket yang sudah terinstall ke versi terbaru berdasarkan hasil apt update
$ apt upgrade

\*\* Jika ada permission denied terkait baca, tulis, eksekusi pada folder tertentu maka silahkan mengatur permission
Mengatur permission pada folder:
$ chmod 754 nama_folder

7 -> rwx
6 -> rw-
5 -> r-x
4 -> r--
0 -> ---

arti dari "754" adalah:
7 (rwx) 5(r-x) 4(r--)
↑ ↑ ↑
| | |
| | └── others
| └────── group
└────────── owner
r = read, w = write, x = execute, - = no access

Jalankan aplikasi (service):
$ sudo systemctl start nama_service

Lihat status aplikasi (service):
$ sudo systemctl status nama_service

Stop aplikasi (service):
$ sudo systemctl stop nama_service
