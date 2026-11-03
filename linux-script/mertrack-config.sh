#!/bin/bash

# --- VALIDASI SUDO ---
if [ "$EUID" -ne 0 ]; then
    echo "❌ Error: Script ini harus dijalankan dengan sudo!"
    echo "Silakan jalankan: sudo $0"
    exit 1
fi

# Mengambil HOME dari user asli (bukan root)
# Agar config tersimpan di /home/user/.bashrc, bukan /root/.bashrc
REAL_USER=${SUDO_USER:-$USER}
REAL_HOME=$(getent passwd "$REAL_USER" | cut -d: -f6)
BASHRC="$REAL_HOME/.bashrc"

get_var_value() {
    local var_name=$1
    # Menggunakan grep yang lebih akurat
    grep -E "^export[[:space:]]+$var_name=" "$BASHRC" | cut -d'"' -f2
}

set_env() {
    local var=$1
    local val=$2
    # Hapus baris lama jika ada
    sed -i "/^export $var=/d" "$BASHRC"
    # Tambah baris baru
    echo "export $var=\"$val\"" >> "$BASHRC"
    # Export ke session saat ini (root)
    export "$var=$val"
    # Ubah kepemilikan kembali ke user asli agar bisa diedit nanti
    chown "$REAL_USER":"$REAL_USER" "$BASHRC"
}

# Satu baris menu supaya kolomnya selalu sejajar, apa pun panjang nilainya.
# $1 nomor  $2 label  $3 nilai yang ditampilkan (kosong = not set)
menu_row() {
    local filled=" "
    [ -n "$3" ] && filled="E"
    printf "  %2s [%s] %-15s : %s\n" "$1" "$filled" "$2" "${3:-not set}"
}

# Variable names
VAR_PATH="PATH_MERTRACK"
VAR_IP_BE="IP_MERTRACK_BE"
VAR_PORT_BE="PORT_MERTRACK_BE"
VAR_PORT_FE="PORT_MERTRACK_FE"
VAR_DATABASE_NAME="DATABASE_NAME"
VAR_DATABASE_USERNAME="DATABASE_USERNAME"
VAR_DATABASE_PASSWORD="DATABASE_PASSWORD"
VAR_DATABASE_DIALECT="DATABASE_DIALECT"
VAR_DATABASE_PORT="DATABASE_PORT"
VAR_APP_NAME="APP_NAME"
VAR_APP_TIMEZONE="APP_TIMEZONE"
VAR_APP_MODE="APP_MODE"
VAR_LOGIN_TIMEOUT="LOGIN_TIMEOUT"
VAR_BPOM_URL="BPOM_URL"
VAR_BPOM_EMAIL="BPOM_EMAIL"
VAR_BPOM_PASSWORD="BPOM_PASSWORD"
VAR_CONNECTOR_BPOM_NAME="CONNECTOR_BPOM_NAME"
VAR_CONNECTOR_BPOM="CONNECTOR_BPOM"
VAR_RANGE_TRANSACTION="RANGE_TRANSACTION"

