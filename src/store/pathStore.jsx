import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAppStore = create(
  persist(
    (set) => ({
      // --- NGINX ---
      nginxPath: 'C:\\nginx',
      nginxVersion: null,

      // --- PM2 ---
      pm2Path: '',
      pm2Version: null,

      // --- NODE & NPM ---
      nodeVersion: null,
      npmVersion: null,

      // --- VERSI TERDEPLOY ---
      // Catatan branch + commit terakhir hasil clone, disimpan per item list
      // (kunci `PM2:<nama proses>` atau `NGINX:<nama config>`).
      deployInfo: {},

      // --- ACTIONS ---
      setDeployInfo: (key, info) =>
        set((state) => ({
          deployInfo: { ...state.deployInfo, [key]: info },
        })),

      setNginxPath: (path) => set({ nginxPath: path }),

      setPm2Path: (path) => set({ pm2Path: path }),

      // Action massal untuk versi (agar kode di Header lebih pendek)
      setVersions: (versions) =>
        set((state) => ({
          nginxVersion: versions.nginx ?? state.nginxVersion,
          pm2Version: versions.pm2 ?? state.pm2Version,
          nodeVersion: versions.node ?? state.nodeVersion,
          npmVersion: versions.npm ?? state.npmVersion,
        })),

      // Reset data jika diperlukan
      resetStore: () =>
        set({
          nginxVersion: null,
          pm2Version: null,
          nodeVersion: null,
          npmVersion: null,
        }),
    }),
    {
      name: 'mertrack-app-storage', // Key unik di LocalStorage
    },
  ),
);
