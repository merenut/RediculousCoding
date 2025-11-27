export type Settings = {
  explosions: boolean;
  blips: boolean;
  chars: boolean;
  shake: boolean;
  // UI toggles don't expose amplitude/decay for now; still include for typing
  // and message payload completeness if needed later
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  shakeAmplitude?: number;
  // @ts-ignore
  shakeDecayMs?: number;
  sound: boolean;
  nativeSound: boolean; // Use native OS sound instead of webview (bypasses autoplay policy)
  fireworks: boolean;
  baseXp: number;
  enableStatusBar: boolean;
  reducedEffects: boolean;
};

export type PanelMessageFromExt =
  | { type: "init"; settings: Settings; xp: number; level: number; xpNext: number; xpLevelStart: number; soundUris: { blip: string; boom: string; fireworks: string } }
  | { type: "state"; xp: number; level: number; xpNext: number; xpLevelStart: number }
  | { type: "blip"; pitch: number; enabled: boolean }
  | { type: "boom"; enabled: boolean }
  | { type: "fireworks"; enabled: boolean };

export type PanelMessageToExt =
  | { type: "ready" }
  | { type: "toggle"; key: keyof Settings; value: boolean }
  | { type: "resetXp" }
  | { type: "requestState" };