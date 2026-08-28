import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useSettingStore = create(
  persist(
    (set) => ({
      form: {
        appName: 'API_CORE_MERTRACK',
        workingDirectory: '',
        loginTimeout: '',
        rangeTransaction: 'last_1_week',
        serverIp: '',
        timezone: 'Asia/Jakarta',

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
          bpomUrl: '',
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
