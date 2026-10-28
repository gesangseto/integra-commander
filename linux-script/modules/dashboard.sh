#!/usr/bin/env bash
# Integra Commander CLI - Dashboard (resource, PM2, Nginx, DB).

cpu_usage() {
  local u n s idl iow irq sirq st
  local u2 n2 s2 idl2 iow2 irq2 sirq2 st2
  local t1 t2 i1 i2

  read -r _ u n s idl iow irq sirq st _ </proc/stat
  t1=$((u + n + s + idl + iow + irq + sirq + st))
  i1=$((idl + iow))

  sleep 0.3

  read -r _ u2 n2 s2 idl2 iow2 irq2 sirq2 st2 _ </proc/stat
  t2=$((u2 + n2 + s2 + idl2 + iow2 + irq2 + sirq2 + st2))
  i2=$((idl2 + iow2))

  awk -v i1="$i1" -v t1="$t1" -v i2="$i2" -v t2="$t2" 'BEGIN{
    dt = t2 - t1; di = i2 - i1;
    if (dt <= 0) { print "0.0"; exit }
    printf "%.1f", (1 - di / dt) * 100
  }'
}

svc_state() {
  local s
  s="$(systemctl is-active "$1" 2>/dev/null || true)"
  [ -n "$s" ] || s="unknown"
  case "$s" in
    active) printf '%s%s%s' "$C_GREEN" "$s" "$C_RESET" ;;
    failed | inactive) printf '%s%s%s' "$C_RED" "$s" "$C_RESET" ;;
    *) printf '%s%s%s' "$C_YELLOW" "$s" "$C_RESET" ;;
  esac
}

pct_bar() {
  local label="$1" pct="$2" extra="${3-}" width=24 filled empty
  filled="$(awk -v p="$pct" -v w="$width" 'BEGIN{
    n = int((p / 100) * w + 0.5);
    if (n < 0) n = 0; if (n > w) n = w;
    print n
  }')"
  empty=$((width - filled))
  printf ' %-10s [%s%s] %6s%%  %s\n' "$label" \
    "$(printf '%*s' "$filled" '' | tr ' ' '#')" \
    "$(printf '%*s' "$empty" '' | tr ' ' '.')" \
    "$pct" "$extra"
}

cc_version_line() {
  if [ -z "${CC_VER_LINE:-}" ]; then
    local nb nodev npmv pm2v nginxv
    nb="$(node_bin)"
    [ -n "$nb" ] && nodev="$("$nb" -v 2>/dev/null)"
    npmv="$(run_as_user "npm -v" 2>/dev/null | tail -n 1)"
    pm2v="$(run_as_user "pm2 -v" 2>/dev/null | tail -n 1)"
    if have nginx; then
      nginxv="$(nginx -v 2>&1 | sed 's#^nginx/##')"
    fi
    CC_VER_LINE="node ${nodev:-?} | npm ${npmv:-?} | pm2 ${pm2v:-?} | nginx ${nginxv:-?}"
  fi
  printf '%s' "$CC_VER_LINE"
}

