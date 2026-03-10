import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { createElement } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  getWorkspace,
  setWorkspace,
  getWorkspaceConfig,
  saveWorkspaceConfig,
  getProfiles,
  saveProfiles as saveProfilesApi,
  setActiveProfile as setActiveProfileApi,
  getActiveProfileId,
  saveDefaultLogo,
} from "@/lib/filesystem";
import { isAndroid } from "@/lib/platform";
import type { WorkspaceConfig, UserProfile } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { PROFILE_COLORS } from "@/types/report";

interface WorkspaceContextType {
  workspacePath: string;
  config: WorkspaceConfig | null;
  loading: boolean;
  profiles: UserProfile[];
  activeProfile: UserProfile | null;
  profileSelected: boolean;
  selectWorkspace: (profileName?: string, avatar?: number) => Promise<boolean>;
  updateConfig: (config: WorkspaceConfig) => Promise<void>;
  setActiveProfile: (profileId: string) => Promise<void>;
  addProfile: (name: string, color: string, avatar?: number) => Promise<UserProfile>;
  updateProfile: (profile: UserProfile) => Promise<void>;
  removeProfile: (profileId: string) => Promise<void>;
  clearProfileSelection: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

function applyAppTheme(theme: string) {
  const el = document.documentElement;
  if (theme === "light") {
    delete el.dataset.theme;
  } else {
    el.dataset.theme = theme || "dracula";
  }
  localStorage.setItem("otoreport-theme", theme || "dracula");
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspacePath, setWorkspacePath] = useState("");
  const [config, setConfig] = useState<WorkspaceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeProfile, setActiveProfileState] = useState<UserProfile | null>(null);
  const [profileSelected, setProfileSelected] = useState(false);

  useEffect(() => {
    loadWorkspace();
  }, []);

  async function loadWorkspace() {
    try {
      const path = await getWorkspace();
      setWorkspacePath(path);

      if (path) {
        const [cfg, profs, activeId] = await Promise.all([
          getWorkspaceConfig(),
          getProfiles(),
          getActiveProfileId(),
        ]);
        setConfig(cfg);
        setProfiles(profs);

        // Auto-seleccionar si solo hay 1 perfil o si hay un perfil activo guardado
        if (profs.length === 1) {
          const prof = profs[0];
          if (activeId !== prof.id) {
            await setActiveProfileApi(prof.id);
          }
          setActiveProfileState(prof);
          setProfileSelected(true);
          applyAppTheme(prof.app_theme);
          // Recargar config con el perfil correcto
          const updatedCfg = await getWorkspaceConfig();
          setConfig(updatedCfg);
        } else if (profs.length === 0) {
          // Sin perfiles — el workspace existe pero no hay perfiles (no debería pasar normalmente)
          setProfileSelected(true);
        } else if (activeId) {
          // Múltiples perfiles: no auto-seleccionar, mostrar selector
          // Pero recordar el perfil activo para referencia
          const active = profs.find((p) => p.id === activeId);
          if (active) {
            setActiveProfileState(active);
          }
          setProfileSelected(false);
        }
      }
    } catch {
      try {
        if (await isAndroid()) {
          const path = await invoke<string>("auto_setup_workspace");
          setWorkspacePath(path);
          const cfg = await getWorkspaceConfig();
          setConfig(cfg);
        }
      } catch {
        // auto-setup failed
      }
    } finally {
      setLoading(false);
    }
  }

  const selectWorkspace = useCallback(async (profileName?: string, avatar?: number) => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      const path = selected as string;
      await setWorkspace(path);
      setWorkspacePath(path);

      // Cargar perfiles existentes del workspace
      const existingProfiles = await getProfiles();

      if (existingProfiles.length === 0 && profileName) {
        // Crear primer perfil con logo por defecto
        const defaultLogoPath = await saveDefaultLogo().catch(() => "");
        const profile: UserProfile = {
          id: uuidv4(),
          name: profileName,
          color: PROFILE_COLORS[0],
          avatar,
          center_name: "",
          center_address: "",
          center_phone: "",
          center_email: "",
          logo_path: defaultLogoPath,
          examiner: profileName,
          equipment: "",
          report_title: "Informe de Otoscopía",
      ear_wash_report_title: "Informe de Lavado de Oído",
          show_header: true,
          show_logo: true,
          show_patient_info: true,
          show_exam_info: true,
          show_diagram: true,
          show_annotations: true,
          show_findings: true,
          show_observations: true,
          show_images: true,
          show_conclusion: true,
          show_footer: true,
          image_size: "medium",
          images_per_row: 3,
          theme_color: "blue",
          app_theme: "dracula",
          id_type: "rut_id_dni",
          section_order: [
            "header", "patient_info", "exam_info", "diagram",
            "findings", "observations", "images", "annotations",
            "conclusion", "footer",
          ],
        };
        await saveProfilesApi([profile]);
        await setActiveProfileApi(profile.id);
        setProfiles([profile]);
        setActiveProfileState(profile);
        setProfileSelected(true);
      } else if (existingProfiles.length > 0) {
        setProfiles(existingProfiles);
        if (existingProfiles.length === 1) {
          await setActiveProfileApi(existingProfiles[0].id);
          setActiveProfileState(existingProfiles[0]);
          setProfileSelected(true);
        }
      }

      const cfg = await getWorkspaceConfig();
      setConfig(cfg);
      return true;
    }
    return false;
  }, []);

  const updateConfig = useCallback(async (newConfig: WorkspaceConfig) => {
    await saveWorkspaceConfig(newConfig);
    setConfig(newConfig);
    // Actualizar el perfil activo en la lista local
    const profs = await getProfiles();
    setProfiles(profs);
    const activeId = await getActiveProfileId();
    const active = profs.find((p) => p.id === activeId);
    if (active) setActiveProfileState(active);
  }, []);

  const setActiveProfile = useCallback(async (profileId: string) => {
    await setActiveProfileApi(profileId);
    const prof = profiles.find((p) => p.id === profileId);
    if (prof) {
      setActiveProfileState(prof);
      applyAppTheme(prof.app_theme);
    }
    setProfileSelected(true);
    const cfg = await getWorkspaceConfig();
    setConfig(cfg);
  }, [profiles]);

  const addProfile = useCallback(async (name: string, color: string, avatar?: number) => {
    const defaultLogoPath = await saveDefaultLogo().catch(() => "");
    const profile: UserProfile = {
      id: uuidv4(),
      name,
      color,
      avatar,
      center_name: "",
      center_address: "",
      center_phone: "",
      center_email: "",
      logo_path: defaultLogoPath,
      examiner: name,
      equipment: "",
      report_title: "Informe de Otoscopía",
      ear_wash_report_title: "Informe de Lavado de Oído",
      show_header: true,
      show_logo: true,
      show_patient_info: true,
      show_exam_info: true,
      show_diagram: true,
      show_annotations: true,
      show_findings: true,
      show_observations: true,
      show_images: true,
      show_conclusion: true,
      show_footer: true,
      image_size: "medium",
      images_per_row: 3,
      theme_color: "blue",
      app_theme: "dracula",
      id_type: "rut_id_dni",
      section_order: [
        "header", "patient_info", "exam_info", "diagram",
        "findings", "observations", "images", "annotations",
        "conclusion", "footer",
      ],
    };
    const updated = [...profiles, profile];
    await saveProfilesApi(updated);
    setProfiles(updated);
    return profile;
  }, [profiles]);

  const updateProfile = useCallback(async (profile: UserProfile) => {
    const updated = profiles.map((p) => (p.id === profile.id ? profile : p));
    await saveProfilesApi(updated);
    setProfiles(updated);
    if (activeProfile?.id === profile.id) {
      setActiveProfileState(profile);
    }
  }, [profiles, activeProfile]);

  const removeProfile = useCallback(async (profileId: string) => {
    const updated = profiles.filter((p) => p.id !== profileId);
    await saveProfilesApi(updated);
    setProfiles(updated);
    if (activeProfile?.id === profileId && updated.length > 0) {
      await setActiveProfileApi(updated[0].id);
      setActiveProfileState(updated[0]);
      const cfg = await getWorkspaceConfig();
      setConfig(cfg);
    }
  }, [profiles, activeProfile]);

  const clearProfileSelection = useCallback(() => {
    setProfileSelected(false);
  }, []);

  return createElement(
    WorkspaceContext.Provider,
    {
      value: {
        workspacePath,
        config,
        loading,
        profiles,
        activeProfile,
        profileSelected,
        selectWorkspace,
        updateConfig,
        setActiveProfile,
        addProfile,
        updateProfile,
        removeProfile,
        clearProfileSelection,
      },
    },
    children
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
