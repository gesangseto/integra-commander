#!/usr/bin/env bash
# Integra Commander CLI - deployment & PM2/Nginx helpers.

if [ -n "${CC_DEPLOY_LOADED:-}" ]; then
  return 0
fi
CC_DEPLOY_LOADED=1

# ============================================================
# LOG DEPLOY
# ============================================================
deploy_log_init() {
  mkdir -p "$LOG_DIR"
  chmod 755 "$LOG_DIR" 2>/dev/null || true
  DEPLOY_LOG="$LOG_DIR/deploy-$(date '+%Y%m%d-%H%M%S').log"
  : >"$DEPLOY_LOG"
  chmod 640 "$DEPLOY_LOG" 2>/dev/null || true
}

dlog() {
  local target="${DEPLOY_LOG:-/dev/null}"
  printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*" | tee -a "$target"
}

# run_step "deskripsi" "/cwd" "perintah shell"
run_step() {
  local desc="$1" cwd="$2" cmd="$3" rc
  local target="${DEPLOY_LOG:-/dev/null}"

  printf '\n%s\n' "${C_BOLD}▶ ${desc}${C_RESET}" | tee -a "$target"
  printf '%s\n' "${C_DIM}$ ${cmd}${C_RESET}" | tee -a "$target"

  (cd "$cwd" && sudo -u "$REAL_USER" -H bash -ic "$cmd") 2>&1 | tee -a "$target"
  rc=${PIPESTATUS[0]}

  if [ "$rc" -ne 0 ]; then
    printf '%s\n' "${C_RED}✖ ${desc} gagal (exit ${rc})${C_RESET}" | tee -a "$target"
    return "$rc"
  fi

  printf '%s\n' "${C_GREEN}✔ ${desc}${C_RESET}" | tee -a "$target"
}

# ============================================================
# GIT
# ============================================================
urlencode() {
  local s="$1" out="" i c
  for ((i = 0; i < ${#s}; i++)); do
    c="${s:i:1}"
    case "$c" in
      [a-zA-Z0-9.~_-]) out+="$c" ;;
      *) out+="$(printf '%%%02X' "'$c")" ;;
    esac
  done
  printf '%s' "$out"
}

git_auth_url() {
  local url="$1"
  if [ -z "${GIT_USERNAME:-}" ]; then
    printf '%s' "$url"
    return
  fi
  printf 'https://%s:%s@%s' \
    "$(urlencode "$GIT_USERNAME")" \
    "$(urlencode "${GIT_TOKEN:-}")" \
    "${url#https://}"
}

prompt_git_auth() {
  GIT_USERNAME=""
  GIT_TOKEN=""
  printf '%s\n' "${C_DIM}Repo privat membutuhkan kredensial. Kosongkan username untuk mode anonim.${C_RESET}"
  read -rp "Git username: " GIT_USERNAME || true
  if [ -n "$GIT_USERNAME" ]; then
    read -rsp "Git password/token: " GIT_TOKEN || true
    printf '\n'
  fi
}

# ============================================================
# .ENV
# ============================================================
# set_env_key <file> <KEY> <VALUE> (updates or appends)
set_env_key() {
  local file="$1" key="$2" val="$3"
  touch "$file"

  if grep -q "^${key}=" "$file" 2>/dev/null; then
    CC_KEY="$key" CC_VAL="$val" awk '
      BEGIN { k = ENVIRON["CC_KEY"]; v = ENVIRON["CC_VAL"] }
      index($0, k "=") == 1 { print k "=" v; next }
      { print }
    ' "$file" >"$file.tmp" && mv "$file.tmp" "$file"
  else
    printf '%s=%s\n' "$key" "$val" >>"$file"
  fi
}

write_backend_env() {
  local dir="$1" f="$dir/.env"
  mkdir -p "$dir"
  touch "$f"

  set_env_key "$f" APP_NAME "$APP_NAME"
  set_env_key "$f" APP_PORT "$BACKEND_PORT"
  set_env_key "$f" APP_TIMEZONE "$APP_TIMEZONE"
  set_env_key "$f" APP_MODE "$APP_MODE"
  set_env_key "$f" LOGIN_TIMEOUT "$LOGIN_TIMEOUT"

  set_env_key "$f" DB_DIALECT "$DB_DIALECT"
  set_env_key "$f" DB_HOST "$DB_HOST"
  set_env_key "$f" DB_PORT "$DB_PORT"
  set_env_key "$f" DB_DATABASE "$DB_NAME"
  set_env_key "$f" DB_USER "$DB_USER"
  set_env_key "$f" DB_PASSWORD "$DB_PASSWORD"

  set_env_key "$f" BPOM_URL "$BPOM_URL"
  set_env_key "$f" BPOM_EMAIL "$BPOM_EMAIL"
  set_env_key "$f" BPOM_PASSWORD "$BPOM_PASSWORD"
  set_env_key "$f" CONNECTOR_BPOM "$BPOM_APP_PORT"
  set_env_key "$f" CONNECTOR_BPOM_NAME "$BPOM_APP_NAME"

  set_env_key "$f" NODE_ENV "production"

  chown "$REAL_USER":"$REAL_USER" "$f" 2>/dev/null || true
  chmod 600 "$f" 2>/dev/null || true
}

write_frontend_env() {
  local dir="$1" f="$dir/.env"
  mkdir -p "$dir"
  touch "$f"

  set_env_key "$f" VUE_APP_URL_API_MERTRACK "\"http://$SERVER_IP:$BACKEND_PORT\""
  set_env_key "$f" VUE_APP_DEFAULT_DATE_FILTER "\"$RANGE_TRANSACTION\""

  chown "$REAL_USER":"$REAL_USER" "$f" 2>/dev/null || true
}

# ============================================================
# PM2
# ============================================================
pm2_json() {
  sudo -u "$REAL_USER" -H bash -ic "pm2 jlist" 2>/dev/null
}

pm2_names() {
  local raw nb
  nb="$(node_bin)"
  [ -n "$nb" ] || return 1
  raw="$(pm2_json)" || return 1
  [ -n "$raw" ] || return 1
  printf '%s' "$raw" | "$nb" -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const s=d.indexOf("["),e=d.lastIndexOf("]");if(s<0||e<s)process.exit(1);let a;try{a=JSON.parse(d.slice(s,e+1))}catch(x){process.exit(1)};if(!Array.isArray(a))process.exit(1);a.forEach(p=>console.log(p.name))})'
}

