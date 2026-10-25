import { invoke } from "@tauri-apps/api/core";

export interface AppSettings {
  SourceConfigPath: string;
  ValorantConfigBase: string;
  RiotClientPath: string;
  HenrikApiKey: string;
  HenrikName: string;
  HenrikTag: string;
  NativeX: number;
  NativeY: number;
}

export interface Profile {
  Id: string;
  Name: string;
  FolderId: string | null;
  Username: string | null;
  Password: string | null;
  ResolutionX: number | null;
  ResolutionY: number | null;
  RefreshRate: number;
}

export interface ConfigFolder {
  id: string;
  modified: number;
}

export interface DisplayMode {
  width: number;
  height: number;
  hz: number;
}

export interface Monitor {
  FriendlyName: string | null;
  InstanceId: string;
  Status: string | null;
}

export interface StretchStatus {
  monitors: Monitor[];
  monitors_disabled: boolean;
  resolution_available: boolean;
  current: DisplayMode | null;
  valorant_running: boolean;
}

export interface CustomResolution {
  width: number;
  height: number;
  hz: number;
}

export interface PathStatus {
  source: boolean;
  base: boolean;
  riot: boolean;
}

// Valorant-Crosshair-Profil, wie es in SavedCrosshairProfileData steht
export interface CrosshairLines {
  lineThickness?: number;
  lineLength?: number;
  lineOffset?: number;
  opacity?: number;
  bShowLines?: boolean;
}
export interface CrosshairPrimary {
  color?: { r: number; g: number; b: number };
  bHasOutline?: boolean;
  bDisplayCenterDot?: boolean;
  centerDotSize?: number;
  innerLines?: CrosshairLines;
  outerLines?: CrosshairLines;
}
export interface CrosshairProfile {
  profileName?: string;
  primary?: CrosshairPrimary;
}
export interface CrosshairState {
  current: number;
  profiles: CrosshairProfile[];
  paths: string[];
}

export interface ProCrosshair {
  player: string;
  team: string;
  color: [number, number, number];
  outline?: boolean;
  outlineOpacity?: number;
  dot?: boolean;
  dotSize?: number;
  dotOpacity?: number;
  innerShow?: boolean;
  innerThickness?: number;
  innerLength?: number;
  innerOffset?: number;
  innerOpacity?: number;
  outerShow?: boolean;
  outerThickness?: number;
  outerLength?: number;
  outerOffset?: number;
  outerOpacity?: number;
  fadeOnFire?: boolean;
}

export const api = {
  getState: () => invoke<{ settings: AppSettings; profiles: Profile[]; data_dir: string }>("get_state"),
  saveSettings: (settings: AppSettings) => invoke<void>("save_settings", { settings }),
  saveProfiles: (profiles: Profile[]) => invoke<void>("save_profiles", { profiles }),
  newId: () => invoke<string>("new_id"),
  checkPaths: (settings: AppSettings) => invoke<PathStatus>("check_paths", { settings }),

  listConfigFolders: (base: string) => invoke<ConfigFolder[]>("list_config_folders", { base }),
  applyConfig: (source: string, base: string, folderId: string, resX: number, resY: number) =>
    invoke<number>("apply_config", { source, base, folderId, resX, resY }),
  changeResolution: (width: number, height: number, hz: number, stretch: boolean) =>
    invoke<void>("change_resolution", { width, height, hz, stretch }),
  listDisplayModes: () => invoke<DisplayMode[]>("list_display_modes"),
  launchValorant: (riotPath: string, width: number, height: number, hz: number) =>
    invoke<string | null>("launch_valorant", { riotPath, width, height, hz }),

  stretchStatus: (width: number, height: number) => invoke<StretchStatus>("stretch_status", { width, height }),
  setMonitorsEnabled: (enabled: boolean) => invoke<Monitor[]>("set_monitors_enabled", { enabled }),
  nvidiaListCustom: () => invoke<CustomResolution[]>("nvidia_list_custom"),
  nvidiaCreateCustom: (width: number, height: number) => invoke<void>("nvidia_create_custom", { width, height }),
  nvidiaDeleteCustom: (width: number, height: number) => invoke<void>("nvidia_delete_custom", { width, height }),
  openNvidiaPanel: () => invoke<void>("open_nvidia_panel"),
  openDeviceManager: () => invoke<void>("open_device_manager"),
  resetValorantConfig: (base: string) => invoke<string>("reset_valorant_config", { base }),

  crosshairPaths: (base: string, folderId: string | null) => invoke<string[]>("crosshair_paths", { base, folderId }),
  crosshairLoad: (paths: string[]) => invoke<CrosshairState>("crosshair_load", { paths }),
  crosshairSetActive: (paths: string[], index: number) => invoke<CrosshairState>("crosshair_set_active", { paths, index }),
  crosshairApplyPro: (paths: string[], pro: ProCrosshair) => invoke<CrosshairState>("crosshair_apply_pro", { paths, pro }),
  crosshairLoadDefault: (paths: string[]) => invoke<CrosshairState>("crosshair_load_default", { paths }),

  henrikGet: (path: string, ttl: number, apiKey: string) => invoke<string>("henrik_get", { path, ttl, apiKey }),
  henrikInvalidate: (fragment: string) => invoke<void>("henrik_invalidate", { fragment }),
  competitiveTiers: () => invoke<string>("competitive_tiers"),
};

export const errText = (e: unknown) => (typeof e === "string" ? e : e instanceof Error ? e.message : String(e));
