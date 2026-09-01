import { type CueName, type UISFXPlayer, bindUISFX } from 'uisfx';

// Interaction sounds, from the uisfx "zen" pack. Despite shipping a `sounds/`
// folder of mp3/ogg files, the runtime never fetches them: every cue is
// rendered live into an AudioBuffer from a synthesis recipe and cached, so
// nothing is downloaded and nothing lands in the bundle but the code.
//
// `bindUISFX` installs delegated listeners on `document`, so an element carrying
// `data-uisfx-hover` sounds without a handler of its own — and rows that mount
// later (a config finishing load, a search re-filtering the table) are covered
// without rebinding.

const PACK = 'zen';

// Ambient cues under someone scanning a table, not alerts.
const VOLUME = 0.5;

// uisfx's own per-cue default for `hover` is 60ms, which machine-guns when the
// pointer sweeps down a column of rows. This is the global floor between two
// plays of the *same* cue; distinct cues are unaffected, so `select` and
// `level-up` still fire the moment they're asked to.
const COOLDOWN_MS = 150;

// The player persists `{ pack, volume, enabled }` here itself. `pack` and
// `volume` are passed explicitly on every boot and so always win over what's
// stored; `enabled` is deliberately NOT passed, which is what lets the stored
// value survive a reload. It defaults to true on a first visit.
const PREFERENCES_KEY = 'kw-sound';

// Rendering a recipe is synchronous, so the very first play of a cue would
// otherwise do that work inside the pointer event. Only the cues this app
// actually uses — no point rendering all 78.
const USED_CUES: CueName[] = ['hover', 'select', 'level-up', 'toggle-on'];

let player: UISFXPlayer | null = null;
const listeners = new Set<() => void>();

/**
 * Creates the player, wires the declarative `data-uisfx-*` cues, and warms the
 * cues we use. Called once from main.tsx.
 */
export function initSound(): void {
  if (player) return;

  player = bindUISFX(document, {
    pack: PACK,
    volume: VOLUME,
    cooldownMs: COOLDOWN_MS,
    preferences: { key: PREFERENCES_KEY },
  }).player;

  // Fire-and-forget: a cue that isn't warm yet still plays, just a beat later.
  void player.preload(USED_CUES).catch(() => {});
}

export function play(cue: CueName): void {
  player?.play(cue);
}

export function isSoundEnabled(): boolean {
  // Before initSound() runs there's nothing to be muted yet; `true` matches the
  // player's own default so the toggle doesn't flip on the first paint.
  return player?.isEnabled() ?? true;
}

export function setSoundEnabled(value: boolean): void {
  if (!player || value === player.isEnabled()) return;
  player.setEnabled(value);
  listeners.forEach((listener) => listener());
}

/** Subscribe form expected by `useSyncExternalStore`. */
export function subscribeToSoundEnabled(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ─── Arrival cue ─────────────────────────────────────────────────────────────
// "Level-up" belongs to the act of picking a cluster and getting in, not to the
// list page as such — the same page reached by switching resource kind in the
// sidebar, or by a reload, or by a pasted URL, must stay silent.
//
// So the cue is armed at the click and consumed by the first list load that
// finishes afterwards. A module-level flag (not localStorage) is exactly the
// right lifetime: it survives the client-side route change, and a full reload
// wipes it, which is precisely the case that must not sound.

let arrivalArmed = false;

/** Called when the user picks a cluster, arming the next list load's cue. */
export function armArrivalCue(): void {
  arrivalArmed = true;
}

/** Reads and clears the flag — true at most once per cluster selection. */
export function consumeArrivalCue(): boolean {
  const armed = arrivalArmed;
  arrivalArmed = false;
  return armed;
}