pm2_has() {
  local names
  names="$(pm2_names)" || return 1
  printf '%s\n' "$names" | grep -Fxq -- "$1"
}

# id, name, status, cpu, memMB, uptimeMs, restarts, cwd
pm2_list_tsv() {
  local raw nb
  nb="$(node_bin)"
  [ -n "$nb" ] || return 1
  raw="$(pm2_json)" || return 1
  [ -n "$raw" ] || return 1
  printf '%s' "$raw" | "$nb" -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const s=d.indexOf("["),e=d.lastIndexOf("]");if(s<0||e<s)process.exit(1);let a;try{a=JSON.parse(d.slice(s,e+1))}catch(x){process.exit(1)};for(const p of a){const v=p.pm2_env||{},m=p.monit||{};const up=v.pm_uptime?Math.max(0,Date.now()-v.pm_uptime):0;console.log([p.pm_id==null?"":p.pm_id,p.name||"",v.status||"",Math.round(m.cpu||0),((m.memory||0)/1048576).toFixed(1),up,p.restart_time==null?0:p.restart_time,v.pm_cwd||""].join("\t"))}})'
}

# name, exec_path, cwd, interpreter, node_args, exec_mode, instances
pm2_meta() {
  local name="$1" raw nb
  nb="$(node_bin)"
  [ -n "$nb" ] || return 1
  raw="$(pm2_json)" || return 1
  [ -n "$raw" ] || return 1
  printf '%s' "$raw" | CC_NAME="$name" "$nb" -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const n=process.env.CC_NAME;const s=d.indexOf("["),e=d.lastIndexOf("]");if(s<0||e<s)process.exit(1);let a;try{a=JSON.parse(d.slice(s,e+1))}catch(x){process.exit(1)};const p=a.find(x=>x.name===n);if(!p)process.exit(2);const v=p.pm2_env||{};const na=Array.isArray(v.node_args)?v.node_args.join(" "):(v.node_args||v.interpreter_args||"");console.log([p.name,v.pm_exec_path||"",v.pm_cwd||"",v.exec_interpreter||"",na,v.exec_mode||"",v.instances||1].join("\t"))})'
}

