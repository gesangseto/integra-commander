import { create } from 'zustand';

/**
 * Store status aplikasi yang TIDAK dipersist (selalu dievaluasi ulang setiap
 * aplikasi dijalankan). Dipakai untuk menyimpan status hak Administrator dari
 * proses saat ini.
 *
 * `isAdmin`:
 * - `null`  → belum diketahui (masih proses deteksi)
 * - `true`  → berjalan sebagai Administrator
 * - `false` → berjalan tanpa hak Administrator (PM2 tidak dapat dipanggil)
 */
export const useAppStatusStore = create((set) => ({
  isAdmin: null,
  setIsAdmin: (isAdmin) => set({ isAdmin }),

  // Menandai proses PM2 `telemetry` (plugin otel-gui) sudah terpasang.
  // Dipakai SideBar untuk menampilkan / menyembunyikan menu Telemetry.
  telemetryInstalled: false,
  setTelemetryInstalled: (telemetryInstalled) => set({ telemetryInstalled }),
}));
