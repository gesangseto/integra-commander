#!/usr/bin/env bash
# Integra Commander CLI - menu PM2 Management & Deploy.

pm2_render_table() {
  local rows id name status cpuv mem up rest cwd sc uptime total=0 online=0 memsum="0"

  if ! user_has pm2; then
    warn "PM2 tidak ditemukan untuk user $REAL_USER."
    printf '  Install lewat Setting → Install dependencies.\n'
    return 1
  fi

  if ! rows="$(pm2_list_tsv 2>/dev/null)"; then
    warn "Gagal membaca daftar PM2 (pm2 jlist)."
    return 1
  fi

  if [ -z "$rows" ]; then
    printf '  %s\n' "${C_DIM}Belum ada proses PM2.${C_RESET}"
    return 0
  fi

  printf '  %-4s %-28s %-10s %6s %10s %10s %8s\n' "ID" "NAME" "STATUS" "CPU" "MEM" "UPTIME" "RESTART"
  hr

  while IFS=$'\t' read -r id name status cpuv mem up rest cwd; do
    [ -n "$name" ] || continue
    total=$((total + 1))
    [ "$status" = "online" ] && online=$((online + 1))
    memsum="$(awk -v a="$memsum" -v b="$mem" 'BEGIN{printf "%.1f", a + b}')"
    uptime="$(fmt_duration_ms "$up")"
    case "$status" in
      online) sc="$C_GREEN" ;;
      stopped | errored) sc="$C_RED" ;;
      *) sc="$C_YELLOW" ;;
    esac
    printf '  %-4s %-28s %s%-10s%s %5s%% %8sM %10s %8s\n' \
      "$id" "${name:0:28}" "$sc" "$status" "$C_RESET" "$cpuv" "$mem" "$uptime" "$rest"
  done <<<"$rows"

  printf '  %s\n' "${C_DIM}Total ${total} proses, online ${online}, RAM ${memsum} MB.${C_RESET}"
}

pm2_ask_target() {
  PM2_TARGET=""
  read -rp "Nama atau ID proses: " PM2_TARGET || return 1
  [ -n "$PM2_TARGET" ] || return 1
  if ! [[ "$PM2_TARGET" =~ ^[0-9]+$ ]] && ! pm2_has "$PM2_TARGET"; then
    warn "Proses '${PM2_TARGET}' tidak ditemukan."
    return 1
  fi
}

pm2_do_action() {
  local action="$1"
  pm2_ask_target || return 1

  if [ "$action" = "delete" ]; then
    confirm "Hapus proses '${PM2_TARGET}' dari PM2?" || {
      warn "Dibatalkan."
      return 0
    }
  fi

  if run_in_user "$RUNTIME_DIR" "pm2 ${action} $(printf '%q' "$PM2_TARGET")"; then
    ok "pm2 ${action} ${PM2_TARGET} selesai."
  else
    err "pm2 ${action} ${PM2_TARGET} gagal."
  fi
  pause
}

pm2_show_logs() {
  pm2_ask_target || return 1
  clear
  printf '%s\n' "${C_BOLD}Log: ${PM2_TARGET}${C_RESET}"
  run_as_user "pm2 logs $(printf '%q' "$PM2_TARGET") --lines 100 --nostream" || warn "Gagal membaca log."
  pause
}

pm2_flush_logs() {
  pm2_ask_target || return 1
  confirm "Flush log '${PM2_TARGET}'?" || return 0
  run_as_user "pm2 flush $(printf '%q' "$PM2_TARGET")" || warn "Gagal flush log."
  ok "Log ${PM2_TARGET} di-flush."
  pause
}

pm2_reload_env_menu() {
  local mode="$1"
  local label="soft (reload --update-env)"
  [ "$mode" = "force" ] && label="force (delete + start ulang, ada downtime)"

  load_config
  if [ ! -d "$SERVICES_DIR" ]; then
    warn "Folder services belum ada. Deploy backend terlebih dahulu."
    pause
    return 1
  fi

  confirm "Tulis ulang .env dari Setting lalu reload semua proses PM2 (${label})?" || return 0
  reload_env "$mode"
  pause
}

deploy_menu() {
  local val
  while true; do
    load_config
    header "Deploy / Install"
    printf '  App : %s\n' "$APP_NAME"
    printf '  Dir : %s\n' "$APP_DIR"
    hr
    printf '  1) Reload backend (PM2)\n'
    printf '  2) Install Backend + Seed (fresh install)\n'
    printf '  3) Install Backend (update only)\n'
    printf '  4) Install / update BPOM API\n'
    printf '  5) Install Frontend (Vue build + Nginx)\n'
    printf '  6) Setup PM2 log rotate\n'
    printf '  7) Setup PM2 auto-start (systemd)\n'
    printf '  0) Kembali\n'
    hr
    read -rp "Pilih: " val || return 0

    case "$val" in
      1)
        reload_env soft
        pause
        ;;
      2)
        deploy_api_core seed
        pause
        ;;
      3)
        deploy_api_core
        pause
        ;;
      4)
        deploy_bpom
        pause
        ;;
      5)
        deploy_frontend
        pause
        ;;
      6)
        deploy_logrotate
        pause
        ;;
      7)
        setup_pm2_startup
        pause
        ;;
      0) return 0 ;;
      *) continue ;;
    esac
  done
}

pm2_menu() {
  local val
  while true; do
    load_config
    header "PM2 Management"
    printf '  User   : %s\n' "$REAL_USER"
    printf '  Folder : %s\n\n' "$RUNTIME_DIR"
    pm2_render_table
    printf '\n'
    printf '   1) Start proses\n'
    printf '   2) Stop proses\n'
    printf '   3) Restart proses\n'
    printf '   4) Reload proses (graceful)\n'
    printf '   5) Delete proses\n'
    printf '   6) Lihat log proses\n'
    printf '   7) Flush log proses\n'
    printf '   8) Save session PM2\n'
    printf '   9) Reload .env (soft)\n'
    printf '  10) Reload .env (force)\n'
    printf '  11) Deploy / Install aplikasi\n'
    printf '  12) Install pm2-logrotate\n'
    printf '  13) Setup PM2 auto-start\n'
    printf '   0) Kembali\n'
    hr
    read -rp "Pilih: " val || return 0

    case "$val" in
      1) pm2_do_action start ;;
      2) pm2_do_action stop ;;
      3) pm2_do_action restart ;;
      4) pm2_do_action reload ;;
      5) pm2_do_action delete ;;
      6) pm2_show_logs ;;
      7) pm2_flush_logs ;;
      8)
        if pm2_save; then
          ok "Session PM2 disimpan."
        else
          err "Gagal menyimpan session PM2."
        fi
        pause
        ;;
      9) pm2_reload_env_menu soft ;;
      10) pm2_reload_env_menu force ;;
      11) deploy_menu ;;
      12) deploy_logrotate; pause ;;
      13) setup_pm2_startup; pause ;;
      0) return 0 ;;
      *) continue ;;
    esac
  done
}
