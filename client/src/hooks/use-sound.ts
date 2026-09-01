import { consumeArrivalCue, isSoundEnabled, play, setSoundEnabled, subscribeToSoundEnabled } from '@/lib/sound';
import { useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * Reads and writes the app-wide interaction-sound preference.
 *
 * The preference lives in lib/sound.ts rather than in component state because
 * the uisfx player is a module-level singleton that owns its own persistence -
 * the value has to be the one the player was handed, and any number of
 * components may want to reflect it. `useSyncExternalStore` keeps every reader
 * in step with that single source.
 */
export function useSoundEnabled(): [boolean, (value: boolean) => void] {
  const enabled = useSyncExternalStore(subscribeToSoundEnabled, isSoundEnabled);
  return [enabled, setSoundEnabled];
}

/**
 * Plays the "level-up" cue once, when a list first finishes loading after the
 * user connected to a cluster for the first time. Whether a selection qualifies
 * is armArrivalCue's decision, not this hook's — an already-connected cluster
 * arms nothing and so consumes nothing here.
 *
 * It insists on a real `true -> false` transition rather than just observing
 * `loading === false`. KwList dispatches resetListSlices from an effect on
 * mount, so on the first render `loading` can still be the stale `false` left
 * by a previous visit - firing on that would sound the cue before any data had
 * arrived. Waiting for the edge means the cue lands when the list is actually
 * populated.
 */
export function useArrivalCue(loading: boolean, config: string, cluster: string): void {
  const wasLoading = useRef(false);

  useEffect(() => {
    if (loading) {
      wasLoading.current = true;
      return;
    }
    if (!wasLoading.current) return;
    wasLoading.current = false;
    // Passing the cluster matters: this fires on every list that finishes
    // loading, and only the one that was armed should sound.
    if (consumeArrivalCue(config, cluster)) play('level-up');
  }, [loading, config, cluster]);
}
