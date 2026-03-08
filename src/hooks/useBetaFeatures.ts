import { useState, useCallback } from "react";

const BETA_KEY = "otoreport-beta-features";

interface BetaFeatures {
  education: boolean;
}

const defaults: BetaFeatures = {
  education: false,
};

function load(): BetaFeatures {
  try {
    const raw = localStorage.getItem(BETA_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...defaults };
}

function save(features: BetaFeatures) {
  localStorage.setItem(BETA_KEY, JSON.stringify(features));
}

export function useBetaFeatures() {
  const [features, setFeatures] = useState<BetaFeatures>(load);

  const toggle = useCallback((key: keyof BetaFeatures) => {
    setFeatures((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      save(next);
      return next;
    });
  }, []);

  return { features, toggle };
}

export function isBetaEnabled(key: keyof BetaFeatures): boolean {
  return load()[key];
}
