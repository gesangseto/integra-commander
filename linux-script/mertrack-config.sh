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

    clear
    echo "===== ⚙️ Configuration Mertrack (User: $REAL_USER) ====="
    echo "Config file: $BASHRC"
    echo "----------------------------------------------------"
    echo "1) ${VALUE_PATH:+Edit} Folder Mertrack     : ${VALUE_PATH:-not set}"
    echo "2) ${VALUE_PORT_FE:+Edit} PORT Frontend       : ${VALUE_PORT_FE:-not set}"
    echo "3) ${VALUE_IP_BE:+Edit} IP Backend         : ${VALUE_IP_BE:-not set}"
    echo "4) ${VALUE_PORT_BE:+Edit} PORT Backend        : ${VALUE_PORT_BE:-not set}"
    echo "5) ${VALUE_DATABASE_NAME:+Edit} DB Name            : ${VALUE_DATABASE_NAME:-not set}"
    echo "6) ${VALUE_DATABASE_USERNAME:+Edit} DB User            : ${VALUE_DATABASE_USERNAME:-not set}"
    echo "7) ${VALUE_DATABASE_PASSWORD:+Edit} DB Password        : ${VALUE_DATABASE_PASSWORD:+[SET]}"
    echo "8) ${VALUE_DATABASE_DIALECT:+Edit} DB Dialect         : ${VALUE_DATABASE_DIALECT:-not set}"
    echo "9) ${VALUE_DATABASE_PORT:+Edit} DB Port            : ${VALUE_DATABASE_PORT:-not set}"
    echo "===================================================="
    echo "Tekan tombol lain untuk kembali/keluar"
    read -p "Masukkan pilihan: " CHOICE

    case $CHOICE in
        1)
            DEFAULT_PATH=${VALUE_PATH:-"$REAL_HOME/mertrack"}
            read -p "Path folder (default: $DEFAULT_PATH): " INPUT
            VALUE=${INPUT:-$DEFAULT_PATH}

            set_env "$VAR_PATH" "$VALUE"

            # Buat folder dengan izin user asli agar tidak error permission nantinya
            mkdir -p "$VALUE"/{cmd/v4.2,integra_v4.2/{services,temp,public},log,resources/{ico,img}}
            chown -R "$REAL_USER":"$REAL_USER" "$VALUE"
            chmod -R 755 "$VALUE"
            chmod -R 775 "$VALUE/integra_v4.2"

            echo "✅ PATH diset dan struktur folder dibuat."
        ;;

        2)
            DEFAULT=${VALUE_PORT_FE:-8000}
            read -p "PORT Frontend: " INPUT
            set_env "$VAR_PORT_FE" "${INPUT:-$DEFAULT}"
        ;;

        3)
            DEFAULT=${VALUE_IP_BE:-$(hostname -I | awk '{print $1}')}
            read -p "IP Backend: " INPUT
            set_env "$VAR_IP_BE" "${INPUT:-$DEFAULT}"
        ;;

        4)
            DEFAULT=${VALUE_PORT_BE:-8001}
            read -p "PORT Backend: " INPUT
            set_env "$VAR_PORT_BE" "${INPUT:-$DEFAULT}"
        ;;

        5)
            read -p "Database Name: " VALUE
            set_env "$VAR_DATABASE_NAME" "$VALUE"
        ;;

        6)
            read -p "Database Username: " VALUE
            set_env "$VAR_DATABASE_USERNAME" "$VALUE"
        ;;

        7)
            read -s -p "Database Password (input tidak terlihat): " VALUE
            echo ""
            set_env "$VAR_DATABASE_PASSWORD" "$VALUE"
            echo "✅ Password tersimpan."
        ;;
         
        8)
            DEFAULT=${VALUE_DATABASE_DIALECT:-mssql}
            read -p "Database Dialect (mssql/postgres): " INPUT
            set_env "$VAR_DATABASE_DIALECT" "${INPUT:-$DEFAULT}"
        ;;

        9)
            DEFAULT=${VALUE_DATABASE_PORT:-1433}
            read -p "Database Port: " INPUT
            set_env "$VAR_DATABASE_PORT" "${INPUT:-$DEFAULT}"
        ;;

        *)
            echo "👋 Kembali ke menu utama..."
            exit 0
        ;;
    esac

    echo ""
    read -p "Tekan Enter untuk lanjut..."
done
