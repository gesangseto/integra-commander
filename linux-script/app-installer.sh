#!/bin/bash

# 🔥 WAJIB root di awal
if [ "$EUID" -ne 0 ]; then
  echo "❌ Script ini harus dijalankan sebagai root"
  echo "Gunakan: sudo bash $0"
  exit 1
fi

while true; do
    clear
    echo "Pilih aplikasi yang ingin di-install:"
    echo "1) Postgres 17"
    echo "2) Git"
    echo "3) Node.js 20"
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
            if command -v node >/dev/null; then
                echo "⚠️ Node.js sudah terinstall: $(node -v)"
            else
                echo "Installing Node.js 20.19.4..."
                apt update -y
                apt install -y curl
                
                # Mengambil installer NodeSource untuk Major Version 20
                curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
                
                # Menginstal versi spesifik menggunakan apt
                apt install -y nodejs=20.19.4-1nodesource1
                
                # Mencegah nodejs terupdate otomatis ke versi 20.x yang lebih baru
                apt-mark hold nodejs
                
                echo "✅ Node.js $(node -v) installed"
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
            if command -v pm2 >/dev/null; then
                pm2 -v
            else
                npm install -g pm2
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