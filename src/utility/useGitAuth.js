import { useEffect, useState } from 'react';
import { useSettingStore } from '../store/settingStore';

/**
 * Kredensial Git untuk dialog autentikasi.
 *
 * Mengambil username/password yang sudah disimpan lewat tombol gembok di
 * halaman Settings, sehingga user tidak perlu mengetik ulang di setiap form.
 * `gitAuth` hanya berubah identitas saat disimpan ulang, jadi sinkronisasi
 * berikut tidak menimpa nilai yang sedang diketik user.
 */
export default function useGitAuth() {
  const gitAuth = useSettingStore((state) => state.gitAuth);
  const [gitForm, setGitForm] = useState(gitAuth);

  useEffect(() => {
    setGitForm(gitAuth);
  }, [gitAuth]);

  return [gitForm, setGitForm];
}