pm2_save() {
  if ! run_as_user "pm2 save --force" >/dev/null 2>&1; then
    warn "pm2 save gagal."
    return 1
  fi
}

# Reload semua proses PM2 setelah .env ditulis ulang.
# mode: soft (reload --update-env) | force (delete + start ulang)
reload_env() {
  local mode="${1:-soft}" names name cmd meta
  local n exec cwd interp nargs emode inst args

  load_config
  deploy_log_init
  ensure_runtime_dirs

  if [ -d "$SERVICES_DIR" ]; then
    write_backend_env "$SERVICES_DIR"
    dlog "Menulis .env: $SERVICES_DIR/.env"
  fi

  names="$(pm2_names | grep -vx 'pm2-logrotate' || true)"
  if [ -z "$names" ]; then
    warn "Tidak ada proses PM2 yang bisa direload."
    return 1
  fi

  while IFS= read -r name; do
    [ -n "$name" ] || continue

    if [ "$mode" = "force" ]; then
      meta="$(pm2_meta "$name")" || {
        warn "Metadata proses '$name' tidak ditemukan, dilewati."
        continue
      }
      IFS=$'\t' read -r _ exec cwd interp nargs emode inst <<<"$meta"

      run_as_user "pm2 delete $(printf '%q' "$name")" >/dev/null 2>&1 || true

      args=(pm2 start "$exec" --name "$name")
      [ -n "$interp" ] && [ "$interp" != "node" ] && args+=(--interpreter "$interp")
      [ -n "$nargs" ] && args+=(--node-args "$nargs")
      [ "$emode" = "cluster_mode" ] && args+=(-i "${inst:-1}")

      printf -v cmd '%q ' "${args[@]}"
      run_step "Force start ${name}" "${cwd:-$RUNTIME_DIR}" "$cmd" || return 1
    else
      run_step "Reload ${name}" "$RUNTIME_DIR" "pm2 reload $(printf '%q' "$name") --update-env" || return 1
    fi
    sleep 2
  done <<<"$names"

  pm2_save
  ok "Reload .env selesai (mode: ${mode})."
}

# ============================================================
# DEPLOY BACKEND
# ============================================================
_require_deploy_user() {
  if [ "$REAL_USER" = "root" ]; then
    warn "APP_USER saat ini root. Aplikasi sebaiknya berjalan sebagai user non-root."
    if [ -t 0 ]; then
      confirm "Tetap lanjutkan?" || return 1
    fi
  fi
  return 0
}

