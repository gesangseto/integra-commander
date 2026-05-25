#!/bin/bash

# --- VALIDASI SUDO ---
# Mengecek apakah script dijalankan oleh root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Error: Script ini harus dijalankan dengan sudo!"
    echo "Silakan jalankan: sudo ./install.sh"
    exit 1
fi

# Mendapatkan direktori absolut dari script ini
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"

while true; do
    clear
    echo "===== 🚀 Mertrack Manager (ROOT) ====="
    echo "1) Application Installer"
    echo "2) Mertrack Configuration"
    echo "3) Mertrack Installer"
    echo "4) Clear History Session"
    echo "====================================="
    echo "Tekan tombol lain untuk keluar"
    echo "====================================="
    read -p "Masukkan pilihan: " CHOICE
    echo ""

    case $CHOICE in
        1)
            SCRIPT="$BASE_DIR/app-installer.sh"
        ;;
        2)
            SCRIPT="$BASE_DIR/mertrack-config.sh"
        ;;
        3)
            SCRIPT="$BASE_DIR/mertrack-installer.sh"
        ;;
        4)
            # Menghapus history terminal untuk user root dan user asli
            history -c
            rm -f ~/.bash_history
            echo "✅ History berhasil dihapus."
            sleep 2
            continue
        ;;
        *)
            echo "❌ Keluar"
            exit 0
        ;;
    esac

    # Validasi file
    if [ ! -f "$SCRIPT" ]; then
        echo "❌ File tidak ditemukan: $SCRIPT"
        sleep 2
        continue
    fi

    # Pastikan executable
    if [ ! -x "$SCRIPT" ]; then
        chmod +x "$SCRIPT"
    fi

    echo "🚀 Menjalankan $(basename "$SCRIPT")..."
    # Menjalankan script anak
    "$SCRIPT"

    echo ""
    read -p "Tekan ENTER untuk kembali ke menu..."
done
