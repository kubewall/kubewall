import { useSyncExternalStore } from "react";

// A single shared 1s ticker for every TimeCell instance, instead of each one
// running its own setInterval. Reference-counted: the interval only runs
// while at least one component is subscribed.
const listeners = new Set<() => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;
let currentNow = Date.now();

function tick() {
  currentNow = Date.now();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (intervalId === null) {
    currentNow = Date.now();
    intervalId = setInterval(tick, 1000);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getSnapshot() {
  return currentNow;
}

export function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
