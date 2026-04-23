import { create } from 'zustand';

export const useBatchStore = create((set) => ({
  process_order: null,
  setPo: (data) => {
    set({ process_order: data });
    // simpan ke localStorage
    localStorage.setItem('process_order', JSON.stringify(data));
  },
  removePo: () => {
    set({ process_order: null });
    localStorage.removeItem('process_order');
  },
}));
