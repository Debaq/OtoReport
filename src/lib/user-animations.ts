import { invoke } from "@tauri-apps/api/core";
import type { AnimationDefinition } from "@/types/animation";
import { serializeAnimation, parseAnimation } from "@/lib/animation/animation-io";

export async function saveUserAnimation(
  filename: string,
  animation: AnimationDefinition,
): Promise<void> {
  const data = serializeAnimation(animation);
  await invoke("save_user_animation", { filename, data });
}

export async function loadUserAnimation(
  filename: string,
): Promise<AnimationDefinition | null> {
  try {
    const data = await invoke<string>("load_user_animation", { filename });
    const result = parseAnimation(data);
    return result.ok ? result.animation : null;
  } catch {
    return null;
  }
}

export async function listUserAnimations(): Promise<string[]> {
  return invoke<string[]>("list_user_animations");
}

export async function deleteUserAnimation(filename: string): Promise<void> {
  await invoke("delete_user_animation", { filename });
}

/** Genera un nombre de archivo que no colisione con los existentes */
export async function nextAnimationFilename(): Promise<string> {
  const existing = await listUserAnimations();
  let n = 1;
  while (existing.includes(`animacion-${n}.json`)) {
    n++;
  }
  return `animacion-${n}.json`;
}
