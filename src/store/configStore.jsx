import { create } from 'zustand';

export const useConfig = create((set) => ({
  config: null,
  setData: (data) => {
    set({ config: data });
    // simpan ke localStorage
    localStorage.setItem('config', JSON.stringify(data));
  },
  // init dari localStorage (biar tidak hilang saat refresh)
  init: () => {
    const stored = localStorage.getItem('config');
    if (stored) {
      set({ config: JSON.parse(stored) });
    }
  },
}));

export const useDevice = create((set, get) => ({
  // =============================
  // 🔌 CONNECTION STATE
  // =============================
  devices: {
    scanner1: { status: 0, status_desc: 'disconnected' },
    scanner2: { status: 0, status_desc: 'disconnected' },
    weigher: { status: 0, status_desc: 'disconnected' },
    ups: { status: 0, status_desc: 'disconnected' },
  },

  // =============================
  // 🔄 SET STATUS
  // =============================
  setDevice: (name, data) =>
    set((state) => ({
      devices: {
        ...state.devices,
        [name]: {
          ...state.devices[name],
          ...data,
        },
      },
    })),

  // =============================
  // 🔌 CONNECT DEVICE
  // =============================
  connectDevice: async (name) => {
    get().setDevice(name, {
      status: 1,
      status_desc: 'connected',
    });
  },

  // =============================
  // 🔌 DISCONNECT
  // =============================
  disconnectDevice: async (name) => {
    get().setDevice(name, {
      status: 0,
      status_desc: 'disconnected',
    });
  },
}));
