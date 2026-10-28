#!/usr/bin/env bash
# Integra Commander CLI - menu Setting.

save_key() {
  cfg_set "$1" "$2"
  load_config
  cc_reset_cache
  ok "$1 diperbarui."
  sleep 1
}

set_port() {
  local key="$1" label="$2" current="$3" val
  ask val "$label" "$current"
  if ! [[ "$val" =~ ^[0-9]+$ ]] || [ "$val" -lt 1 ] || [ "$val" -gt 65535 ]; then
    err "Port harus angka 1-65535."
    sleep 2
    return 1
  fi
  save_key "$key" "$val"
}

set_password() {
  local key="$1" label="$2" current="$3" val
  printf '%s\n' "${C_DIM}Kosongkan untuk mempertahankan, ketik '-' untuk menghapus.${C_RESET}"
  ask_secret val "$label"
  case "$val" in
    "") return 0 ;;
    "-") save_key "$key" "" ;;
    *) save_key "$key" "$val" ;;
  esac
}

settings_application() {
  local val
  while true; do
    load_config
    header "Setting — Application"
    printf '  1) App Name             : %s\n' "$APP_NAME"
    printf '  2) App User             : %s\n' "$APP_USER"
    printf '  3) App Directory        : %s\n' "$APP_DIR"
    printf '  4) Server IP            : %s\n' "$SERVER_IP"
    printf '  5) Timezone             : %s\n' "$APP_TIMEZONE"
    printf '  6) App Mode             : %s\n' "$APP_MODE"
    printf '  7) Login Timeout (mnt)  : %s\n' "$LOGIN_TIMEOUT"
    printf '  8) Default Range        : %s\n' "$RANGE_TRANSACTION"
    printf '  0) Kembali\n'
    hr
    read -rp "Pilih: " val || return 0

    case "$val" in
      1)
        ask val "App Name" "$APP_NAME"
        val="${val// /}"
        [ -n "$val" ] || {
          err "App Name tidak boleh kosong."
          sleep 2
          continue
        }
        save_key APP_NAME "$val"
        ;;
      2)
        ask val "App User (harus user Linux yang ada)" "$APP_USER"
        if ! id "$val" >/dev/null 2>&1; then
          err "User '$val' tidak ditemukan."
          sleep 2
          continue
        fi
        save_key APP_USER "$val"
        warn "Pastikan folder $APP_DIR dimiliki user baru (menu 'Buat struktur folder')."
        sleep 2
        ;;
      3)
        ask val "App Directory" "$APP_DIR"
        save_key APP_DIR "${val%/}"
        ;;
      4)
        ask val "Server IP" "$SERVER_IP"
        save_key SERVER_IP "$val"
        ;;
      5)
        ask val "Timezone (mis. Asia/Jakarta)" "$APP_TIMEZONE"
        if have timedatectl && ! timedatectl list-timezones 2>/dev/null | grep -Fxq "$val"; then
          err "Timezone '$val' tidak valid."
          sleep 2
          continue
        fi
        save_key APP_TIMEZONE "$val"
        ;;
      6)
        printf '  1) production\n  2) development\n'
        ask val "Pilih mode" "1"
        case "$val" in
          2) save_key APP_MODE "development" ;;
          *) save_key APP_MODE "production" ;;
        esac
        ;;
      7)
        ask val "Login timeout (menit)" "$LOGIN_TIMEOUT"
        [[ "$val" =~ ^[0-9]+$ ]] || {
          err "Harus angka."
          sleep 2
          continue
        }
        save_key LOGIN_TIMEOUT "$val"
        ;;
      8)
        printf '  1) last_1_week\n  2) last_month\n  3) last_3_month\n  4) last_6_month\n  5) all\n'
        ask val "Pilih range" "1"
        case "$val" in
          2) save_key RANGE_TRANSACTION "last_month" ;;
          3) save_key RANGE_TRANSACTION "last_3_month" ;;
          4) save_key RANGE_TRANSACTION "last_6_month" ;;
          5) save_key RANGE_TRANSACTION "all" ;;
          *) save_key RANGE_TRANSACTION "last_1_week" ;;
        esac
        ;;
      0) return 0 ;;
      *) continue ;;
    esac
  done
}

