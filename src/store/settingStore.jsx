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

      // Kunci integrasi Tailscale untuk menu Remote Connection. Sama seperti
      // gitAuth, disimpan di luar `form` agar tidak ikut terhapus saat reset.
      tailscaleAuth: { authKey: '', hostname: '', loginServer: '' },

      setTailscaleAuth: (data) =>
        set((state) => ({
          tailscaleAuth: { ...state.tailscaleAuth, ...data },
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

        // Konfigurasi OpenTelemetry. Nilai ini ditulis ke file `.env`
        // (replace/append) saat deploy / Reload .env di TabPm2, lalu
        // dipakai juga oleh halaman Telemetry (endpoint otel-gui).
        telemetryEnabled: 'true',
        otelServiceName: 'mertrack-api',
        otelServiceVersion: '4.3.1',
        otelExporterOtlpEndpoint: 'http://localhost:4318',
        otelMetricExportInterval: '60000',
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

          telemetryEnabled: 'true',
          otelServiceName: 'mertrack-api',
          otelServiceVersion: '4.3.1',
          otelExporterOtlpEndpoint: 'http://localhost:4318',
          otelMetricExportInterval: '60000',
        };
        set({ form: defaultForm });
      },
    }),
    {
      name: 'setting-storage',
      // Persisted state menimpa `form` secara shallow. Merge eksplisit
      // diperlukan agar field baru (mis. konfigurasi Telemetry) tetap
      // mendapat nilai default saat storage lama belum memilikinya.
      merge: (persisted, current) => ({
        ...current,
        ...(persisted || {}),
        form: { ...current.form, ...((persisted && persisted.form) || {}) },
      }),
      // Tambahkan logging untuk persist
      onRehydrateStorage: () => (state) => {},
    },
  ),
);
