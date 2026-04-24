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
