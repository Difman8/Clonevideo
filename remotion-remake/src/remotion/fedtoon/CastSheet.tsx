// "FedtoonCast": every character and action side by side, and "FedtoonMascot":
// Fed in every action, for Remotion Studio and visual checks (npm run studio).
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { PALETTE } from "../../fedtoon/brand";
import { RECURRING_CAST } from "../../fedtoon/cast";
import { ACTIONS, CastMemberSchema, EXPRESSIONS, type CastMember } from "../../spec/storyboard";
import { mouthAt, Puppet } from "./Puppet";

/** Fed and the recurring side characters (src/fedtoon/cast.ts). */
export const SAMPLE_CAST: CastMember[] = [CastMemberSchema.parse({ id: "fed", name: "Fed", kind: "mascot", outfit: "teal" }), ...RECURRING_CAST];

/** `offset` shifts the action/expression each character shows (to check them all). */
export const CastSheet: React.FC<{ offset?: number }> = ({ offset = 0 }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = frame / fps;
  const cols = 3;
  const cell = width / cols;
  return (
    <AbsoluteFill style={{ background: PALETTE.violet }}>
      {SAMPLE_CAST.map((m, i) => {
        const action = ACTIONS[(i + offset) % ACTIONS.length];
        const expression = EXPRESSIONS[(i + offset) % EXPRESSIONS.length];
        return (
          <div key={m.id} style={{ position: "absolute", left: (i % cols) * cell, top: 80 + Math.floor(i / cols) * 600, width: cell, height: 560, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
            <Puppet member={m} action={action} expression={expression} facing={i % 2 ? "left" : "right"} t={t} mouth={action === "talk" ? mouthAt(t, [], 99) : 0} height={420} seed={i} />
            <div style={{ color: "white", fontFamily: "sans-serif", fontSize: 30, marginTop: 14, opacity: 0.85 }}>
              {m.name} · {action} · {expression}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** One character (Fed by default, or `id` from the cast) in every action (expressions cycle). */
export const MascotSheet: React.FC<{ id?: string }> = ({ id = "fed" }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = frame / fps;
  const cols = 3;
  const cell = width / cols;
  const fed = SAMPLE_CAST.find((m) => m.id === id) ?? SAMPLE_CAST[0];
  return (
    <AbsoluteFill style={{ background: PALETTE.magenta }}>
      {ACTIONS.map((action, i) => {
        const expression = EXPRESSIONS[i % EXPRESSIONS.length];
        return (
          <div key={action} style={{ position: "absolute", left: (i % cols) * cell, top: 60 + Math.floor(i / cols) * 620, width: cell, height: 580, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
            <Puppet member={fed} action={action} expression={expression} facing={i === 4 ? "left" : "right"} t={t} mouth={action === "talk" ? mouthAt(t, [], 99) : 0} height={480} seed={i} />
            <div style={{ color: "white", fontFamily: "sans-serif", fontSize: 30, marginTop: 10, opacity: 0.9 }}>
              {action} · {expression}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
