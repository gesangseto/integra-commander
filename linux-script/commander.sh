#!/usr/bin/env bash
# Integra Commander CLI - entry point untuk Ubuntu Server.
# Jalankan: sudo ./commander.sh

set -o pipefail

CC_BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
export CC_BASE_DIR

# shellcheck source=lib/common.sh
. "$CC_BASE_DIR/lib/common.sh"
# shellcheck source=lib/deploy.sh
. "$CC_BASE_DIR/lib/deploy.sh"
# shellcheck source=modules/dashboard.sh
. "$CC_BASE_DIR/modules/dashboard.sh"
# shellcheck source=modules/settings.sh
. "$CC_BASE_DIR/modules/settings.sh"
# shellcheck source=modules/pm2.sh
. "$CC_BASE_DIR/modules/pm2.sh"
# shellcheck source=modules/nginx.sh
. "$CC_BASE_DIR/modules/nginx.sh"

usage() {
  cat <<EOF
Integra Commander CLI v${CC_VERSION} (Ubuntu Server)

Usage:
  sudo ./commander.sh [opsi]

Opsi:
  --dashboard   Buka Dashboard
  --settings    Buka Setting
  --pm2         Buka PM2 Management
  --nginx       Buka Nginx Management
  --deploy      Buka menu Deploy / Install
  -h, --help    Tampilkan bantuan

Tanpa opsi: menu utama interaktif.
Config: $CFG_FILE
Log   : $LOG_DIR
EOF
}

case "${1:-}" in
  -h | --help) usage; exit 0 ;;
esac

need_root

mkdir -p "$LOG_DIR" 2>/dev/null || true
chmod 755 "$LOG_DIR" 2>/dev/null || true

load_config

case "${1:-}" in
  --dashboard) dashboard_menu; exit 0 ;;
  --settings) settings_menu; exit 0 ;;
  --pm2) pm2_menu; exit 0 ;;
  --nginx) nginx_menu; exit 0 ;;
  --deploy) deploy_menu; exit 0 ;;
  "")
    ;;
  *)
    usage
    exit 1
    ;;
esac

while true; do
  load_config
  header "Main Menu"
  printf '  User   : %s\n' "$REAL_USER"
  printf '  App    : %s\n' "$APP_NAME"
  printf '  Folder : %s\n' "$APP_DIR"
  hr
  printf '  1) Dashboard\n'
  printf '  2) Setting\n'
  printf '  3) PM2 Management\n'
  printf '  4) Nginx Management\n'
  printf '  0) Keluar\n'
  hr
  read -rp "Pilih: " CHOICE || exit 0

  case "$CHOICE" in
    1) dashboard_menu ;;
    2) settings_menu ;;
    3) pm2_menu ;;
    4) nginx_menu ;;
    0) exit 0 ;;
    *) continue ;;
  esac
done