# deploy_api_core [seed]
deploy_api_core() {
  local seed="${1:-}" tmp dest out script_file branch_arg="" repo_url env_file

  load_config
  _require_deploy_user || return 1
  prompt_git_auth
  deploy_log_init
  ensure_runtime_dirs

  tmp="$TEMP_DIR"
  dest="$SERVICES_DIR"

  dlog "Deploy API Core (${APP_NAME})"
  safe_rm "$tmp" || return 1
  mkdir -p "$tmp"
  chown "$REAL_USER":"$REAL_USER" "$tmp"

  [ -n "$BACKEND_BRANCH" ] && branch_arg="-b $(printf '%q' "$BACKEND_BRANCH")"
  repo_url="$(git_auth_url "$CORE_REPO")"

  run_step "Clone mertrack-core" "$RUNTIME_DIR" \
    "GIT_TERMINAL_PROMPT=0 git clone --depth 1 $branch_arg $(printf '%q' "$repo_url") $(printf '%q' "$tmp")" || {
    safe_rm "$tmp"
    return 1
  }

  script_file="$(pkg_name "$tmp/package.json")" || {
    err "package.json tidak ditemukan / tidak memiliki field name."
    safe_rm "$tmp"
    return 1
  }
  dlog "Entry script: ${script_file}.js"

  write_backend_env "$tmp"
  env_file="$tmp/.env"

  run_step "npm install" "$tmp" "npm install" || {
    safe_rm "$tmp"
    return 1
  }

  if [ "$seed" = "seed" ]; then
    run_step "Database seeding" "$tmp" "npx sequelize-cli db:seed:all" || {
      err "Seeding gagal. Periksa konfigurasi database."
      safe_rm "$tmp"
      return 1
    }
  fi

  run_step "npm run build" "$tmp" "npm run build" || {
    safe_rm "$tmp"
    return 1
  }

  out="$tmp/build"
  [ -d "$out" ] || out="$tmp/dist"
  [ -d "$out" ] || {
    err "Folder hasil build (build/ atau dist/) tidak ditemukan di $tmp"
    safe_rm "$tmp"
    return 1
  }

  # Folder services dipakai bersama (API Core + BPOM, sama seperti GUI Windows):
  # isi lama di-overwrite, folder TIDAK dihapus.
  mkdir -p "$dest"
  cp -a "$out/." "$dest/"
  cp -a "$env_file" "$dest/.env"
  cp -a "$tmp/package.json" "$dest/" 2>/dev/null || true
  [ -f "$tmp/package-lock.json" ] && cp -a "$tmp/package-lock.json" "$dest/" 2>/dev/null || true
  if [ -d "$tmp/node_modules" ]; then
    mkdir -p "$dest/node_modules"
    cp -a "$tmp/node_modules/." "$dest/node_modules/"
  fi
  chown -R "$REAL_USER":"$REAL_USER" "$dest"

  if [ ! -f "$dest/${script_file}.js" ]; then
    err "Entry ${script_file}.js tidak ditemukan di $dest"
    ls -la "$dest" || true
    return 1
  fi
  script_file="${script_file}.js"

  if pm2_has "$APP_NAME"; then
    run_in_user "$dest" "pm2 reload $(printf '%q' "$APP_NAME") --update-env" || return 1
  else
    run_in_user "$dest" "pm2 start $(printf '%q' "$script_file") --name $(printf '%q' "$APP_NAME")" || return 1
  fi

  pm2_save
  safe_rm "$tmp"
  ok "API Core (${APP_NAME}) berhasil di-deploy. Log: $DEPLOY_LOG"
}

deploy_bpom() {
  local tmp dest out script_file repo_url

  load_config
  _require_deploy_user || return 1
  prompt_git_auth
  deploy_log_init
  ensure_runtime_dirs

  tmp="$TEMP_DIR"
  dest="$SERVICES_DIR"

  dlog "Deploy BPOM API (${BPOM_APP_NAME})"
  safe_rm "$tmp" || return 1
  mkdir -p "$tmp"
  chown "$REAL_USER":"$REAL_USER" "$tmp"

  repo_url="$(git_auth_url "$BPOM_REPO")"

  run_step "Clone connector-bpom" "$RUNTIME_DIR" \
    "GIT_TERMINAL_PROMPT=0 git clone --depth 1 $(printf '%q' "$repo_url") $(printf '%q' "$tmp")" || {
    safe_rm "$tmp"
    return 1
  }

  script_file="$(pkg_name "$tmp/package.json")" || {
    err "package.json tidak ditemukan / tidak memiliki field name."
    safe_rm "$tmp"
    return 1
  }
  dlog "Entry script: ${script_file}.js"

  write_backend_env "$tmp"

  run_step "npm install" "$tmp" "npm install" || {
    safe_rm "$tmp"
    return 1
  }
  run_step "npm run build" "$tmp" "npm run build" || {
    safe_rm "$tmp"
    return 1
  }

  out="$tmp/build"
  [ -d "$out" ] || out="$tmp/dist"
  [ -d "$out" ] || {
    err "Folder hasil build (build/ atau dist/) tidak ditemukan di $tmp"
    safe_rm "$tmp"
    return 1
  }

  # services dipakai bersama API Core + BPOM (sama seperti GUI Windows):
  # overwrite isi lama, folder TIDAK dihapus.
  mkdir -p "$dest"
  cp -a "$out/." "$dest/"
  cp -a "$tmp/package.json" "$dest/" 2>/dev/null || true
  [ -f "$tmp/package-lock.json" ] && cp -a "$tmp/package-lock.json" "$dest/" 2>/dev/null || true
  if [ -f "$dest/.env" ]; then
    dlog "Memakai .env bersama: $dest/.env"
  else
    write_backend_env "$dest"
    dlog "Membuat .env bersama: $dest/.env"
  fi
  if [ ! -d "$dest/node_modules" ]; then
    warn "node_modules belum ada di $dest; deploy API Core dulu agar dependency tersedia."
  fi
  chown -R "$REAL_USER":"$REAL_USER" "$dest"

  if [ ! -f "$dest/${script_file}.js" ]; then
    err "Entry ${script_file}.js tidak ditemukan di $dest"
    ls -la "$dest" || true
    return 1
  fi
  script_file="${script_file}.js"

  if pm2_has "$BPOM_APP_NAME"; then
    run_in_user "$dest" "pm2 reload $(printf '%q' "$BPOM_APP_NAME") --update-env" || return 1
  else
    run_in_user "$dest" "pm2 start $(printf '%q' "$script_file") --name $(printf '%q' "$BPOM_APP_NAME")" || return 1
  fi

  pm2_save
  safe_rm "$tmp"
  ok "BPOM API (${BPOM_APP_NAME}) berhasil di-deploy. Log: $DEPLOY_LOG"
}

