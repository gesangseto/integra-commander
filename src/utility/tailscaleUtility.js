import { exists } from '@tauri-apps/plugin-fs';
import { Command } from '@tauri-apps/plugin-shell';

// Semua panggilan Tailscale berjalan lewat `cmd /C` agar memakai izin shell
// `run-command` yang sudah ada di capabilities/default.json (tanpa perubahan Rust).

// Lokasi baku instalasi Tailscale for Windows. Dipakai bila `where tailscale`
// gagal, misalnya PATH belum dimuat ulang sesudah instalasi.
const DEFAULT_INSTALL_PATH = 'C:\\Program Files\\Tailscale\\tailscale.exe';

let tailscalePathCache = '';

const isIPv4 = (ip) => /^\d+\.\d+\.\d+\.\d+$/.test(String(ip || ''));

// `gesangmmds.tail3dd3f4.ts.net.` -> `gesangmmds.tail3dd3f4.ts.net`
const cleanDns = (value) => String(value || '').trim().replace(/\.$/, '');

// Nama tailnet diambil dari DNSName self: `host.tailXXXX.ts.net` -> `tailXXXX.ts.net`
const tailnetFromDns = (dnsName) => {
  const parts = cleanDns(dnsName).split('.');
  return parts.length > 2 ? parts.slice(1).join('.') : '';
};

// Kunci integrasi setara izin gabung ke tailnet: jangan pernah masuk log.
function maskKey(text, key) {
  const value = String(text || '');
  return key ? value.replaceAll(key, '****') : value;
}

/**
 * Halaman login Tailscale selalu berbentuk `<login server>/a/<token>`,
 * baik di tailscale.com maupun di Headscale milik sendiri.
 * @returns {string} URL bila ditemukan di baris ini, selain itu ''.
 */
export function extractAuthUrl(text) {
  const match = String(text || '').match(/https?:\/\/\S+\/a\/[A-Za-z0-9._~-]+/);
  return match ? match[0].replace(/[.,;:)]+$/, '') : '';
}

// `https://login.tailscale.com/a/5022ff341bc01` -> `https://login.tailscale.com/a/****`
function maskAuthUrl(text) {
  return String(text || '').replace(
    /(https?:\/\/\S+\/a\/)[A-Za-z0-9._~-]+/g,
    '$1****',
  );
}

function executeTailscale(args, bin) {
  return Command.create('run-command', [
    '/C',
    bin || 'tailscale',
    ...args,
  ]).execute();
}

/**
 * Lokasi `tailscale.exe`: hasil `where`, lalu fallback ke folder instalasi baku.
 * @returns {Promise<string>} Path lengkap, atau '' bila belum terpasang.
 */
export async function getTailscalePath() {
  if (tailscalePathCache) return tailscalePathCache;
  try {
    const out = await Command.create('run-command', [
      '/C',
      'where',
      'tailscale',
    ]).execute();
    const found = (out.stdout || '')
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean);
    if (found) {
      tailscalePathCache = found;
      return found;
    }
  } catch (_) {
    /* tailscale belum ada di PATH */
  }
  try {
    if (await exists(DEFAULT_INSTALL_PATH)) {
      tailscalePathCache = DEFAULT_INSTALL_PATH;
      return DEFAULT_INSTALL_PATH;
    }
  } catch (_) {
    /* fs scope menolak / file tidak ada */
  }
  return '';
}

/**
 * Status tailnet PC ini + daftar perangkat lain, hasil `tailscale status --json`.
 * Tidak pernah mengubah kondisi koneksi.
 *
 * @returns {Promise<{installed:boolean,path:string,version:string,backendState:string,
 *   authURL:string,self:Object|null,tailnet:string,peers:Array,problem:string}>}
 */
