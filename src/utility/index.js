import { Command } from '@tauri-apps/plugin-shell';
import { showGlobalAlert } from '../component/AlertProvider';

/**
 * Helper untuk membuka Windows Explorer pada path tertentu
 * @param {string} fullPath - Path folder atau file
 * @param {function} onError - Callback fungsi alert/toast untuk menampilkan error
 */
export const openLocation = async (fullPath, onError) => {
  try {
    if (!fullPath) return;
    // 1. Bersihkan path dari forward slash ke backslash
    let cleanPath = fullPath.replace(/\//g, '\\');
    // 2. LOGIKA HAPUS FILE:
    // Jika path mengandung titik (.) di bagian akhir (setelah backslash terakhir),
    // itu dianggap file. Kita ambil folder-nya saja.
    if (cleanPath.includes('.') && cleanPath.includes('\\')) {
      const lastSlashIndex = cleanPath.lastIndexOf('\\');
      cleanPath = cleanPath.substring(0, lastSlashIndex);
    }
    // 3. Tambahkan tanda kutip untuk menangani spasi
    const windowsPath = `${cleanPath}`;
    const cmd = Command.create('run-command', ['/C', 'explorer', windowsPath]);
    cmd.execute();
  } catch (error) {
    showGlobalAlert(`Gagal membuka lokasi: ${error}`, 'error');
    if (onError) onError(String(error));
  }
};

export async function getSystemInfo() {
  const cmd = Command.create('run-command', [
    '/C',
    'powershell',
    '-Command',
    `
    Get-CimInstance Win32_OperatingSystem |
    Select-Object TotalVisibleMemorySize,FreePhysicalMemory |
    ConvertTo-Json
    `,
  ]);
  const result = await cmd.execute();
  return JSON.parse(result.stdout);
}

// Baca total memori (working set) suatu proses via Get-Process (dalam MB).
// Lebih akurat & konsisten dengan Task Manager dibanding parsing `tasklist`.
async function getProcessMemoryMB(processName) {
  const cmd = Command.create('run-command', [
    '/C',
    'powershell',
    '-NoProfile',
    '-Command',
    `(Get-Process | Where-Object { $_.ProcessName -eq '${processName}' } | Measure-Object -Property WorkingSet64 -Sum).Sum`,
  ]);
  const result = await cmd.execute();
  const sumBytes = parseFloat((result.stdout || '').trim()) || 0;
  return Number((sumBytes / 1024 / 1024).toFixed(2));
}

export async function getNginxStatus() {
  const memoryMB = await getProcessMemoryMB('nginx');
  return memoryMB;
}
export async function getNodejsStatus() {
  const memoryMB = await getProcessMemoryMB('node');
  return memoryMB;
}

export async function getDatabaseStatus(process = 'sqlservr.exe') {
  // Hilangkan ekstensi .exe karena Get-Process memakai nama proses tanpa ekstensi
  const name = process.toLowerCase().replace(/\.exe$/, '');
  const memoryMB = await getProcessMemoryMB(name);
  return memoryMB;
}
export async function runCommand(args, cwd) {
  const cmd = Command.create('run-command', args, { cwd });
  const output = await cmd.execute();
  if (output.code !== 0) {
    throw new Error(
      output.stderr || output.stdout || `Command failed (${output.code})`,
    );
  }
  return output;
}

export function humanizeText(str) {
  if (!str) return '';
  if (typeof str === 'object') str = JSON.stringify(str);
  var i,
    frags = str.split('_');
  for (i = 0; i < frags.length; i++) {
    frags[i] = frags[i].charAt(0).toUpperCase() + frags[i].slice(1);
  }
  var humanized = frags.join(' ');
  // Mengganti 'id' menjadi 'ID' dalam format humanized
  humanized = humanized.replace(/\bid\b/gi, 'ID');
  return humanized;
}
