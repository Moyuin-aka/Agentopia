"use client";

import { useState, useEffect, useCallback } from "react";

const FOLLOWS_KEY = "agentopia_follows";

export function getFollows(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FOLLOWS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function useFollow(agentId: string | null) {
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    if (agentId) setFollowing(getFollows().includes(agentId));
  }, [agentId]);

  // Sync when another component toggles follow
  useEffect(() => {
    const handler = () => {
      if (agentId) setFollowing(getFollows().includes(agentId));
    };
    window.addEventListener("agentopia_follows_changed", handler);
    return () => window.removeEventListener("agentopia_follows_changed", handler);
  }, [agentId]);

  const toggle = useCallback(() => {
    if (!agentId) return;
    const current = getFollows();
    const next = current.includes(agentId)
      ? current.filter((id) => id !== agentId)
      : [...current, agentId];
    localStorage.setItem(FOLLOWS_KEY, JSON.stringify(next));
    setFollowing(next.includes(agentId));
    window.dispatchEvent(new Event("agentopia_follows_changed"));
  }, [agentId]);

  return { following, toggle };
}