export async function getRemoteInfo() {
  const path = await getTailscalePath();
  const info = {
    installed: Boolean(path),
    path,
    version: '',
    backendState: '',
    authURL: '',
    self: null,
    tailnet: '',
    peers: [],
    problem: '',
  };
  if (!path) {
    info.problem = 'Tailscale belum terpasang di PC ini.';
    return info;
  }

  try {
    const versionOut = await executeTailscale(['version'], path);
    info.version = (versionOut.stdout || '')
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean);
  } catch (_) {
    /* versi bukan syarat jalan */
  }

  let statusOut = null;
  try {
    statusOut = await executeTailscale(['status', '--json'], path);
  } catch (error) {
    info.problem = `${error}`;
    return info;
  }

  const raw = (statusOut.stdout || '').trim();
  // Keluaran bukan JSON: service berhenti, belum login, atau CLI error.
  if (!raw.startsWith('{')) {
    let message = (statusOut.stderr || raw || '').trim();
    try {
      const plain = await executeTailscale(['status'], path);
      message = (plain.stderr || plain.stdout || message).trim();
    } catch (_) {
      /* pakai pesan yang sudah ada */
    }
    info.problem =
      message || 'Tidak dapat membaca status Tailscale (service mungkin berhenti).';
    return info;
  }

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    info.problem = `Status Tailscale tidak dapat dibaca: ${error.message}`;
    return info;
  }

  info.backendState = parsed.BackendState || '';
  // Diisi server kontrol saat ada proses login yang menunggu di browser.
  info.authURL = parsed.AuthURL || '';
  // Nama tailnet: suffix DNS magic adalah label paling netral. `CurrentTailnet.Name`
  // berisi email pemilik akun, jadi tidak dipakai di UI.
  info.tailnet =
    parsed.MagicDNSSuffix ||
    (parsed.CurrentTailnet && parsed.CurrentTailnet.MagicDNSSuffix) ||
    tailnetFromDns((parsed.Self || {}).DNSName);
  const self = parsed.Self;
  if (self) {
    info.self = {
      id: self.ID || '',
      hostName: self.HostName || '',
      dnsName: cleanDns(self.DNSName),
      ips: self.TailscaleIPs || [],
      ip: (self.TailscaleIPs || []).find(isIPv4) || '',
      os: self.OS || '',
      online: Boolean(self.Online),
      keyExpiry: self.KeyExpiry || null,
      curAddr: self.CurAddr || '',
      relay: self.Relay || '',
    };
  }

  info.peers = Object.values(parsed.Peer || {})
    .map((peer) => ({
      id: peer.ID || '',
      hostName: peer.HostName || '',
      dnsName: cleanDns(peer.DNSName),
      ips: peer.TailscaleIPs || [],
      ip: (peer.TailscaleIPs || []).find(isIPv4) || '',
      os: peer.OS || '',
      online: Boolean(peer.Online),
      lastSeen: peer.LastSeen || null,
      curAddr: peer.CurAddr || '',
      relay: peer.Relay || '',
    }))
    .sort((a, b) => String(a.hostName).localeCompare(String(b.hostName)));

  return info;
}

// `tailscale up` bisa menunggu lama (auth/pairing), jadi dijalankan dengan
// spawn + streaming agar bisa ditampilkan dan dibatalkan.
let activeChild = null;

/**
 * Jalankan `tailscale up` dengan flag yang sudah disusun.
 *
 * @param {string[]} flags           - Flag setelah `up`, mis. `--auth-key=...`.
 * @param {Object} options
 * @param {string} [options.secret]  - Nilai yang disensor dari log (auth key).
 * @param {(line: string) => void} [options.onLine]
 * @param {(url: string) => void} [options.onAuthUrl] - Sekali saja, saat URL login muncul.
 * @returns {Promise<{code:number, output:string, authUrl:string}>}
 */
async function runUp(flags, { secret = '', onLine = () => {}, onAuthUrl = () => {} } = {}) {
  const bin = await getTailscalePath();
  const cmd = Command.create('run-command', [
    '/C',
    bin || 'tailscale',
    'up',
    ...flags,
  ]);

  const lines = [];
  let authUrl = '';
  let authUrlSent = false;
  const emit = (chunk) => {
    for (const line of String(chunk || '').split(/\r?\n/)) {
      const raw = line.trim();
      if (!raw) continue;
      if (!authUrl) authUrl = extractAuthUrl(raw);
      // Token login = izin gabung, jadi tidak ditampilkan apa adanya.
      const text = maskAuthUrl(maskKey(raw, secret));
      lines.push(text);
      onLine(text);
      if (authUrl && !authUrlSent) {
        authUrlSent = true;
        onAuthUrl(authUrl);
      }
    }
  };
  cmd.stdout.on('data', emit);
  cmd.stderr.on('data', emit);

  const done = new Promise((resolve, reject) => {
    cmd.on('close', (data) => {
      activeChild = null;
      resolve({ code: data.code, output: lines.join('\n'), authUrl });
    });
    cmd.on('error', (error) => {
      activeChild = null;
      reject(new Error(maskKey(error, secret)));
    });
  });

  activeChild = await cmd.spawn();
  return done;
}

