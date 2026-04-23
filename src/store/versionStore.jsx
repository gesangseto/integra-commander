import { create } from 'zustand';

export const versionStore = create((set) => ({
  nginx: null,
  pm2: null,
  npm: null,
  node: null,
  setNginx: (data) => set({ nginx: data }),
  setPm2: (data) => set({ pm2: data }),
  setNpm: (data) => set({ npm: data }),
  setNode: (data) => set({ node: data }),
}));