while true; do
    # Ambil nilai terbaru
    VALUE_PATH=$(get_var_value "$VAR_PATH")
    VALUE_PORT_BE=$(get_var_value "$VAR_PORT_BE")
    VALUE_PORT_FE=$(get_var_value "$VAR_PORT_FE")
    VALUE_IP_BE=$(get_var_value "$VAR_IP_BE")
    VALUE_DATABASE_NAME=$(get_var_value "$VAR_DATABASE_NAME")
    VALUE_DATABASE_USERNAME=$(get_var_value "$VAR_DATABASE_USERNAME")
    VALUE_DATABASE_PASSWORD=$(get_var_value "$VAR_DATABASE_PASSWORD")
    VALUE_DATABASE_DIALECT=$(get_var_value "$VAR_DATABASE_DIALECT")
    VALUE_DATABASE_PORT=$(get_var_value "$VAR_DATABASE_PORT")
    VALUE_APP_NAME=$(get_var_value "$VAR_APP_NAME")
    VALUE_APP_TIMEZONE=$(get_var_value "$VAR_APP_TIMEZONE")
    VALUE_APP_MODE=$(get_var_value "$VAR_APP_MODE")
    VALUE_LOGIN_TIMEOUT=$(get_var_value "$VAR_LOGIN_TIMEOUT")
    VALUE_BPOM_URL=$(get_var_value "$VAR_BPOM_URL")
    VALUE_BPOM_EMAIL=$(get_var_value "$VAR_BPOM_EMAIL")
    VALUE_BPOM_PASSWORD=$(get_var_value "$VAR_BPOM_PASSWORD")
    VALUE_CONNECTOR_BPOM_NAME=$(get_var_value "$VAR_CONNECTOR_BPOM_NAME")
    VALUE_CONNECTOR_BPOM=$(get_var_value "$VAR_CONNECTOR_BPOM")
    VALUE_RANGE_TRANSACTION=$(get_var_value "$VAR_RANGE_TRANSACTION")

    clear
    echo "===== ⚙️ Configuration Mertrack (User: $REAL_USER) ====="
    echo "Config file: $BASHRC"
    echo "----------------------------------------------------"
    echo " Folder"
    menu_row 1 "Folder Mertrack" "$VALUE_PATH"
    echo " Jaringan"
    menu_row 2 "PORT Frontend" "$VALUE_PORT_FE"
    menu_row 3 "IP Backend" "$VALUE_IP_BE"
    menu_row 4 "PORT Backend" "$VALUE_PORT_BE"
    echo " Database"
    menu_row 5 "DB Name" "$VALUE_DATABASE_NAME"
    menu_row 6 "DB User" "$VALUE_DATABASE_USERNAME"
    menu_row 7 "DB Password" "${VALUE_DATABASE_PASSWORD:+[SET]}"
    menu_row 8 "DB Dialect" "$VALUE_DATABASE_DIALECT"
    menu_row 9 "DB Port" "$VALUE_DATABASE_PORT"
    echo " Aplikasi"
    menu_row 10 "App Name" "$VALUE_APP_NAME"
    menu_row 11 "App Timezone" "$VALUE_APP_TIMEZONE"
    menu_row 12 "App Mode" "$VALUE_APP_MODE"
    menu_row 13 "Login Timeout" "$VALUE_LOGIN_TIMEOUT"
    echo " BPOM / Connector"
    menu_row 14 "BPOM URL" "$VALUE_BPOM_URL"
    menu_row 15 "BPOM Email" "$VALUE_BPOM_EMAIL"
    menu_row 16 "BPOM Password" "${VALUE_BPOM_PASSWORD:+[SET]}"
    menu_row 17 "Connector Name" "$VALUE_CONNECTOR_BPOM_NAME"
    menu_row 18 "Connector Port" "$VALUE_CONNECTOR_BPOM"
    echo " Lainnya"
    menu_row 19 "Date Filter" "$VALUE_RANGE_TRANSACTION"
    echo "----------------------------------------------------"
    echo " [E] = sudah terisi. Enter pada prompt = nilai lama dipertahankan."
    echo " Tombol lain = kembali ke menu utama."
    read -p "Masukkan pilihan: " CHOICE

    case $CHOICE in
        1)
            DEFAULT_PATH=${VALUE_PATH:-"$REAL_HOME/mertrack"}
            read -p "Folder Mertrack (default: $DEFAULT_PATH): " INPUT
            VALUE=${INPUT:-$DEFAULT_PATH}

            set_env "$VAR_PATH" "$VALUE"

            # Buat folder dengan izin user asli agar tidak error permission nantinya
            mkdir -p "$VALUE"/{cmd/v4.2,services,public,temp,log,resources/{ico,img}}
            chown -R "$REAL_USER":"$REAL_USER" "$VALUE"
            chmod -R 755 "$VALUE"

            echo "✅ PATH diset dan struktur folder dibuat."
        ;;

        2)
            DEFAULT=${VALUE_PORT_FE:-8000}
            read -p "PORT Frontend (default: $DEFAULT): " INPUT
            set_env "$VAR_PORT_FE" "${INPUT:-$DEFAULT}"
        ;;

        3)
            DEFAULT=${VALUE_IP_BE:-$(hostname -I | awk '{print $1}')}
            read -p "IP Backend (default: $DEFAULT): " INPUT
            set_env "$VAR_IP_BE" "${INPUT:-$DEFAULT}"
        ;;

        4)
            DEFAULT=${VALUE_PORT_BE:-8001}
            read -p "PORT Backend (default: $DEFAULT): " INPUT
            set_env "$VAR_PORT_BE" "${INPUT:-$DEFAULT}"
        ;;

        5)
            DEFAULT=${VALUE_DATABASE_NAME:-mertrack}
            read -p "Database Name (default: $DEFAULT): " INPUT
            set_env "$VAR_DATABASE_NAME" "${INPUT:-$DEFAULT}"
        ;;

        6)
            DEFAULT=${VALUE_DATABASE_USERNAME:-$REAL_USER}
            read -p "Database Username (default: $DEFAULT): " INPUT
            set_env "$VAR_DATABASE_USERNAME" "${INPUT:-$DEFAULT}"
        ;;

        7)
            # Enter tanpa isi = password lama tetap dipakai (tidak tertimpa kosong)
            if [ -n "$VALUE_DATABASE_PASSWORD" ]; then
                read -s -p "Database Password (kosong = pertahankan yang lama): " INPUT
            else
                read -s -p "Database Password (input tidak terlihat): " INPUT
            fi
            echo ""
            VALUE=${INPUT:-$VALUE_DATABASE_PASSWORD}
            if [ -z "$VALUE" ]; then
                echo "⚠️ Password kosong, tidak ada yang diubah."
            else
                set_env "$VAR_DATABASE_PASSWORD" "$VALUE"
                echo "✅ Password tersimpan."
            fi
        ;;
         
        8)
            DEFAULT=${VALUE_DATABASE_DIALECT:-mssql}
            read -p "Database Dialect (mssql/postgres, default: $DEFAULT): " INPUT
            set_env "$VAR_DATABASE_DIALECT" "${INPUT:-$DEFAULT}"
        ;;

        9)
            DEFAULT=${VALUE_DATABASE_PORT:-1433}
            read -p "Database Port (default: $DEFAULT): " INPUT
            set_env "$VAR_DATABASE_PORT" "${INPUT:-$DEFAULT}"
        ;;

        10)
            DEFAULT=${VALUE_APP_NAME:-API_CORE_MERTRACK}
            read -p "App Name / nama proses PM2 (default: $DEFAULT): " INPUT
            set_env "$VAR_APP_NAME" "${INPUT:-$DEFAULT}"
        ;;

        11)
            DEFAULT=${VALUE_APP_TIMEZONE:-Asia/Jakarta}
            read -p "App Timezone (default: $DEFAULT): " INPUT
            set_env "$VAR_APP_TIMEZONE" "${INPUT:-$DEFAULT}"
        ;;

        12)
            DEFAULT=${VALUE_APP_MODE:-development}
            read -p "App Mode (development/production, default: $DEFAULT): " INPUT
            VALUE=${INPUT:-$DEFAULT}
            case "$VALUE" in
                development|production)
                    set_env "$VAR_APP_MODE" "$VALUE"
                ;;
                *)
                    echo "❌ App Mode hanya boleh development atau production: $VALUE"
                ;;
            esac
        ;;

        13)
            DEFAULT=${VALUE_LOGIN_TIMEOUT:-15}
            read -p "Login Timeout menit (default: $DEFAULT): " INPUT
            VALUE=${INPUT:-$DEFAULT}
            if [ "$VALUE" -eq "$VALUE" ] 2>/dev/null && [ "$VALUE" -ge 1 ]; then
                set_env "$VAR_LOGIN_TIMEOUT" "$VALUE"
            else
                echo "❌ Login Timeout harus angka positif: $VALUE"
            fi
        ;;

        14)
            DEFAULT=${VALUE_BPOM_URL:-https://ttacdev.pom.go.id/dev/public/api/v3/}
            read -p "BPOM URL (default: $DEFAULT): " INPUT
            set_env "$VAR_BPOM_URL" "${INPUT:-$DEFAULT}"
        ;;

        15)
            read -p "BPOM Email (kosong = tidak dipakai, default: ${VALUE_BPOM_EMAIL:-kosong}): " INPUT
            set_env "$VAR_BPOM_EMAIL" "${INPUT:-$VALUE_BPOM_EMAIL}"
        ;;

        16)
            if [ -n "$VALUE_BPOM_PASSWORD" ]; then
                read -s -p "BPOM Password (kosong = pertahankan yang lama): " INPUT
            else
                read -s -p "BPOM Password (input tidak terlihat): " INPUT
            fi
            echo ""
            VALUE=${INPUT:-$VALUE_BPOM_PASSWORD}
            if [ -z "$VALUE" ]; then
                echo "⚠️ Password kosong, tidak ada yang diubah."
            else
                set_env "$VAR_BPOM_PASSWORD" "$VALUE"
                echo "✅ Password tersimpan."
            fi
        ;;

        17)
            read -p "Connector BPOM Name (default: ${VALUE_CONNECTOR_BPOM_NAME:-API_BPOM_MERTRACK}): " INPUT
            VALUE=${INPUT:-${VALUE_CONNECTOR_BPOM_NAME:-API_BPOM_MERTRACK}}
            set_env "$VAR_CONNECTOR_BPOM_NAME" "$VALUE"
        ;;

        18)
            read -p "Connector BPOM Port (kosong = belum dipakai, default: ${VALUE_CONNECTOR_BPOM:-kosong}): " INPUT
            VALUE=${INPUT:-$VALUE_CONNECTOR_BPOM}
            if [ -z "$VALUE" ] || printf '%s' "$VALUE" | grep -Eq '^[0-9]{1,5}$'; then
                set_env "$VAR_CONNECTOR_BPOM" "$VALUE"
            else
                echo "❌ Connector Port harus angka 0-65535 atau kosong: $VALUE"
            fi
        ;;

        19)
            DEFAULT=${VALUE_RANGE_TRANSACTION:-last_1_week}
            read -p "Default Date Filter (default: $DEFAULT): " INPUT
            set_env "$VAR_RANGE_TRANSACTION" "${INPUT:-$DEFAULT}"
        ;;

        *)
            echo "👋 Kembali ke menu utama..."
            exit 0
        ;;
    esac

    echo ""
    read -p "Tekan Enter untuk lanjut..."
done
