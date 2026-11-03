#!/bin/bash

# 🔥 WAJIB root di awal
if [ "$EUID" -ne 0 ]; then
  echo "❌ Script ini harus dijalankan sebagai root"
  echo "Gunakan: sudo bash $0"
  exit 1
fi

# nvm + Node.js dipasang di HOME user asli (bukan root), karena pm2 & deploy
# dijalankan sebagai user tersebut lewat 'sudo -u <user> bash -ic'.
REAL_USER=${SUDO_USER:-$USER}
REAL_HOME=$(getent passwd "$REAL_USER" | cut -d: -f6)
NVM_VERSION="v0.40.8"
NODE_VERSION="22.23.4"

as_user() {
    # -H : HOME ikut ke user asli (cache nvm/npm tidak masuk /root)
    # -i : .bashrc dimuat, jadi fungsi nvm dari nvm tersedia
    sudo -u "$REAL_USER" -H bash -ic "$1"
}

while true; do
    clear
    echo "Pilih aplikasi yang ingin di-install:"
    echo "1) Postgres 17"
    echo "2) Git"
    echo "3) Node.js $NODE_VERSION via nvm (user: $REAL_USER)"
    echo "4) Nginx"
    echo "5) PM2"
    echo "6) 7z"
    echo "====================================="
    read -p "Masukkan pilihan: " CHOICE
    echo ""

    case $CHOICE in
        1)
            clear
            echo "===== PostgreSQL 17 ====="
            echo "1) Install"
            echo "2) Show User"
            echo "3) Show Database"
            echo "4) Create User"
            echo "5) Update Password"
            echo "6) Create Database"
            echo "7) Enable Remote Access"
            echo "8) DB Path"
            read -p "Pilih: " PG_CHOICE

            case $PG_CHOICE in
                1)
                    if command -v psql >/dev/null 2>&1; then
                        echo "⚠️ PostgreSQL sudah ada"
                        su - postgres -c "psql -V"
                    else
                        apt update -y
                        apt install -y wget ca-certificates

                        install -d /etc/apt/keyrings
                        wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc > /etc/apt/keyrings/postgres.asc

                        echo "deb [signed-by=/etc/apt/keyrings/postgres.asc] http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list

                        apt update
                        apt install -y postgresql-17

                        systemctl enable postgresql
                        systemctl start postgresql

                        echo "✅ PostgreSQL installed"
                    fi
                ;;

                2)
                    su - postgres -c "psql -c '\du'"
                ;;

                3)
                    su - postgres -c "psql -c '\l'"
                ;;

                4)
                    read -p "User: " USER
                    read -s -p "Password: " PASS
                    echo ""
                    su - postgres -c "psql -c \"CREATE USER $USER WITH PASSWORD '$PASS';\""
                ;;

                5)
                    read -p "User: " USER
                    read -s -p "Password baru: " PASS
                    echo ""
                    su - postgres -c "psql -c \"ALTER USER $USER WITH PASSWORD '$PASS';\""
                ;;

                6)
                    read -p "Nama DB: " DB
                    read -p "Owner: " OWNER
                    su - postgres -c "createdb -O $OWNER $DB"
                ;;

                7)
                    PG_CONF=$(su - postgres -c "psql -t -c 'SHOW config_file;'" | xargs dirname)/postgresql.conf
                    HBA_CONF=$(su - postgres -c "psql -t -c 'SHOW hba_file;'" | xargs)

                    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONF"

                    grep -q "0.0.0.0/0" "$HBA_CONF" || echo "host all all 0.0.0.0/0 md5" >> "$HBA_CONF"

                    systemctl restart postgresql
                    echo "✅ Remote access aktif"
                ;;

                8)
                    # Pindahkan data directory PostgreSQL ke lokasi lain (mis.
                    # disk terpisah). Folder lama tidak dihapus otomatis.
                    PG_MAJOR=17
                    PG_CONF="/etc/postgresql/$PG_MAJOR/main/postgresql.conf"
                    OLD_DATA="/var/lib/postgresql/$PG_MAJOR/main"

                    if [ ! -f "$PG_CONF" ]; then
                        echo "❌ Cluster PostgreSQL $PG_MAJOR tidak ditemukan. Install dulu (menu 1)."
                    else
                        CURRENT_DATA=$(grep -E "^data_directory" "$PG_CONF" | cut -d"'" -f2)
                        CURRENT_DATA=${CURRENT_DATA:-$OLD_DATA}
                        echo "Data directory sekarang: $CURRENT_DATA"
                        read -p "Lokasi data baru (kosong = batal): " NEW_DATA

                        if [ -n "$NEW_DATA" ]; then
                            echo "🛑 Menghentikan PostgreSQL..."
                            systemctl stop "postgresql@$PG_MAJOR-main"

                            mkdir -p "$NEW_DATA"
                            echo "📦 Menyalin data (bisa lama tergantung ukuran DB)..."
                            cp -a "$CURRENT_DATA/." "$NEW_DATA/"
                            chown -R postgres:postgres "$NEW_DATA"

                            if grep -q "^data_directory" "$PG_CONF"; then
                                sed -i "s|^data_directory.*|data_directory = '$NEW_DATA'|" "$PG_CONF"
                            else
                                echo "data_directory = '$NEW_DATA'" >> "$PG_CONF"
                            fi

                            mkdir -p "/etc/systemd/system/postgresql@$PG_MAJOR-main.service.d"
                            printf '[Service]\nReadWriteDirectories=%s\n' "$NEW_DATA" > "/etc/systemd/system/postgresql@$PG_MAJOR-main.service.d/override.conf"
                            systemctl daemon-reload

                            echo "▶️ Menjalankan PostgreSQL..."
                            systemctl start "postgresql@$PG_MAJOR-main"

                            echo "✅ Data directory berpindah ke: $NEW_DATA"
                            su - postgres -c "psql -t -c 'SHOW data_directory;'"
                            echo "⚠️ Folder lama BELUM dihapus. Setelah yakin semua normal:"
                            echo "   sudo rm -rf $CURRENT_DATA"
                        else
                            echo "❌ Dibatalkan."
                        fi
                    fi
                ;;
            esac

            read -p "Enter..."
        ;;

        2)
            if command -v git >/dev/null; then
                git --version
            else
                apt update -y
                apt install -y git
            fi
            read -p "Enter..."
        ;;

        3)
            echo "User target: $REAL_USER ($REAL_HOME)"
            if ! as_user "command -v nvm >/dev/null 2>&1"; then
                echo "📥 Menginstall nvm $NVM_VERSION..."
                apt update -y
                apt install -y curl
                if ! as_user "curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh | bash"; then
                    echo "❌ Gagal menginstall nvm untuk $REAL_USER"
                    read -p "Enter... "
                    continue
                fi
            fi
            # Tool build untuk kompilasi paket native (sqlite3, sharp, ssh2)
            echo "🧰 Install tool build (python3, make, g++)..."
            apt install -y python3 make g++
            echo "📦 Menginstall Node.js $NODE_VERSION (LTS)..."
            if as_user "nvm install $NODE_VERSION && nvm alias default $NODE_VERSION && nvm use $NODE_VERSION"; then
                as_user "node -v && npm -v"
                echo "✅ Node.js $NODE_VERSION aktif untuk $REAL_USER ($REAL_HOME/.nvm)"
            else
                echo "❌ Gagal menginstall Node.js $NODE_VERSION"
            fi
            if command -v node >/dev/null; then
                echo "ℹ️ Shell root masih melihat node $(node -v) dari apt/NodeSource."
                echo "   Bila mau seragam: sudo apt remove -y nodejs && sudo apt-mark unhold nodejs"
            fi
            read -p "Enter..."
        ;;

        4)
            if command -v nginx >/dev/null; then
                nginx -v
            else
                apt update -y
                apt install -y nginx
            fi
            read -p "Enter..."
        ;;

        5)
            # pm2 dipasang sebagai $REAL_USER, bukan root: node sekarang dari
            # nvm milik user itu, dan deploy memanggil 'pm2' lewat sudo -u.
            if as_user "command -v pm2 >/dev/null 2>&1"; then
                as_user "pm2 -v"
            else
                as_user "npm install -g pm2"
            fi
            read -p "Enter..."
        ;;

        6)
            if command -v 7z >/dev/null; then
                7z | head -n 2
            else
                apt update -y
                apt install -y p7zip-full
            fi
            read -p "Enter..."
        ;;

        *)
            exit 0
        ;;
    esac
done