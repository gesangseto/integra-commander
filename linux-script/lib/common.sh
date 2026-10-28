#!/usr/bin/env bash
# Integra Commander CLI (Ubuntu Server) - shared library.
# File ini di-source oleh commander.sh dan seluruh modul.
# Semua operasi membutuhkan root (sudo).

if [ -n "${CC_COMMON_LOADED:-}" ]; then
  return 0
fi
CC_COMMON_LOADED=1

set -o pipefail

CC_VERSION="1.0.0"
CC_BASE_DIR="${CC_BASE_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
CFG_DIR="${CFG_DIR:-/etc/integra-commander}"
CFG_FILE="${CFG_FILE:-$CFG_DIR/commander.conf}"
LOG_DIR="${LOG_DIR:-/var/log/integra-commander}"

# ============================================================
# TAMPILAN
# ============================================================
if [ -t 1 ]; then
  C_RESET=$'\033[0m'
  C_BOLD=$'\033[1m'
  C_DIM=$'\033[2m'
  C_RED=$'\033[31m'
  C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'
  C_BLUE=$'\033[34m'
  C_MAGENTA=$'\033[35m'
  C_CYAN=$'\033[36m'
else
  C_RESET='' C_BOLD='' C_DIM='' C_RED='' C_GREEN=''
  C_YELLOW='' C_BLUE='' C_MAGENTA='' C_CYAN=''
fi

hr() { printf '%s\n' "────────────────────────────────────────────────────────────"; }

header() {
  [ -t 1 ] && clear
  printf '%s\n' "${C_BOLD}${C_CYAN}INTEGRA COMMANDER${C_RESET} ${C_DIM}v${CC_VERSION}${C_RESET}  ${C_BOLD}$*${C_RESET}"
  hr
}

section() { printf '\n%s\n' "${C_BOLD}${C_BLUE}$*${C_RESET}"; }
ok()   { printf '%s %s\n' "${C_GREEN}✔${C_RESET}" "$*"; }
warn() { printf '%s %s\n' "${C_YELLOW}!${C_RESET}" "$*" >&2; }
err()  { printf '%s %s\n' "${C_RED}✖${C_RESET}" "$*" >&2; }
die()  { err "$*"; exit 1; }

need_root() {
  [ "${EUID:-$(id -u)}" -eq 0 ] || die "Jalankan dengan sudo: sudo $0"
}

have() { command -v "$1" >/dev/null 2>&1; }

pause() {
  printf '\n'
  read -rp "Tekan ENTER untuk melanjutkan..." _ || true
}

confirm() {
  local ans
  read -rp "${1:-Lanjutkan?} [y/N]: " ans || return 1
  [[ "$ans" =~ ^[yY]$ ]]
}

ask() {
  local __var="$1" label="$2" def="${3-}" input
  if [ -n "$def" ]; then
    read -rp "$label [$def]: " input || true
  else
    read -rp "$label: " input || true
  fi
  printf -v "$__var" '%s' "${input:-$def}"
}

ask_secret() {
  local __var="$1" label="$2" input
  read -rsp "$label: " input || true
  printf '\n'
  printf -v "$__var" '%s' "$input"
}

mask_secret() {
  if [ -n "${1:-}" ]; then
    printf '********'
  else
    printf '(kosong)'
  fi
}

# ============================================================
# LOG
# ============================================================
cc_log() {
  mkdir -p "$LOG_DIR" 2>/dev/null || true
  printf '%s %s\n' "$(date '+%F %T')" "$*" >>"$LOG_DIR/commander.log" 2>/dev/null || true
}

# ============================================================
# KONFIGURASI
# ============================================================
detect_ip() { hostname -I 2>/dev/null | awk '{print $1}'; }

