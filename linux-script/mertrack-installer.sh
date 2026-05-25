#!/bin/bash

# --- VALIDASI SUDO ---
if [ "$EUID" -ne 0 ]; then
    echo "❌ Error: Script ini harus dijalankan dengan sudo!"
    echo "Silakan jalankan: sudo $0"
    exit 1
fi

# Identitas User Asli
REAL_USER=${SUDO_USER:-$USER}
REAL_HOME=$(getent passwd "$REAL_USER" | cut -d: -f6)
BASHRC="$REAL_HOME/.bashrc"

# Fungsi ambil value dari .bashrc user asli
get_var_value() {
    local var_name=$1
    grep -E "^export[[:space:]]+$var_name=" "$BASHRC" | cut -d'"' -f2
}

# Load ENV
PATH_MERTRACK=$(get_var_value "PATH_MERTRACK")
PORT_MERTRACK_BE=$(get_var_value "PORT_MERTRACK_BE")
PORT_MERTRACK_FE=$(get_var_value "PORT_MERTRACK_FE")
IP_MERTRACK_BE=$(get_var_value "IP_MERTRACK_BE")
DATABASE_NAME=$(get_var_value "DATABASE_NAME")
DATABASE_USERNAME=$(get_var_value "DATABASE_USERNAME")
DATABASE_PASSWORD=$(get_var_value "DATABASE_PASSWORD")

APP_NAME="API_CORE_MERTRACK"

# Validasi PATH
if [ -z "$PATH_MERTRACK" ]; then
    echo "❌ Error: PATH_MERTRACK tidak ditemukan di $BASHRC"
    echo "Jalankan script configuration dulu!"
    exit 1
fi

# Helper untuk menjalankan perintah sebagai user asli
as_user() {
    # Flag -i memastikan .bashrc/.profile di-load
    sudo -u "$REAL_USER" bash -i -c "$1"
}

update_env_backend() {
    local ENV_FILE="$1"
    echo "🔧 Updating .env: $ENV_FILE"

    # Pastikan file ada agar tidak error saat sed
    touch "$ENV_FILE"

    # Fungsi pembantu untuk update atau insert
    update_or_append() {
        local key=$1
        local value=$2
        if grep -q "^$key=" "$ENV_FILE"; then
            # Jika kunci ada, replace nilainya
            sed -i "s|^$key=.*|$key=$value|" "$ENV_FILE"
        else
            # Jika kunci tidak ada, tambah ke baris baru
            echo "$key=$value" >> "$ENV_FILE"
        fi
    }

    # Jalankan update untuk masing-masing variabel
    update_or_append "APP_PORT" "$PORT_MERTRACK_BE"
    update_or_append "DB_DATABASE" "$DATABASE_NAME"
    update_or_append "DB_USER" "$DATABASE_USERNAME"
    update_or_append "DB_PASSWORD" "$DATABASE_PASSWORD"
    update_or_append "NODE_ENV" "production"
    
    # Tambahkan DB_HOST jika Sequelize masih minta (opsional tapi disarankan)
    update_or_append "DB_HOST" "127.0.0.1"

    chown "$REAL_USER":"$REAL_USER" "$ENV_FILE"
}

update_env_frontend() {
    local ENV_FILE="$1"
    echo "🔧 Updating .env: $ENV_FILE"
    # Pastikan file ada agar tidak error saat sed
    touch "$ENV_FILE"
    # Fungsi pembantu untuk update atau insert
    update_or_append() {
        local key=$1
        local value=$2
        # Kita tambahkan tanda petik pada value saat proses penulisan
        local quoted_value="\"$value\""
        if grep -q "^$key=" "$ENV_FILE"; then
            # Jika kunci ada, ganti seluruh baris dengan format key="value"
            # Kita menggunakan delimiter | agar karakter / dalam URL tidak mengganggu sed
            sed -i "s|^$key=.*|$key=$quoted_value|" "$ENV_FILE"
            echo "✅ Updated: $key=$quoted_value"
        else
            # Jika kunci tidak ada, tambahkan baris baru dengan format key="value"
            echo "$key=$quoted_value" >> "$ENV_FILE"
            echo "✨ Added: $key=$quoted_value"
        fi
    }
    # Jalankan update untuk masing-masing variabel
    update_or_append "VUE_APP_URL_API_MERTRACK" "http://$IP_MERTRACK_BE:$PORT_MERTRACK_BE"
    chown "$REAL_USER":"$REAL_USER" "$ENV_FILE"
}

