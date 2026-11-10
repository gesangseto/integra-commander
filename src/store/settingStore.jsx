import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useSettingStore = create(
  persist(
    (set) => ({
      // Kredensial Git disimpan terpisah dari `form` supaya tidak ikut
      // terhapus saat reset/refresh konfigurasi aplikasi.
      gitAuth: { username: '', password: '' },

      setGitAuth: (data) =>
        set((state) => ({
          gitAuth: { ...state.gitAuth, ...data },
        })),

      form: {
        appName: 'API_CORE_MERTRACK',
        workingDirectory: '',
        loginTimeout: '',
        rangeTransaction: 'last_1_week',
        serverIp: '',
        timezone: 'Asia/Jakarta',
        appMode: 'development',

        backendPort: '',
        backendBranch: '',
        frontendPort: '',
        frontendBranch: '',

        databaseDialect: '',
        databasePort: '',
        databaseName: '',
        databaseUser: '',
        databasePassword: '',

        bpomAppPort: '',
        bpomAppName: '',
        bpomEmail: '',
        bpomPassword: '',
        bpomUrl: 'https://ttacdev.pom.go.id/dev/public/api/v3/',
      },

      setForm: (data) =>
        set((state) => {
          const newForm = {
            ...state.form,
            ...data,
          };
          return { form: newForm };
        }),

      resetForm: () => {
        const defaultForm = {
          appName: 'API_CORE_MERTRACK',
          workingDirectory: '',
          loginTimeout: '',
          rangeTransaction: 'last_1_week',
          serverIp: '',
          timezone: 'Asia/Jakarta',
          appMode: 'development',

          backendPort: '',
          backendBranch: '',
          frontendPort: '',
          frontendBranch: '',

          databaseDialect: '',
          databasePort: '',
          databaseName: '',
          databaseUser: '',
          databasePassword: '',

          bpomAppPort: '',
          bpomAppName: '',
          bpomEmail: '',
          bpomPassword: '',
          bpomUrl: 'https://ttacdev.pom.go.id/dev/public/api/v3/',
        };
        set({ form: defaultForm });
      },
    }),
    {
      name: 'setting-storage',
      // Tambahkan logging untuk persist
      onRehydrateStorage: () => (state) => {},
    },
  ),
);