settings_network() {
  local val
  while true; do
    load_config
    header "Setting — Network & Port"
    printf '  1) Backend Port     : %s\n' "$BACKEND_PORT"
    printf '  2) Backend Branch   : %s\n' "${BACKEND_BRANCH:-(default)}"
    printf '  3) Frontend Port    : %s\n' "$FRONTEND_PORT"
    printf '  4) Frontend Branch  : %s\n' "${FRONTEND_BRANCH:-(default)}"
    printf '  0) Kembali\n'
    hr
    read -rp "Pilih: " val || return 0

    case "$val" in
      1) set_port BACKEND_PORT "Backend port" "$BACKEND_PORT" ;;
      2) ask val "Backend branch" "$BACKEND_BRANCH"; save_key BACKEND_BRANCH "$val" ;;
      3) set_port FRONTEND_PORT "Frontend port" "$FRONTEND_PORT" ;;
      4) ask val "Frontend branch" "$FRONTEND_BRANCH"; save_key FRONTEND_BRANCH "$val" ;;
      0) return 0 ;;
      *) continue ;;
    esac
  done
}

settings_database() {
  local val newport
  while true; do
    load_config
    header "Setting — Database"
    printf '  1) Dialect   : %s\n' "$DB_DIALECT"
    printf '  2) Host      : %s\n' "$DB_HOST"
    printf '  3) Port      : %s\n' "$DB_PORT"
    printf '  4) Name      : %s\n' "${DB_NAME:-(kosong)}"
    printf '  5) User      : %s\n' "${DB_USER:-(kosong)}"
    printf '  6) Password  : %s\n' "$(mask_secret "$DB_PASSWORD")"
    printf '  0) Kembali\n'
    hr
    read -rp "Pilih: " val || return 0

    case "$val" in
      1)
        printf '  1) postgres\n  2) mssql\n'
        ask val "Pilih dialect" "1"
        if [ "$val" = "2" ]; then
          save_key DB_DIALECT "mssql"
          ask newport "DB port" "1433"
        else
          save_key DB_DIALECT "postgres"
          ask newport "DB port" "5432"
        fi
        save_key DB_PORT "$newport"
        ;;
      2) ask val "DB host" "$DB_HOST"; save_key DB_HOST "$val" ;;
      3) set_port DB_PORT "DB port" "$DB_PORT" ;;
      4) ask val "DB name" "$DB_NAME"; save_key DB_NAME "$val" ;;
      5) ask val "DB user" "$DB_USER"; save_key DB_USER "$val" ;;
      6) set_password DB_PASSWORD "DB password" "$DB_PASSWORD" ;;
      0) return 0 ;;
      *) continue ;;
    esac
  done
}

settings_bpom() {
  local val
  while true; do
    load_config
    header "Setting — BPOM Connector"
    printf '  1) Target       : %s\n' "$BPOM_URL"
    printf '  2) Email        : %s\n' "${BPOM_EMAIL:-(kosong)}"
    printf '  3) Password     : %s\n' "$(mask_secret "$BPOM_PASSWORD")"
    printf '  4) App Name     : %s\n' "$BPOM_APP_NAME"
    printf '  5) App Port     : %s\n' "$BPOM_APP_PORT"
    printf '  0) Kembali\n'
    hr
    read -rp "Pilih: " val || return 0

    case "$val" in
      1)
        printf '  1) BPOM Live (https://ttac.pom.go.id/api/v3/)\n'
        printf '  2) BPOM Development (https://ttacdev.pom.go.id/dev/public/api/v3/)\n'
        printf '  3) Custom\n'
        ask val "Pilih" "2"
        case "$val" in
          1) save_key BPOM_URL "https://ttac.pom.go.id/api/v3/" ;;
          2) save_key BPOM_URL "https://ttacdev.pom.go.id/dev/public/api/v3/" ;;
          *)
            ask val "URL BPOM" "$BPOM_URL"
            save_key BPOM_URL "$val"
            ;;
        esac
        ;;
      2) ask val "BPOM email" "$BPOM_EMAIL"; save_key BPOM_EMAIL "$val" ;;
      3) set_password BPOM_PASSWORD "BPOM password" "$BPOM_PASSWORD" ;;
      4)
        ask val "BPOM app name" "$BPOM_APP_NAME"
        val="${val// /}"
        save_key BPOM_APP_NAME "$val"
        ;;
      5) set_port BPOM_APP_PORT "BPOM app port" "$BPOM_APP_PORT" ;;
      0) return 0 ;;
      *) continue ;;
    esac
  done
}

