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

        backendPort: '',
        backendBranch: '',
        frontendPort: '',
        frontendBranch: '',

        databaseDialect: '',
        databasePort: '',
        databaseName: '',
        databaseUser: '',
        databasePassword: '',
      },

      setForm: (data) =>
        set((state) => ({
          form: {
            ...state.form,
            ...data,
          },
        })),

      resetForm: () =>
        set({
          form: {
            appName: 'API_CORE_MERTRACK',
            workingDirectory: '',
            loginTimeout: '',
            rangeTransaction: 'last_1_week',
            serverIp: '',

            backendPort: '',
            backendBranch: '',
            frontendPort: '',
            frontendBranch: '',

            databaseDialect: '',
            databasePort: '',
            databaseName: '',
            databaseUser: '',
            databasePassword: '',
          },
        }),
    }),
    {
      name: 'setting-storage',
    },
  ),
);
