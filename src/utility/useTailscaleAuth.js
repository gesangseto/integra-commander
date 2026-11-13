import { useEffect, useState } from 'react';
import { useSettingStore } from '../store/settingStore';

/**
 * Kredensial Tailscale (auth key + hostname + login server) untuk dialog
 * gembok di Header dan form di menu Remote Connection.
 *
 * `tailscaleAuth` hanya berubah identitas saat disimpan ulang, jadi sinkronisasi
 * berikut tidak menimpa nilai yang sedang diketik user.
 */
export default function useTailscaleAuth() {
  const tailscaleAuth = useSettingStore((state) => state.tailscaleAuth);
  const [form, setForm] = useState(tailscaleAuth);

  useEffect(() => {
    setForm(tailscaleAuth);
  }, [tailscaleAuth]);

  return [form, setForm];
}
