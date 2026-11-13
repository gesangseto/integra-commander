import { create } from 'zustand';

/**
 * Status Deployment Manager yang dibuat GLOBAL (tidak dipersist) supaya proses
 * build/deploy yang sedang berjalan tidak hilang saat dialog ditutup, pindah
 * tab, atau pindah halaman. Log & status tetap hidup karena disimpan di store,
 * bukan di component yang ikut unmount.
 *
 * `target`: key app yang sedang di-deploy, `''` berarti idle.
 */
export const useDeployStore = create((set) => ({
  open: false,
  logs: [],
  target: '',

  setOpen: (open) => set({ open }),

  // Mulai deploy: tandai target sekaligus reset log deploy sebelumnya.
  start: (target) => set({ target, logs: [] }),
  finish: () => set({ target: '' }),

  appendLog: (msg) =>
    set((state) => ({
      logs: [...state.logs, `[${new Date().toLocaleTimeString()}] ${msg}`],
    })),
  clearLogs: () => set({ logs: [] }),
}));
