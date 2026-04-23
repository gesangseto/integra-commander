import { create } from 'zustand';

export const stationAuthStore = create((set) => ({
  token: 'AG-5A0DC3AA-3385-6C4B-A7AE-2D07C880C436',
  setToken: (token) => set({ token }),
}));

export const useAuthStore = create((set) => ({
  user: null,
  login: (userData) => {
    set({ user: userData });
    // simpan ke localStorage
    localStorage.setItem('user', JSON.stringify(userData));
  },
  logout: () => {
    set({ user: null });
    localStorage.removeItem('user');
  },
  // init dari localStorage (biar tidak hilang saat refresh)
  init: () => {
    const stored = localStorage.getItem('user');
    if (stored) {
      set({ user: JSON.parse(stored) });
    }
  },
}));

export const useAuthStorePanelA = create((set) => ({
  user: null,

  login: (userData) => {
    set({ user: userData });

    // simpan ke localStorage
    localStorage.setItem('userPanelA', JSON.stringify(userData));
  },

  logout: () => {
    set({ user: null });
    localStorage.removeItem('userPanelA');
  },

  // init dari localStorage (biar tidak hilang saat refresh)
  init: () => {
    const stored = localStorage.getItem('userPanelA');
    if (stored) {
      set({ user: JSON.parse(stored) });
    }
  },
}));

export const useAuthStorePanelB = create((set) => ({
  user: null,

  login: (userData) => {
    set({ user: userData });

    // simpan ke localStorage
    localStorage.setItem('userPanelB', JSON.stringify(userData));
  },

  logout: () => {
    set({ user: null });
    localStorage.removeItem('userPanelB');
  },

  // init dari localStorage (biar tidak hilang saat refresh)
  init: () => {
    const stored = localStorage.getItem('userPanelB');
    if (stored) {
      set({ user: JSON.parse(stored) });
    }
  },
}));