render_dashboard() {
  load_config

  local os_name kernel host ip up_s cpu
  local mem_used mem_total mem_avail mem_pct
  local disk_used disk_total disk_pct
  local load1 load5 load15
  local rows total online memsum id name status cpuv mem up rest cwd sc uptime
  local nginx_sites

  os_name="$(. /etc/os-release 2>/dev/null && printf '%s' "${PRETTY_NAME:-Linux}")"
  kernel="$(uname -r)"
  host="$(hostname)"
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  up_s="$(awk '{print int($1)}' /proc/uptime 2>/dev/null || echo 0)"
  cpu="$(cpu_usage)"

  read -r mem_used mem_total mem_avail < <(free -m | awk '/^Mem:/{print $3, $2, $7}')
  mem_pct="$(awk -v u="$mem_used" -v t="$mem_total" 'BEGIN{ if (t > 0) printf "%.1f", u * 100 / t; else print "0.0" }')"

  read -r disk_used disk_total disk_pct < <(df -Pm / 2>/dev/null | awk 'NR==2{gsub("%", "", $5); print $3, $2, $5}')
  read -r load1 load5 load15 < <(awk '{print $1, $2, $3}' /proc/loadavg 2>/dev/null)

  header "Dashboard"

  printf ' %-10s %s\n' "Host" "$host"
  printf ' %-10s %s\n' "OS" "$os_name (kernel $kernel)"
  printf ' %-10s %s\n' "IP" "${ip:-(tidak terdeteksi)}"
  printf ' %-10s %s\n' "Uptime" "$(fmt_duration_s "$up_s")"
  printf ' %-10s %s\n' "Waktu" "$(date '+%F %T %Z')"
  printf ' %-10s %s\n' "Load" "$load1 / $load5 / $load15"

  section "Resource"
  pct_bar "CPU" "$cpu"
  pct_bar "Memory" "$mem_pct" "(${mem_used} MB / ${mem_total} MB, avail ${mem_avail} MB)"
  pct_bar "Disk /" "$disk_pct" "(${disk_used} MB / ${disk_total} MB)"

  section "PM2"
  if ! user_has pm2; then
    warn "PM2 tidak ditemukan untuk user $REAL_USER."
  elif ! rows="$(pm2_list_tsv 2>/dev/null)"; then
    warn "Gagal membaca daftar PM2."
  elif [ -z "$rows" ]; then
    printf ' %s\n' "${C_DIM}Belum ada proses PM2.${C_RESET}"
  else
    printf ' %-4s %-28s %-10s %6s %10s %10s %8s\n' "ID" "NAME" "STATUS" "CPU" "MEM" "UPTIME" "RESTART"
    total=0
    online=0
    memsum="0"
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
      printf ' %-4s %-28s %s%-10s%s %5s%% %8sM %10s %8s\n' \
        "$id" "${name:0:28}" "$sc" "$status" "$C_RESET" "$cpuv" "$mem" "$uptime" "$rest"
    done <<<"$rows"
    printf ' %s\n' "${C_DIM}Total ${total} proses, online ${online}, RAM ${memsum} MB.${C_RESET}"
  fi

  section "Nginx & Database"
  nginx_sites="$(find /etc/nginx/sites-enabled -maxdepth 1 \( -type l -o -type f \) 2>/dev/null | wc -l | tr -d ' ')"
  printf ' %-10s %s  (site aktif: %s)\n' "Nginx" "$(svc_state nginx)" "${nginx_sites:-0}"

  if [ "$DB_DIALECT" = "mssql" ]; then
    printf ' %-10s %s  (%s)\n' "Database" "$(svc_state mssql-server)" "$DB_DIALECT"
  else
    printf ' %-10s %s  (%s)\n' "Database" "$(svc_state postgresql)" "$DB_DIALECT"
  fi

  section "Konfigurasi"
  printf ' %-10s %s\n' "App" "$APP_NAME"
  printf ' %-10s %s\n' "User" "$REAL_USER"
  printf ' %-10s %s\n' "Dir" "$APP_DIR"
  printf ' %-10s http://%s:%s\n' "Backend" "$SERVER_IP" "$BACKEND_PORT"
  printf ' %-10s http://%s:%s\n' "Frontend" "$SERVER_IP" "$FRONTEND_PORT"
  printf ' %-10s http://%s:%s\n' "BPOM" "$SERVER_IP" "$BPOM_APP_PORT"
  printf ' %-10s %s\n' "Versions" "$(cc_version_line)"
}

dashboard_menu() {
  load_config

  if [ ! -t 0 ]; then
    render_dashboard
    return 0
  fi

  local key interval="${DASH_INTERVAL:-5}"
  while true; do
    render_dashboard
    printf '\n%s\n' "${C_DIM}Auto-refresh ${interval}s — tekan q untuk keluar, ENTER untuk refresh.${C_RESET}"
    if read -r -t "$interval" -n 1 key; then
      case "$key" in
        q | Q) break ;;
      esac
    fi
  done
  [ -t 1 ] && clear
}
