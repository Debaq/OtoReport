import { invoke } from "@tauri-apps/api/core";
import type { WorkspaceConfig, UserProfile } from "@/types";

export async function getWorkspace(): Promise<string> {
  return invoke<string>("get_workspace");
}

export async function setWorkspace(path: string): Promise<void> {
  return invoke("set_workspace", { path });
}

export async function getWorkspaceConfig(): Promise<WorkspaceConfig> {
  return invoke<WorkspaceConfig>("get_workspace_config");
}

export async function saveWorkspaceConfig(
  config: WorkspaceConfig
): Promise<void> {
  return invoke("save_workspace_config", { config });
}

export async function getProfiles(): Promise<UserProfile[]> {
  return invoke<UserProfile[]>("get_profiles");
}

export async function saveProfiles(profiles: UserProfile[]): Promise<void> {
  return invoke("save_profiles", { profiles });
}

export async function setActiveProfile(profileId: string): Promise<void> {
  return invoke("set_active_profile", { profileId });
}

export async function getActiveProfileId(): Promise<string> {
  return invoke<string>("get_active_profile_id");
}

export async function saveDefaultLogo(): Promise<string> {
  const res = await fetch("/tecmedhub.jpeg");
  const buffer = await res.arrayBuffer();
  const bytes = Array.from(new Uint8Array(buffer));
  return invoke<string>("save_logo", { data: bytes, extension: "jpeg" });
}