_load_defaults() {
  APP_NAME="API_CORE_MERTRACK"
  APP_USER=""
  APP_DIR=""
  SERVER_IP=""
  APP_TIMEZONE="Asia/Jakarta"
  APP_MODE="production"
  LOGIN_TIMEOUT="15"
  RANGE_TRANSACTION="last_1_week"

  BACKEND_PORT="8001"
  BACKEND_BRANCH=""
  FRONTEND_PORT="8000"
  FRONTEND_BRANCH=""

  DB_DIALECT="postgres"
  DB_HOST="127.0.0.1"
  DB_PORT=""
  DB_NAME=""
  DB_USER=""
  DB_PASSWORD=""

  BPOM_URL="https://ttacdev.pom.go.id/dev/public/api/v3/"
  BPOM_EMAIL=""
  BPOM_PASSWORD=""
  BPOM_APP_NAME="CONNECTOR_BPOM"
  BPOM_APP_PORT="8002"

  CORE_REPO="https://gitlab.com/mertrack/mertrack-core"
  FRONTEND_REPO="https://gitlab.com/mertrack/mertrack_frontend"
  BPOM_REPO="https://gitlab.com/gesang/connector-bpom"

  NGINX_SITE_NAME="mertrack_frontend"
  NGINX_SERVER_NAME="_"
}

load_config() {
  _load_defaults

  if [ -f "$CFG_FILE" ]; then
    # shellcheck disable=SC1090
    . "$CFG_FILE"
  fi

  if [ -z "$APP_USER" ]; then
    if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
      APP_USER="$SUDO_USER"
    else
      APP_USER="$(getent passwd 1000 | cut -d: -f1)"
      [ -n "$APP_USER" ] || APP_USER="root"
    fi
  fi

  REAL_USER="$APP_USER"
  REAL_HOME="$(getent passwd "$REAL_USER" | cut -d: -f6)"
  [ -n "$REAL_HOME" ] || REAL_HOME="/home/$REAL_USER"

  [ -n "$APP_DIR" ] || APP_DIR="$REAL_HOME/mertrack"
  APP_DIR="${APP_DIR%/}"
  [ -n "$SERVER_IP" ] || SERVER_IP="$(detect_ip)"
  [ -n "$DB_HOST" ] || DB_HOST="127.0.0.1"

  [ -n "$BACKEND_PORT" ] || BACKEND_PORT="8001"
  [ -n "$FRONTEND_PORT" ] || FRONTEND_PORT="8000"
  [ -n "$BPOM_APP_PORT" ] || BPOM_APP_PORT="8002"

  if [ -z "$DB_PORT" ]; then
    if [ "$DB_DIALECT" = "mssql" ]; then
      DB_PORT="1433"
    else
      DB_PORT="5432"
    fi
  fi

  RUNTIME_DIR="$APP_DIR"
  SERVICES_DIR="$RUNTIME_DIR/services"
  TEMP_DIR="$RUNTIME_DIR/temp"
  STAGING_DIR="$RUNTIME_DIR/staging"
  PUBLIC_DIR="$RUNTIME_DIR/public"
}

# Menulis / memperbarui satu key di file konfigurasi (root-only, 600).
# Nilai di-quote dengan single quote agar aman saat di-source.
cfg_set() {
  local key="$1" val="$2" esc line tmp found=0 l
  mkdir -p "$CFG_DIR"
  chmod 700 "$CFG_DIR" 2>/dev/null || true
  [ -f "$CFG_FILE" ] || : >"$CFG_FILE"
  chmod 600 "$CFG_FILE" 2>/dev/null || true

  esc=${val//\'/\'\\\'\'}
  line="$key='$esc'"
  tmp="$(mktemp "${CFG_FILE}.XXXXXX")"

  if [ -s "$CFG_FILE" ]; then
    while IFS= read -r l || [ -n "$l" ]; do
      case "$l" in
        "$key="*)
          if [ "$found" -eq 0 ]; then
            printf '%s\n' "$line"
            found=1
          fi
          ;;
        *)
          printf '%s\n' "$l"
          ;;
      esac
    done <"$CFG_FILE" >"$tmp"
  fi

  if [ "$found" -eq 0 ]; then
    printf '%s\n' "$line" >>"$tmp"
  fi

  cat "$tmp" >"$CFG_FILE"
  rm -f "$tmp"
  printf -v "$key" '%s' "$val"
}