# ============================================================
# DEPLOY FRONTEND
# ============================================================
deploy_frontend() {
  local stage fe out backup had_previous=0 branch_arg="" repo_url

  load_config
  _require_deploy_user || return 1
  prompt_git_auth
  deploy_log_init
  ensure_runtime_dirs

  if [ -z "$FRONTEND_PORT" ]; then
    err "FRONTEND_PORT belum diset."
    return 1
  fi

  stage="$STAGING_DIR"
  fe="$stage/frontend"

  dlog "Deploy frontend (port ${FRONTEND_PORT})"
  safe_rm "$stage" || return 1
  mkdir -p "$fe"
  chown -R "$REAL_USER":"$REAL_USER" "$stage"

  [ -n "$FRONTEND_BRANCH" ] && branch_arg="-b $(printf '%q' "$FRONTEND_BRANCH")"
  repo_url="$(git_auth_url "$FRONTEND_REPO")"

  run_step "Clone mertrack_frontend" "$RUNTIME_DIR" \
    "GIT_TERMINAL_PROMPT=0 git clone --depth 1 $branch_arg $(printf '%q' "$repo_url") $(printf '%q' "$fe")" || {
    safe_rm "$stage"
    return 1
  }

  write_frontend_env "$fe"

  run_step "npm install (frontend)" "$fe" "npm install" || {
    safe_rm "$stage"
    return 1
  }
  run_step "npm run build" "$fe" "npm run build" || {
    safe_rm "$stage"
    return 1
  }

  out=""
  [ -f "$stage/public/index.html" ] && out="$stage/public"
  if [ -z "$out" ] && [ -f "$fe/dist/index.html" ]; then
    out="$fe/dist"
  fi
  if [ -z "$out" ]; then
    err "index.html hasil build tidak ditemukan (staging/public atau dist)."
    safe_rm "$stage"
    return 1
  fi

  backup="$stage/previous-public"
  if [ -d "$PUBLIC_DIR" ]; then
    mv "$PUBLIC_DIR" "$backup" || {
      err "Gagal memindahkan public lama."
      return 1
    }
    had_previous=1
  fi

  if ! mv "$out" "$PUBLIC_DIR"; then
    if [ "$had_previous" -eq 1 ]; then
      mv "$backup" "$PUBLIC_DIR" 2>/dev/null || true
    fi
    err "Gagal memindahkan hasil build ke $PUBLIC_DIR"
    return 1
  fi

  [ "$had_previous" -eq 1 ] && safe_rm "$backup"

  if getent group www-data >/dev/null 2>&1; then
    chown -R "$REAL_USER":www-data "$PUBLIC_DIR" 2>/dev/null || true
  else
    chown -R "$REAL_USER":"$REAL_USER" "$PUBLIC_DIR" 2>/dev/null || true
  fi
  find "$PUBLIC_DIR" -type d -exec chmod 755 {} + 2>/dev/null || true
  find "$PUBLIC_DIR" -type f -exec chmod 644 {} + 2>/dev/null || true
  chmod +x "$APP_DIR" "$RUNTIME_DIR" 2>/dev/null || true

  if ! write_nginx_site; then
    err "Frontend sudah dipasang, tetapi konfigurasi Nginx gagal. Periksa manual."
    return 1
  fi

  safe_rm "$stage"
  ok "Frontend berhasil di-deploy: http://${SERVER_IP}:${FRONTEND_PORT}"
}

