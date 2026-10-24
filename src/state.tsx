import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api, type AppSettings, type Profile } from "./api";

export type ToastKind = "ok" | "err" | "info";
interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}

interface Ctx {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  profiles: Profile[];
  setProfiles: (next: Profile[]) => void;
  selected: Profile | null;
  selectProfile: (id: string | null) => void;
  updateSelected: (patch: Partial<Profile>) => void;
  dataDir: string;
  toast: (text: string, kind?: ToastKind) => void;
  toasts: Toast[];
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => useContext(AppCtx)!;

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [profiles, setProfilesState] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dataDir, setDataDir] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    api.getState().then((s) => {
      setSettings(s.settings);
      setProfilesState(s.profiles);
      setDataDir(s.data_dir);
      setSelectedId(localStorage.getItem("selectedProfile") ?? s.profiles[0]?.Id ?? null);
    });
  }, []);

  const toast = useCallback((text: string, kind: ToastKind = "ok") => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "err" ? 7000 : 3500);
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      setSettings((prev) => {
        const next = { ...prev!, ...patch };
        api.saveSettings(next).catch((e) => toast(String(e), "err"));
        return next;
      });
    },
    [toast],
  );

  const setProfiles = useCallback(
    (next: Profile[]) => {
      setProfilesState(next);
      api.saveProfiles(next).catch((e) => toast(String(e), "err"));
    },
    [toast],
  );

  const selectProfile = useCallback((id: string | null) => {
    setSelectedId(id);
    try {
      if (id) localStorage.setItem("selectedProfile", id);
      else localStorage.removeItem("selectedProfile");
    } catch {
      /* egal */
    }
  }, []);

  const updateSelected = useCallback(
    (patch: Partial<Profile>) => {
      setProfilesState((prev) => {
        const next = prev.map((p) => (p.Id === selectedId ? { ...p, ...patch } : p));
        api.saveProfiles(next).catch((e) => toast(String(e), "err"));
        return next;
      });
    },
    [selectedId, toast],
  );

  if (!settings) return <div className="boot">Lädt…</div>;

  const selected = profiles.find((p) => p.Id === selectedId) ?? null;
  return (
    <AppCtx.Provider
      value={{ settings, updateSettings, profiles, setProfiles, selected, selectProfile, updateSelected, dataDir, toast, toasts }}
    >
      {children}
    </AppCtx.Provider>
  );
}

/** Ziel-Auflösung eines Profils (Fallback wie in der alten App) */
export const profileRes = (p: Profile | null) => ({
  x: p?.ResolutionX ?? 1280,
  y: p?.ResolutionY ?? 1024,
  hz: p?.RefreshRate ?? 239.96,
});