settings_repository() {
  local val
  while true; do
    load_config
    header "Setting — Repository"
    printf '  1) Core Repo     : %s\n' "$CORE_REPO"
    printf '  2) Frontend Repo : %s\n' "$FRONTEND_REPO"
    printf '  3) BPOM Repo     : %s\n' "$BPOM_REPO"
    printf '  0) Kembali\n'
    hr
    read -rp "Pilih: " val || return 0

    case "$val" in
      1) ask val "Core repo URL" "$CORE_REPO"; save_key CORE_REPO "$val" ;;
      2) ask val "Frontend repo URL" "$FRONTEND_REPO"; save_key FRONTEND_REPO "$val" ;;
      3) ask val "BPOM repo URL" "$BPOM_REPO"; save_key BPOM_REPO "$val" ;;
      0) return 0 ;;
      *) continue ;;
    esac
  done
}

settings_nginx() {
  local val
  while true; do
    load_config
    header "Setting — Nginx"
    printf '  1) Site Name    : %s\n' "$NGINX_SITE_NAME"
    printf '  2) Server Name  : %s\n' "$NGINX_SERVER_NAME"
    printf '  0) Kembali\n'
    hr
    read -rp "Pilih: " val || return 0

    case "$val" in
      1)
        ask val "Nama file site (tanpa .conf)" "$NGINX_SITE_NAME"
        save_key NGINX_SITE_NAME "${val%.conf}"
        ;;
      2)
        ask val "server_name (mis. _ atau domain)" "$NGINX_SERVER_NAME"
        save_key NGINX_SERVER_NAME "$val"
        ;;
      0) return 0 ;;
      *) continue ;;
    esac
  done
}

settings_install_deps() {
  header "Setting — Install Dependencies"
  local script="$CC_BASE_DIR/app-installer.sh"
  if [ ! -f "$script" ]; then
    err "File tidak ditemukan: $script"
    pause
    return 1
  fi
  chmod +x "$script"
  "$script"
}

settings_menu() {
  local val
  while true; do
    load_config
    header "Setting"
    printf '  Config : %s\n' "$CFG_FILE"
    printf '  User   : %s\n' "$REAL_USER"
    printf '  App    : %s (%s)\n' "$APP_NAME" "$APP_DIR"
    hr
    printf '  1) Application\n'
    printf '  2) Network & Port\n'
    printf '  3) Database\n'
    printf '  4) BPOM Connector\n'
    printf '  5) Repository\n'
    printf '  6) Nginx\n'
    printf '  7) Install dependencies (Postgres, Node, Nginx, PM2, ...)\n'
    printf '  8) Buat struktur folder aplikasi\n'
    printf '  9) Tampilkan konfigurasi\n'
    printf ' 10) Reset konfigurasi\n'
    printf '  0) Kembali\n'
    hr
    read -rp "Pilih: " val || return 0

    case "$val" in
      1) settings_application ;;
      2) settings_network ;;
      3) settings_database ;;
      4) settings_bpom ;;
      5) settings_repository ;;
      6) settings_nginx ;;
      7) settings_install_deps ;;
      8)
        load_config
        ensure_runtime_dirs
        ok "Struktur folder dibuat: $APP_DIR"
        pause
        ;;
      9)
        header "Konfigurasi"
        show_config
        pause
        ;;
      10)
        if confirm "Reset konfigurasi ke default? File $CFG_FILE akan dihapus."; then
          rm -f "$CFG_FILE"
          load_config
          cc_reset_cache
          ok "Konfigurasi direset."
        else
          warn "Dibatalkan."
        fi
        pause
        ;;
      0) return 0 ;;
      *) continue ;;
    esac
  done
}
