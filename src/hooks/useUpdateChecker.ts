import { useState, useEffect, useCallback } from "react";

declare const __APP_VERSION__: string;
export const APP_VERSION = __APP_VERSION__;

const GITHUB_API_URL =
  "https://api.github.com/repos/Debaq/OtoReport/releases/latest";
const SESSION_KEY = "otoreport_update_checked";

interface GitHubRelease {
  tag_name: string;
  body: string;
  html_url: string;
}

interface UpdateState {
  updateAvailable: boolean;
  latestVersion: string | null;
  releaseNotes: string | null;
  releaseUrl: string | null;
  checking: boolean;
  error: string | null;
}

function compareVersions(current: string, latest: string): boolean {
  const c = current.split(".").map(Number);
  const l = latest.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((l[i] ?? 0) > (c[i] ?? 0)) return true;
    if ((l[i] ?? 0) < (c[i] ?? 0)) return false;
  }
  return false;
}

export function useUpdateChecker(autoCheck = true) {
  const [state, setState] = useState<UpdateState>({
    updateAvailable: false,
    latestVersion: null,
    releaseNotes: null,
    releaseUrl: null,
    checking: false,
    error: null,
  });
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(async () => {
    setState((s) => ({ ...s, checking: true, error: null }));
    try {
      const res = await fetch(GITHUB_API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: GitHubRelease = await res.json();
      const version = data.tag_name.replace(/^v/, "");
      const isNewer = compareVersions(APP_VERSION, version);
      setState({
        updateAvailable: isNewer,
        latestVersion: version,
        releaseNotes: data.body,
        releaseUrl: data.html_url,
        checking: false,
        error: null,
      });
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      setState((s) => ({
        ...s,
        checking: false,
        error: "network",
      }));
    }
  }, []);

  const dismiss = useCallback(() => setDismissed(true), []);

  useEffect(() => {
    if (autoCheck && !sessionStorage.getItem(SESSION_KEY)) {
      check();
    }
  }, [autoCheck, check]);

  return { ...state, dismissed, check, dismiss };
}
