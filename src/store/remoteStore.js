import { create } from 'zustand';

/**
 * Status REALTIME menu Remote Connection.
 *
 * Sengaja tidak dipersist: kondisi tailnet (service jalan/belum, siapa saja
 * peer yang online) berubah setiap saat, jadi selalu dibaca ulang dari
 * `tailscale status` saat layar dibuka. Kredensialnya yang tersimpan, di
 * `settingStore.tailscaleAuth`.
 */
export const useRemoteStore = create((set) => ({
  // Hasil getRemoteInfo(): installed, version, backendState, self, tailnet, peers, problem
  info: null,
  loadingStatus: false,
  joining: false,
  installing: false,

  // Baris keluaran `tailscale up` / winget (sudah dibersihkan dari auth key).
  log: [],

  setInfo: (info) => set({ info }),
  setLoadingStatus: (loadingStatus) => set({ loadingStatus }),
  setJoining: (joining) => set({ joining }),
  setInstalling: (installing) => set({ installing }),

  appendLog: (line) =>
    set((state) => ({ log: [...state.log, line].slice(-400) })),
  clearLog: () => set({ log: [] }),

  reset: () =>
    set({
      info: null,
      loadingStatus: false,
      joining: false,
      installing: false,
      log: [],
    }),
}));
