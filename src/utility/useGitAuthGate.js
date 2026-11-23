import { useEffect, useRef, useState } from 'react';
import { useSettingStore } from '../store/settingStore';
import { isGitAuthReady } from './gitUtility';
import useGitAuth from './useGitAuth';

/**
 * Satu sumber kumpulan alur autentikasi Git untuk seluruh aplikasi.
 *
 * Mengembalikan:
 * - `ready`      : kredensial tersimpan & valid (boleh skip prompt).
 * - `gitForm`    : nilai form (username/password) yang dipakai onSubmit & dialog.
 * - `setGitForm` : setter form.
 * - `open`       : status dialog terbuka.
 * - `setOpen`    : kontrol manual dialog (mis. tombol Unlock).
 * - `openGate`   : dipakai di tombol aksi. Bila `ready` → jalankan `onSubmit`
 *                  otomatis tanpa dialog; bila belum → buka dialog.
 *
 * `onSubmit` dijalankan lewat effect (bukan sinkron di dalam handler) supaya
 * closure-nya membaca state terkini (mis. selectedDeploy/pendingReload yang
 * di-set pada handler yang sama sebelum openGate dipanggil).
 */
export default function useGitAuthGate(onSubmit) {
  const gitAuth = useSettingStore((state) => state.gitAuth);
  const ready = isGitAuthReady(gitAuth);
  const [gitForm, setGitForm] = useGitAuth();
  const [open, setOpen] = useState(false);
  const [runId, setRunId] = useState(0);

  // Simpan onSubmit terbaru tanpa membuat effect ikut ter-trigger tiap render.
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;

  useEffect(() => {
    if (runId > 0 && ready) {
      submitRef.current();
    }
    // Hanya berjalan saat openGate menaikkan runId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const openGate = () => {
    if (ready) {
      setRunId((n) => n + 1);
    } else {
      setOpen(true);
    }
  };

  return { ready, open, setOpen, gitForm, setGitForm, openGate };
}