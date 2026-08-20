"use client";

import { useState } from "react";
import Image from "next/image";
import {
  agentAvatarUrl,
  DEFAULT_AVATAR_PROMPT,
} from "@/lib/avatar";

interface AgentAvatarProps {
  name: string;
  seed: string;
  prompt?: string | null;
  size?: number;
  className?: string;
}

const PALETTES = [
  { background: "#d9583b", shadow: "#6f1f2c", ink: "#481817", accent: "#ffc95c" },
  { background: "#167d78", shadow: "#123c4a", ink: "#12383a", accent: "#f4b860" },
  { background: "#315b9b", shadow: "#172d52", ink: "#192e52", accent: "#f0d27a" },
  { background: "#69804b", shadow: "#293e32", ink: "#283c30", accent: "#ef8354" },
] as const;

function seedHash(seed: string) {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function DefaultAgentAvatar({ name, seed }: Pick<AgentAvatarProps, "name" | "seed">) {
  const hash = seedHash(seed || name);
  const palette = PALETTES[hash % PALETTES.length];
  const roundEyes = hash % 3 !== 0;
  const smiling = hash % 2 === 0;

  return (
    <div
      role="img"
      aria-label={`${name} 的默认头像`}
      className="absolute inset-0"
      style={{
        background: `radial-gradient(circle at 72% 22%, ${palette.accent} 0 8%, transparent 8.5%), linear-gradient(145deg, ${palette.background}, ${palette.shadow})`,
      }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        className="h-full w-full"
        fill="none"
      >
        <circle cx="50" cy="50" r="37" stroke="rgba(255,255,255,.18)" strokeWidth="1.5" />
        <path d="M50 22v9" stroke="rgba(255,250,238,.92)" strokeWidth="4" strokeLinecap="round" />
        <circle cx="50" cy="19" r="4" fill={palette.accent} stroke="rgba(255,250,238,.92)" strokeWidth="2" />
        <rect x="24" y="31" width="52" height="43" rx="15" fill="rgba(255,250,238,.94)" />
        <path d="M24 47h-6v13h6M76 47h6v13h-6" stroke="rgba(255,250,238,.82)" strokeWidth="5" strokeLinecap="round" />
        {roundEyes ? (
          <>
            <circle cx="40" cy="51" r="4.5" fill={palette.ink} />
            <circle cx="60" cy="51" r="4.5" fill={palette.ink} />
          </>
        ) : (
          <>
            <path d="M35 51h9" stroke={palette.ink} strokeWidth="5" strokeLinecap="round" />
            <path d="M56 51h9" stroke={palette.ink} strokeWidth="5" strokeLinecap="round" />
          </>
        )}
        <path
          d={smiling ? "M41 63c5 5 13 5 18 0" : "M42 63h16"}
          stroke={palette.ink}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path d="M34 80c9-5 23-5 32 0" stroke="rgba(255,255,255,.32)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export default function AgentAvatar({
  name,
  seed,
  prompt,
  size = 80,
  className = "",
}: AgentAvatarProps) {
  const normalizedPrompt = prompt?.trim();
  const usesDefaultAvatar = !normalizedPrompt || normalizedPrompt === DEFAULT_AVATAR_PROMPT;
  const remoteSrc = usesDefaultAvatar
    ? null
    : agentAvatarUrl(normalizedPrompt, seed, size);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const remoteLoaded = remoteSrc !== null && loadedSrc === remoteSrc;
  const remoteFailed = remoteSrc === null || failedSrc === remoteSrc;

  return (
    <div className={`relative overflow-hidden bg-neutral-800 ${className}`}>
      <DefaultAgentAvatar name={name} seed={seed} />
      {!remoteFailed && (
        <Image
          src={remoteSrc}
          alt={name}
          fill
          sizes={`${size}px`}
          onLoad={() => setLoadedSrc(remoteSrc)}
          onError={() => setFailedSrc(remoteSrc)}
          className={`object-cover transition-opacity duration-300 ${
            remoteLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}
