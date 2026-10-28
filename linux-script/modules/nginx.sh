#!/usr/bin/env bash
# Integra Commander CLI - menu Nginx Management.

NGINX_AVAIL="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"

nginx_site_field() {
  local f="$1" field="$2" val
  case "$field" in
    listen)
      val="$(awk '/^[[:space:]]*listen[[:space:]]/{gsub(/;/,"",$2); print $2; exit}' "$f")"
      ;;
    server_name)
      val="$(awk '/^[[:space:]]*server_name[[:space:]]/{for(i=2;i<=NF;i++){gsub(/;/,"",$i); printf "%s ", $i}; exit}' "$f")"
      val="${val% }"
      ;;
    root)
      val="$(awk '/^[[:space:]]*root[[:space:]]/{gsub(/[";]/,"",$2); print $2; exit}' "$f")"
      ;;
    proxy)
      val="$(awk '/^[[:space:]]*proxy_pass[[:space:]]/{gsub(/;/,"",$2); print $2; exit}' "$f")"
      ;;
  esac
  printf '%s' "$val"
}

nginx_list_sites() {
  local f base en listen domain root proxy

  if [ ! -d "$NGINX_AVAIL" ]; then
    warn "Folder $NGINX_AVAIL tidak ditemukan."
    return 1
  fi

  printf '  %-30s %-4s %-10s %-24s %-40s %s\n' "FILE" "EN" "PORT" "DOMAIN" "ROOT" "PROXY"
  hr

  for f in "$NGINX_AVAIL"/*; do
    [ -f "$f" ] || continue
    base="$(basename "$f")"
    case "$base" in
      *.bak.* | *.removed.*) continue ;;
    esac

    if [ -e "$NGINX_ENABLED/$base" ]; then en="yes"; else en="no"; fi
    listen="$(nginx_site_field "$f" listen)"
    domain="$(nginx_site_field "$f" server_name)"
    root="$(nginx_site_field "$f" root)"
    proxy="$(nginx_site_field "$f" proxy)"

    printf '  %-30s %-4s %-10s %-24s %-40s %s\n' \
      "${base:0:30}" "$en" "${listen:-80}" "${domain:-_} " \
      "${root:0:40}" "${proxy:-(tidak ada)}"
  done
}

nginx_pick_site() {
  local -a sites=()
  local f i=1 s n

  while IFS= read -r f; do
    s="$(basename "$f")"
    case "$s" in
      *.bak.* | *.removed.*) continue ;;
    esac
    sites+=("$s")
  done < <(find "$NGINX_AVAIL" -maxdepth 1 -type f 2>/dev/null | sort)

  if [ "${#sites[@]}" -eq 0 ]; then
    warn "Belum ada site di $NGINX_AVAIL."
    return 1
  fi

  printf '  Daftar site:\n'
  for s in "${sites[@]}"; do
    printf '  %2d) %s\n' "$i" "$s"
    i=$((i + 1))
  done

  read -rp "Pilih nomor: " n || return 1
  [[ "$n" =~ ^[0-9]+$ ]] || return 1
  [ "$n" -ge 1 ] && [ "$n" -le "${#sites[@]}" ] || return 1

  PICKED_SITE="${sites[$((n - 1))]}"
}

nginx_toggle_site() {
  local base state_before

  nginx_pick_site || return 1
  base="$PICKED_SITE"

  local new_state

  if [ -e "$NGINX_ENABLED/$base" ]; then
    state_before="enabled"
    new_state="disabled"
    confirm "Disable site '${base}'?" || return 0
    rm -f "$NGINX_ENABLED/$base"
  else
    state_before="disabled"
    new_state="enabled"
    confirm "Enable site '${base}'?" || return 0
    ln -sfn "$NGINX_AVAIL/$base" "$NGINX_ENABLED/$base"
  fi

  if ! nginx -t >/dev/null 2>&1; then
    err "nginx -t gagal. Perubahan dikembalikan."
    if [ "$state_before" = "enabled" ]; then
      ln -sfn "$NGINX_AVAIL/$base" "$NGINX_ENABLED/$base"
    else
      rm -f "$NGINX_ENABLED/$base"
    fi
    nginx -t
    pause
    return 1
  fi

  nginx_reload || true
  ok "Site '${base}' sekarang ${new_state}."
  pause
}

nginx_edit_site() {
  local base file backup editor

  nginx_pick_site || return 1
  base="$PICKED_SITE"
  file="$NGINX_AVAIL/$base"
  backup="$file.bak.$(date '+%Y%m%d%H%M%S')"
  cp -a "$file" "$backup"

  editor="${EDITOR:-}"
  if [ -z "$editor" ]; then
    if have nano; then
      editor="nano"
    elif have vi; then
      editor="vi"
    else
      err "Editor tidak ditemukan. Set variabel EDITOR."
      return 1
    fi
  fi

  "$editor" "$file"

  if ! nginx -t 2>&1; then
    if confirm "Konfigurasi tidak valid. Kembalikan dari backup?"; then
      cp -a "$backup" "$file"
      ok "Konfigurasi dikembalikan."
    else
      warn "Backup tersimpan di $backup"
      pause
      return 1
    fi
  else
    rm -f "$backup"
  fi

  if confirm "Reload Nginx sekarang?"; then
    nginx_reload || true
  fi
  pause
}

nginx_delete_site() {
  local base file removed was_enabled=0

  nginx_pick_site || return 1
  base="$PICKED_SITE"
  file="$NGINX_AVAIL/$base"
  removed="$file.removed.$(date '+%Y%m%d%H%M%S')"

  [ -e "$NGINX_ENABLED/$base" ] && was_enabled=1

  confirm "Hapus konfigurasi site '${base}'? File akan dipindah ke ${removed} (tidak dihapus permanen)." || return 0

  rm -f "$NGINX_ENABLED/$base"
  mv "$file" "$removed"

  if ! nginx -t >/dev/null 2>&1; then
    err "nginx -t gagal setelah penghapusan. Mengembalikan site."
    mv "$removed" "$file"
    [ "$was_enabled" -eq 1 ] && ln -sfn "$file" "$NGINX_ENABLED/$base"
    nginx -t
    pause
    return 1
  fi

  nginx_reload || true
  ok "Site '${base}' dihapus (backup: ${removed})."
  pause
}

nginx_start_stop() {
  local val
  while true; do
    header "Nginx — Service"
    printf '  Status: %s\n\n' "$(svc_state nginx)"
    printf '  1) Start\n  2) Stop\n  3) Restart\n  4) Status detail\n  0) Kembali\n'
    hr
    read -rp "Pilih: " val || return 0

    case "$val" in
      1)
        if systemctl start nginx; then ok "Nginx started."; else err "Gagal start Nginx."; fi
        pause
        ;;
      2)
        confirm "Stop Nginx?" || continue
        if systemctl stop nginx; then ok "Nginx stopped."; else err "Gagal stop Nginx."; fi
        pause
        ;;
      3)
        confirm "Restart Nginx?" || continue
        if systemctl restart nginx; then ok "Nginx restarted."; else err "Gagal restart Nginx."; fi
        pause
        ;;
      4)
        systemctl status nginx --no-pager -l | head -n 30
        pause
        ;;
      0) return 0 ;;
      *) continue ;;
    esac
  done
}

nginx_logs() {
  local err_log="/var/log/nginx/error.log" acc_log="/var/log/nginx/access.log"
  header "Nginx — Log (50 baris terakhir)"
  section "error.log"
  if [ -f "$err_log" ]; then tail -n 50 "$err_log"; else warn "Tidak ada $err_log"; fi
  section "access.log"
  if [ -f "$acc_log" ]; then tail -n 50 "$acc_log"; else warn "Tidak ada $acc_log"; fi
  pause
}

nginx_menu() {
  local val
  while true; do
    load_config
    header "Nginx Management"
    printf '  Status : %s\n' "$(svc_state nginx)"
    printf '  Config : %s\n\n' "$NGINX_AVAIL"
    printf '   1) Daftar site\n'
    printf '   2) Test konfigurasi (nginx -t)\n'
    printf '   3) Reload konfigurasi\n'
    printf '   4) Start / Stop / Restart service\n'
    printf '   5) Buat / update site frontend (dari Setting)\n'
    printf '   6) Enable / disable site\n'
    printf '   7) Edit site\n'
    printf '   8) Hapus site (dipindah ke backup)\n'
    printf '   9) Lihat log Nginx\n'
    printf '  10) Deploy / update frontend\n'
    printf '   0) Kembali\n'
    hr
    read -rp "Pilih: " val || return 0

    case "$val" in
      1)
        nginx_list_sites
        pause
        ;;
      2)
        if nginx -t 2>&1; then
          ok "Konfigurasi valid."
        else
          err "Konfigurasi tidak valid."
        fi
        pause
        ;;
      3)
        if nginx_reload; then ok "Nginx reloaded."; else err "Reload gagal."; fi
        pause
        ;;
      4) nginx_start_stop ;;
      5)
        load_config
        write_nginx_site
        pause
        ;;
      6) nginx_toggle_site ;;
      7) nginx_edit_site ;;
      8) nginx_delete_site ;;
      9) nginx_logs ;;
      10)
        deploy_frontend
        pause
        ;;
      0) return 0 ;;
      *) continue ;;
    esac
  done
}
