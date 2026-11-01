import React, { createContext, useContext } from "react";
import { Html5Audio, Sequence, spring, staticFile, useVideoConfig, type SpringConfig } from "remotion";
import type { Theme } from "../spec/schema";

export type SpecContextValue = { theme: Theme; locale: string };
export const SpecContext = createContext<SpecContextValue | null>(null);

export function useSpec(): SpecContextValue {
  const ctx = useContext(SpecContext);
  if (!ctx) throw new Error("SpecContext missing");
  return ctx;
}

/** Layout unit: 1 = 1px on a 1080px short side, so templates work for 9:16, 16:9 and 1:1. */
export function useLayout() {
  const { width, height } = useVideoConfig();
  return { u: Math.min(width, height) / 1080, vertical: height > width, width, height };
}

const SPRINGS: Record<Theme["motion"], Partial<SpringConfig>> = {
  energetic: { damping: 11, stiffness: 170, mass: 0.6 },
  smooth: { damping: 200, stiffness: 120 },
  minimal: { damping: 200, stiffness: 70 },
};
const STAGGER: Record<Theme["motion"], number> = { energetic: 3, smooth: 4, minimal: 5 };

export function useMotion() {
  const { fps } = useVideoConfig();
  const { theme } = useSpec();
  return {
    stagger: STAGGER[theme.motion] ?? 4,
    /** 0 → 1 spring that starts at `delay` frames. */
    enter: (frame: number, delay = 0, durationInFrames?: number) =>
      spring({ frame: frame - delay, fps, config: SPRINGS[theme.motion], durationInFrames }),
  };
}

export function hexToRgb(hex: string) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return Number.isNaN(n) ? { r: 0, g: 0, b: 0 } : { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export const withAlpha = (hex: string, a: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

export const isLight = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
};

/** Readable text color on top of `bg`. */
export const onColor = (bg: string) => (isLight(bg) ? "#111827" : "#FFFFFF");

export const normWord = (w: string) => w.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

export function formatNumber(value: number, locale: string, decimals = 0) {
  try {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
  } catch {
    return value.toFixed(decimals);
  }
}

export const isVietnamese = (locale: string) => locale.toLowerCase().startsWith("vi");

/** Code-generated sound effect (see src/pipeline/sfx.ts), only when the theme enables sfx. */
export const Sfx: React.FC<{ name: "tick" | "whoosh" | "ding" | "pop"; at: number; volume?: number }> = ({
  name,
  at,
  volume = 0.6,
}) => {
  const { theme } = useSpec();
  const { fps } = useVideoConfig();
  if (!theme.sfx) return null;
  return (
    <Sequence from={Math.max(0, Math.round(at))} durationInFrames={Math.round(fps * 1.5)} layout="none">
      <Html5Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
    </Sequence>
  );
};
