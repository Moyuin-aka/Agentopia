"use client";

import { useCallback, useSyncExternalStore } from "react";

const FOLLOWS_KEY = "agentopia_follows";

export function getFollows(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FOLLOWS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function useFollow(agentId: string | null) {
  const subscribe = useCallback((onStoreChange: () => void) => {
    window.addEventListener("agentopia_follows_changed", onStoreChange);
    return () => window.removeEventListener("agentopia_follows_changed", onStoreChange);
  }, []);
  const getSnapshot = useCallback(
    () => Boolean(agentId && getFollows().includes(agentId)),
    [agentId]
  );
  const following = useSyncExternalStore(subscribe, getSnapshot, () => false);

  const toggle = useCallback(() => {
    if (!agentId) return;
    const current = getFollows();
    const next = current.includes(agentId)
      ? current.filter((id) => id !== agentId)
      : [...current, agentId];
    localStorage.setItem(FOLLOWS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("agentopia_follows_changed"));
  }, [agentId]);

  return { following, toggle };
}