/** Flag `--hostname` / `--login-server`; keduanya opsional. */
function serverFlags({ hostname = '', loginServer = '' }) {
  const flags = [];
  if (hostname) flags.push(`--hostname=${hostname}`);
  if (loginServer) flags.push(`--login-server=${loginServer}`);
  return flags;
}

/**
 * Gabungkan PC ini ke tailnet memakai auth key (jalur otomatis/ tanpa browser).
 *
 * @param {Object} options
 * @param {string} options.authKey      - Kunci integrasi (tskey-auth-...).
 * @param {string} [options.hostname]   - Nama PC di tailnet (opsional).
 * @param {string} [options.loginServer]- Server kontrol sendiri/Headscale (opsional).
 * @param {(line: string) => void} [options.onLine] - Panggilan per baris keluaran.
 * @returns {Promise<{code:number, output:string, authUrl:string}>}
 */
export async function joinTailnet({
  authKey,
  hostname = '',
  loginServer = '',
  onLine = () => {},
} = {}) {
  if (!authKey) throw new Error('Auth key Tailscale belum diisi.');

  return runUp([`--auth-key=${authKey}`, ...serverFlags({ hostname, loginServer })], {
    secret: authKey,
    onLine,
  });
}

/**
 * Login Tailscale yang sesungguhnya: `tailscale up` tanpa kunci. CLI mencetak
 * URL halaman login, browser dibuka, dan akun yang dipakai bisa akun biasa
 * maupun akun domain sendiri (Google Workspace / Microsoft / OIDC).
 *
 * @param {Object} options
 * @param {string} [options.hostname]
 * @param {string} [options.loginServer]
 * @param {(line: string) => void} [options.onLine]
 * @param {(url: string) => void} [options.onAuthUrl]
 * @returns {Promise<{code:number, output:string, authUrl:string}>}
 */
export async function loginWithBrowser({
  hostname = '',
  loginServer = '',
  onLine = () => {},
  onAuthUrl = () => {},
} = {}) {
  return runUp(serverFlags({ hostname, loginServer }), { onLine, onAuthUrl });
}

/** Batalkan `tailscale up` yang sedang berjalan (bukan logout). */
export async function cancelJoin() {
  if (!activeChild) return false;
  try {
    await activeChild.kill();
    return true;
  } catch (_) {
    return false;
  } finally {
    activeChild = null;
  }
}

/** Putus & keluar dari tailnet. Sessi PC ini perlu auth key baru untuk gabung. */
export async function logoutTailnet() {
  const bin = await getTailscalePath();
  const out = await executeTailscale(['logout'], bin);
  if (out.code !== 0) {
    throw new Error(
      (out.stderr || out.stdout || 'tailscale logout gagal').trim(),
    );
  }
  return out;
}

/**
 * Pasang Tailscale lewat winget. Butuh koneksi internet, dan pada sebagian
 * PC perlu jalankan aplikasi sebagai Administrator.
 */
export async function installTailscale(onLine = () => {}) {
  const cmd = Command.create('run-command', [
    '/C',
    'winget',
    'install',
    '-e',
    '--id',
    'Tailscale.Tailscale',
    '--accept-source-agreements',
    '--accept-package-agreements',
  ]);
  const lines = [];
  const emit = (chunk) => {
    for (const line of String(chunk || '').split(/\r?\n/)) {
      const text = line.trim();
      if (!text) continue;
      lines.push(text);
      onLine(text);
    }
  };
  cmd.stdout.on('data', emit);
  cmd.stderr.on('data', emit);

  const done = new Promise((resolve, reject) => {
    cmd.on('close', (data) =>
      resolve({ code: data.code, output: lines.join('\n') }),
    );
    cmd.on('error', (error) => reject(new Error(`${error}`)));
  });

  await cmd.spawn();
  return done;
}