show_config() {
  local key val
  local keys="APP_NAME APP_USER APP_DIR SERVER_IP APP_TIMEZONE APP_MODE LOGIN_TIMEOUT RANGE_TRANSACTION BACKEND_PORT BACKEND_BRANCH FRONTEND_PORT FRONTEND_BRANCH DB_DIALECT DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD BPOM_URL BPOM_EMAIL BPOM_PASSWORD BPOM_APP_NAME BPOM_APP_PORT CORE_REPO FRONTEND_REPO BPOM_REPO NGINX_SITE_NAME NGINX_SERVER_NAME"
  for key in $keys; do
    val="${!key}"
    case "$key" in
      DB_PASSWORD | BPOM_PASSWORD) val="$(mask_secret "$val")" ;;
    esac
    printf '  %-22s = %s\n' "$key" "${val:-(kosong)}"
  done
}

# ============================================================
# EKSEKUSI SEBAGAI USER APLIKASI
# ============================================================
run_as_user() {
  sudo -u "$REAL_USER" -H bash -ic "$1"
}

run_in_user() {
  local dir="$1"
  shift
  (cd "$dir" && run_as_user "$*")
}

user_has() {
  sudo -u "$REAL_USER" -H bash -ic "command -v $1 >/dev/null 2>&1" 2>/dev/null
}

user_bin() {
  sudo -u "$REAL_USER" -H bash -ic "command -v $1" 2>/dev/null | tail -n 1
}

node_bin() {
  if [ -z "${CC_NODE_BIN:-}" ]; then
    CC_NODE_BIN="$(user_bin node)"
    [ -n "$CC_NODE_BIN" ] || CC_NODE_BIN="$(command -v node 2>/dev/null || true)"
  fi
  printf '%s' "$CC_NODE_BIN"
}

cc_reset_cache() {
  CC_NODE_BIN=""
  CC_VER_LINE=""
}

pkg_name() {
  local f="$1" nb
  nb="$(node_bin)"
  [ -n "$nb" ] || return 1
  "$nb" -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const j=JSON.parse(d);if(!j.name)process.exit(2);console.log(j.name)}catch(e){process.exit(1)}})' <"$f"
}

# ============================================================
# UTIL
# ============================================================
fmt_duration_s() {
  local s="${1:-0}"
  local d=$((s / 86400)) h=$(((s % 86400) / 3600)) m=$(((s % 3600) / 60))
  if [ "$d" -gt 0 ]; then
    printf '%dd %dh' "$d" "$h"
  elif [ "$h" -gt 0 ]; then
    printf '%dh %dm' "$h" "$m"
  elif [ "$m" -gt 0 ]; then
    printf '%dm' "$m"
  else
    printf '%ds' "$s"
  fi
}

fmt_duration_ms() { fmt_duration_s $((${1:-0} / 1000)); }

ensure_runtime_dirs() {
  mkdir -p "$RUNTIME_DIR" "$SERVICES_DIR" "$TEMP_DIR" "$PUBLIC_DIR"
  chown -R "$REAL_USER":"$REAL_USER" "$APP_DIR" 2>/dev/null || true
  chmod 755 "$APP_DIR" "$RUNTIME_DIR" "$SERVICES_DIR" "$TEMP_DIR" \
    "$PUBLIC_DIR" 2>/dev/null || true
}

safe_rm() {
  local p="${1%/}"
  case "$p" in
    "" | "/" | "/home" | "/root" | "/etc" | "/var" | \
      "$APP_DIR" | "$RUNTIME_DIR" | "$PUBLIC_DIR")
      err "Menolak menghapus path berbahaya: '$p'"
      return 1
      ;;
  esac
  [ -e "$p" ] || return 0
  rm -rf -- "$p"
}