start_or_reload_pm2() {
    local TARGET_DIR="$1"
    echo "🚀 Managing PM2 for $REAL_USER..."
    # Masuk ke folder target secara eksplisit sebelum menjalankan PM2
    # Ini mencegah error 'no such file or directory, uv_cwd'
    as_user "cd '$TARGET_DIR' && pm2 describe $APP_NAME > /dev/null 2>&1 && pm2 reload $APP_NAME --update-env || pm2 start API_CORE_MERTRACK.js --name $APP_NAME -i max"
    # Kembali ke base dir agar aman
    cd "$PATH_MERTRACK" || exit
    as_user "pm2 save"
}

# --- MENU UTAMA ---
while true; do
    clear
    echo "===== ⚙️ Mertrack Installer (User: $REAL_USER) ====="
    echo "PATH: $PATH_MERTRACK"
    echo "1) Reload Mertrack (PM2)"
    echo "2) Install Backend + Seed (Fresh Install)"
    echo "3) Install Backend (Update Only)"
    echo "4) Install Frontend (Vue Build)"
    echo "5) Setup PM2 Log Rotate"
    echo "6) Setup PM2 Auto Startup"
    echo "================================"
    read -p "Pilih: " CHOICE

    case "$CHOICE" in
        1)
            start_or_reload_pm2 "$PATH_MERTRACK/integra_v4.2/services"
        ;;

        2|3)
            TMP="$PATH_MERTRACK/integra_v4.2/temp/core"
            DEST="$PATH_MERTRACK/integra_v4.2/services"

            # PERBAIKAN: Pindah ke folder aman sebelum hapus-hapus folder
            cd "$PATH_MERTRACK" || exit

            rm -rf "$TMP" "$DEST"
            mkdir -p "$TMP" "$DEST"
            chown -R "$REAL_USER":"$REAL_USER" "$PATH_MERTRACK"

            echo "📥 Cloning Repository..."
            as_user "git clone --depth 1 https://gitlab.com/mertrack/mertrack-core '$TMP'"
            
            # Gunakan cd di dalam subshell (as_user) saja
            echo "📦 Installing Dependencies..."
            as_user "cd '$TMP' && npm install"

            update_env_backend "$TMP/.env"

            if [ "$CHOICE" == "2" ]; then
                echo "🌱 Database Seeding..."
                as_user "cd '$TMP' && npx sequelize-cli db:seed:all"
            fi

            echo "🏗️ Building Project..."
            as_user "cd '$TMP' && npm run build"

            # Copy file
            cp -r "$TMP"/build/* "$DEST/"
            cp -r "$TMP"/node_modules "$DEST/"
            cp "$TMP"/.env "$DEST/"
            chown -R "$REAL_USER":"$REAL_USER" "$DEST"

            # Hapus temp setelah selesai, tapi pastikan kita tidak di dalamnya
            cd "$PATH_MERTRACK" || exit
            rm -rf "$TMP"
            
            start_or_reload_pm2 "$DEST"
        ;;

        4)              
            TMP_FE="$PATH_MERTRACK/integra_v4.2/temp/frontend"
            # Hasil build berada di temp/public (sejajar dengan temp/frontend)
            TMP_BUILD_RESULT="$PATH_MERTRACK/integra_v4.2/temp/public"
            DEST_PUBLIC="$PATH_MERTRACK/integra_v4.2/public"
            NGINX_CONF="/etc/nginx/sites-available/mertrack_frontend"

            # 1. Persiapan Folder
            cd "$PATH_MERTRACK" || exit
            rm -rf "$TMP_FE" "$TMP_BUILD_RESULT" "$DEST_PUBLIC"
            mkdir -p "$TMP_FE" "$DEST_PUBLIC"
            chown -R "$REAL_USER":"$REAL_USER" "$PATH_MERTRACK/integra_v4.2/temp" "$DEST_PUBLIC"

            # 2. Clone & Build
            echo "📥 Cloning Frontend Repository..."
            as_user "git clone --depth 1 https://gitlab.com/mertrack/mertrack_frontend '$TMP_FE'"
            # Update env file sebelum build
            update_env_frontend "$TMP_FE/.env"

            echo "📦 Building Frontend (NPM)..."
            # Gunakan 'bash -i -c' agar memuat environment (nvm/node) user asli
            # Tambahkan 'npm cache clean --force' untuk memastikan build benar-benar fresh
            if as_user "cd '$TMP_FE' && npm cache clean --force && rm -rf node_modules package-lock.json && npm install && npm run build"; then
                echo "✅ Build selesai."
                # ... (lanjutkan ke step pemindahan)
                # 3. Pindahkan Hasil Build dari temp/public ke integra_v4.2/public
                if [ -d "$TMP_BUILD_RESULT" ]; then
                    echo "🚚 Memindahkan hasil build dari $TMP_BUILD_RESULT ke $DEST_PUBLIC"
                    cp -r "$TMP_BUILD_RESULT/." "$DEST_PUBLIC/"
                    echo "✅ File berhasil dipindahkan."
                else
                    echo "❌ Error: Folder hasil build '$TMP_BUILD_RESULT' tidak ditemukan!"
                    exit 1
                fi
            else
                echo "❌ Error: Build npm gagal!"
                exit 1
            fi

            # 4. Atur Izin Akses Nginx
            chmod +x "$PATH_MERTRACK"
            chmod +x "$PATH_MERTRACK/integra_v4.2"
            chmod +x "$DEST_PUBLIC"
            chown -R "$REAL_USER":www-data "$DEST_PUBLIC"
            find "$DEST_PUBLIC" -type d -exec chmod 755 {} +
            find "$DEST_PUBLIC" -type f -exec chmod 644 {} +

            # Bersihkan Temp
            rm -rf "$TMP_FE" "$TMP_BUILD_RESULT"

            # 5. Konfigurasi Nginx
            echo "🌐 Mengupdate Konfigurasi Nginx..."
cat <<EOF > "$NGINX_CONF"
server {
    listen $PORT_MERTRACK_FE;
    server_name _;

    root $DEST_PUBLIC;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://$IP_MERTRACK_BE:$PORT_MERTRACK_BE;
    }

    error_log  /var/log/nginx/mertrack_error.log;
    access_log /var/log/nginx/mertrack_access.log;
}
EOF

            ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/"
            [ "$PORT_MERTRACK_FE" == "80" ] && rm -f /etc/nginx/sites-enabled/default
            
            nginx -t && systemctl restart nginx
            echo "✅ Selesai! Akses di http://localhost:$PORT_MERTRACK_FE"
        ;;



        5)
            as_user "pm2 install pm2-logrotate"
            as_user "pm2 set pm2-logrotate:max_size 10M"
            as_user "pm2 set pm2-logrotate:retain 7"
            ;;

        6)
            # Startup harus dijalankan sebagai root perintah aslinya
            STARTUP_CMD=$(sudo -u "$REAL_USER" pm2 startup | grep "sudo env")
            if [ -n "$STARTUP_CMD" ]; then
                eval "$STARTUP_CMD"
                as_user "pm2 save"
                echo "✅ Startup enabled"
            fi
            ;;

        *) exit 0 ;;
    esac
    read -p "Tekan Enter untuk lanjut..."
done
