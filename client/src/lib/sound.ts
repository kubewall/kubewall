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
// "Level-up" marks getting into a cluster for the first time — the moment a
// connection is established, not arriving at a list page. So:
//
//   * picking a cluster that isn't connected yet  -> cue, once its list loads
//   * picking one that's already connected        -> silent, it's plain navigation
//   * the same list reached by switching resource kind, by a reload, or from a
//     pasted URL                                  -> silent
//
// The cue is armed at the click and consumed by the first list load that
// finishes afterwards. Module-level state (not localStorage) is the right
// lifetime: it survives the client-side route change, and a full reload wipes
// it, which is precisely the case that must not sound.

/** `config/cluster` of the selection waiting for its list to finish loading. */
let pendingCluster: string | null = null;

// Clusters already cued in this session. `connected` alone isn't enough to
// stand on: the clusters slice opts out of resetAllStates and KubeWall only
// refetches it when kubeConfigs is missing, so the rail can hold a `connected`
// that predates a connection we made ourselves — and a stale `false` would
// replay the cue on every revisit. This is the record of what actually sounded.
const cuedClusters = new Set<string>();

/** Key used for both of the above. Matches the addons' `config/cluster` form. */
export function clusterCueKey(config: string, cluster: string): string {
  return `${config}/${cluster}`;
}

/**
 * Arms the level-up cue for the cluster just selected, if this is the first
 * time we're connecting to it. `alreadyConnected` comes from the clusters list.
 *
 * Every selection replaces what was pending, including with nothing: a cluster
 * that never finished connecting leaves its arm behind, and the next selection
 * is by definition a different cluster whose list must not inherit it.
 */
export function armArrivalCue(config: string, cluster: string, alreadyConnected: boolean): void {
  const key = clusterCueKey(config, cluster);
  const eligible = !alreadyConnected && !cuedClusters.has(key);
  pendingCluster = eligible ? key : null;
}

/**
 * Fires at most once per cluster, and only for the cluster that was actually
 * armed — a list load belonging to any other cluster leaves the arm untouched
 * rather than consuming it. Without that check, selecting a cluster that fails
 * to connect and then returning to a working one would sound the cue for the
 * working cluster, which was already connected.
 *
 * The cluster is recorded as cued only at the point it sounds, so a selection
 * whose list never loads stays eligible the next time it's picked.
 */
export function consumeArrivalCue(config: string, cluster: string): boolean {
  if (!pendingCluster || pendingCluster !== clusterCueKey(config, cluster)) return false;
  cuedClusters.add(pendingCluster);
  pendingCluster = null;
  return true;
}

