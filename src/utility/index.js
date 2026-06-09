import { Command } from '@tauri-apps/plugin-shell';

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

export async function getNginxStatus() {
  const cmd = Command.create('run-command', [
    '/C',
    'tasklist',
    '/FI',
    'IMAGENAME eq nginx.exe',
  ]);
  const result = await cmd.execute();
  const lines = result.stdout
    .split('\n')
    .filter((x) => x.trim().startsWith('nginx.exe'));
  let totalMemory = 0;
  for (const line of lines) {
    const match = line.match(/([\d,]+)\s*K/i);
    if (match) {
      totalMemory += parseInt(match[1].replace(/,/g, ''));
    }
  }
  let res = {
    running: lines.length > 0,
    processCount: lines.length,
    memoryMB: (totalMemory / 1024).toFixed(2),
  };
  return res.memoryMB;
}
export async function getNodejsStatus() {
  const cmd = Command.create('run-command', [
    '/C',
    'tasklist',
    '/FI',
    'IMAGENAME eq node.exe',
  ]);
  const result = await cmd.execute();
  const lines = result.stdout
    .split('\n')
    .filter((x) => x.trim().startsWith('node.exe'));
  let totalMemory = 0;
  for (const line of lines) {
    const match = line.match(/([\d,]+)\s*K/i);
    if (match) {
      totalMemory += parseInt(match[1].replace(/,/g, ''));
    }
  }
  let res = {
    running: lines.length > 0,
    processCount: lines.length,
    memoryMB: Number((totalMemory / 1024).toFixed(2)),
  };
  return res.memoryMB;
}

export async function getDatabaseStatus(process = 'sqlservr.exe') {
  const cmd = Command.create('run-command', [
    '/C',
    'tasklist',
    '/FI',
    `IMAGENAME eq ${process}`,
  ]);

  const result = await cmd.execute();

  const lines = result.stdout
    .split('\n')
    .filter((x) => x.trim().startsWith('sqlservr.exe'));

  let totalMemory = 0;

  for (const line of lines) {
    const match = line.match(/([\d,]+)\s*K/i);

    if (match) {
      totalMemory += parseInt(match[1].replace(/,/g, ''));
    }
  }

  let res = {
    running: lines.length > 0,
    processCount: lines.length,
    memoryMB: Number((totalMemory / 1024).toFixed(2)),
  };
  return res.memoryMB;
}
