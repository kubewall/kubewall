// scrollbar-handler.js
const SCROLLBAR_ACTIVE_CLASS = 'scrollbar-active';
const HIDE_DELAY_MS = 2000;

const hideTimers = new WeakMap();

function handleScroll(event) {
  const element = event.target;
  if (!(element instanceof Element)) return;

  element.classList.add(SCROLLBAR_ACTIVE_CLASS);

  clearTimeout(hideTimers.get(element));
  hideTimers.set(
    element,
    setTimeout(() => element.classList.remove(SCROLLBAR_ACTIVE_CLASS), HIDE_DELAY_MS)
  );
}

// `scroll` events don't bubble, but they do propagate through the capture
// phase, so one listener on `document` catches scrolling on every element -
// current or added later - with no MutationObserver and no per-element
// listener registration.
if (typeof window !== 'undefined') {
  document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
}