# ============================================================
# NGINX
# ============================================================
nginx_test() {
  nginx -t 2>&1
}

nginx_reload() {
  if systemctl is-active --quiet nginx 2>/dev/null; then
    systemctl reload nginx
  else
    warn "Service nginx tidak aktif; reload dilewati."
    return 1
  fi
}

# Tulis /etc/nginx/sites-available/<site>, enable, test, reload.
# Jika nginx -t gagal, konfigurasi lama dikembalikan.
write_nginx_site() {
  local site avail link backup="" out

  load_config
  site="${NGINX_SITE_NAME:-mertrack_frontend}"
  site="${site%.conf}"
  [ -n "${NGINX_SERVER_NAME:-}" ] || NGINX_SERVER_NAME="_"
  avail="/etc/nginx/sites-available/$site"
  link="/etc/nginx/sites-enabled/$site"

  mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

  if [ -f "$avail" ]; then
    backup="$avail.bak.$(date '+%Y%m%d%H%M%S')"
    cp -a "$avail" "$backup"
  fi

  cat >"$avail" <<EOF
server {
    listen ${FRONTEND_PORT};
    server_name ${NGINX_SERVER_NAME};

    root "${PUBLIC_DIR}";
    index index.html index.htm;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://${SERVER_IP}:${BACKEND_PORT};
    }

    error_log  /var/log/nginx/${site}_error.log;
    access_log /var/log/nginx/${site}_access.log;
}
EOF

  ln -sfn "$avail" "$link"

  if ! have nginx; then
    warn "Nginx belum terinstall. File konfigurasi dibuat di $avail (belum diverifikasi)."
    return 0
  fi

  if ! out="$(nginx_test)"; then
    err "nginx -t gagal:"
    printf '%s\n' "$out" >&2
    if [ -n "$backup" ]; then
      cp -a "$backup" "$avail"
      warn "Konfigurasi lama dikembalikan dari $backup"
    else
      rm -f "$avail" "$link"
      warn "Konfigurasi baru dibatalkan."
    fi
    return 1
  fi

  nginx_reload || true
  [ -n "$backup" ] && rm -f "$backup"
  ok "Konfigurasi Nginx diterapkan: $link"
  return 0
}

# ============================================================
# LAIN-LAIN
# ============================================================
deploy_logrotate() {
  load_config
  deploy_log_init
  ensure_runtime_dirs

  run_step "Install pm2-logrotate" "$RUNTIME_DIR" "pm2 install pm2-logrotate" || return 1
  run_as_user "pm2 set pm2-logrotate:max_size 10M" >/dev/null 2>&1 || true
  run_as_user "pm2 set pm2-logrotate:retain 7" >/dev/null 2>&1 || true
  pm2_save
  ok "pm2-logrotate terpasang (max 10M, retain 7)."
}

setup_pm2_startup() {
  local out cmd
  load_config
  deploy_log_init

  if ! user_has pm2; then
    err "PM2 tidak ditemukan untuk user $REAL_USER."
    return 1
  fi

  out="$(run_as_user "pm2 startup systemd -u $(printf '%q' "$REAL_USER") --hp $(printf '%q' "$REAL_HOME")" 2>&1)"
  printf '%s\n' "$out"

  cmd="$(printf '%s\n' "$out" | grep -E '^sudo env|^env PATH' | head -n 1)"
  if [ -n "$cmd" ]; then
    eval "$cmd"
    run_as_user "pm2 save --force" >/dev/null 2>&1 || true
    ok "PM2 auto-start (systemd) aktif."
  else
    warn "Perintah startup tidak terdeteksi. Jalankan manual baris 'sudo env ...' di atas."
    return 1
  fi
}