/**
 * Uji jangkauan sebuah IP tailnet. `ping` Windows mencetak TTL= hanya bila
 * ada balasan, jadi itu penanda sukses yang paling stabil.
 */
export async function pingHost(target) {
  const out = await Command.create('run-command', [
    '/C',
    'ping',
    '-n',
    '2',
    '-w',
    '1200',
    target,
  ]).execute();
  const text = `${out.stdout || ''}${out.stderr || ''}`;
  return {
    ok: out.code === 0 && /TTL=/i.test(text),
    detail: text
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-2)
      .join(' '),
  };
}

/**
 * Buka URL service PC lain lewat browser standar.
 * `start` dipakai (bukan plugin opener) agar tidak perlu menambah izin baru.
 */
export async function openUrl(url) {
  await Command.create('run-command', ['/C', 'start', url]).execute();
}

/** Nama PC saat ini, dipakai sebagai nilai awal hostname tailnet. */
export async function getComputerName() {
  try {
    const out = await Command.create('run-command', [
      '/C',
      'echo',
      '%COMPUTERNAME%',
    ]).execute();
    return (out.stdout || '').trim();
  } catch (_) {
    return '';
  }
}

/**
 * Hostname tailnet harus aman sebagai label DNS. Spasi dan karakter lain
 * diganti tanda hubung; jika kosong, jangan kirim flag.
 */
export function normalizeHostname(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

/** Kunci integrasi Tailscale selalu diawali `tskey-auth-`. */
export function looksLikeAuthKey(value) {
  return /^tskey-[a-z0-9-]+$/i.test(String(value || '').trim());
}

/**
 * Validasi isi dialog kredensial Tailscale. Polanya sama seperti
 * `gitValidation`: `{ error, message }`.
 *
 * Auth key boleh kosong: artinya PC gabung lewat login browser, yang tidak
 * memerlukan kunci sama sekali.
 */
export function tailscaleValidation(form) {
  const authKey = String(form?.authKey || '').trim();
  if (authKey && !looksLikeAuthKey(authKey)) {
    return {
      error: true,
      message:
        'Format auth key tidak dikenali. Kunci Tailscale selalu diawali "tskey-".',
    };
  }
  const loginServer = String(form?.loginServer || '').trim();
  if (loginServer && !/^https?:\/\//i.test(loginServer)) {
    return {
      error: true,
      message: 'Login server harus diawali http:// atau https://',
    };
  }
  return {
    error: false,
    message: authKey
      ? 'Kredensial tersimpan. Auth key dipakai saat gabung.'
      : 'Kredensial tersimpan. Kosong auth key = gabung lewat login browser.',
  };
}

/**
 * Kegagalan `tailscale up` yang paling umum dijelaskan agar user tahu
 * tindakannya, bukan membaca output mentah.
 */
export function explainJoinError(output) {
  const text = String(output || '');
  if (/expired|kedaluwarsa/i.test(text)) {
    return 'Auth key sudah kedaluwarsa (umur maksimal Tailscale 90 hari). Buat kunci baru di admin console, atau pakai tombol "Login lewat browser" yang tidak memerlukan auth key.';
  }
  if (/invalid.*auth|auth.*invalid|bad request/i.test(text)) {
    return 'Auth key ditolak server Tailscale. Buat kunci baru di admin console Tailscale (Generate auth key), pastikan belum kedaluwarsa dan tidak dibatasi node.';
  }
  if (/access is denied|denied/i.test(text)) {
    return 'Ditolak sistem. Jalankan IntegraCommander sebagai Administrator lalu ulangi.';
  }
  if (/ipn|service|not running|pipe/i.test(text)) {
    return 'Service Tailscale belum berjalan. Buka aplikasi Tailscale di system tray (atau install lebih dulu), lalu coba lagi.';
  }
  if (/timeout|no route|network/i.test(text)) {
    return 'Tidak berhasil menghubungi server Tailscale. Cek koneksi internet PC ini.';
  }
  return text.trim() || 'Gagal bergabung ke tailnet.';
}
