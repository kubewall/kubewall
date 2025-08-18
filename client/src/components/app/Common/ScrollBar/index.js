// scrollbar-handler.js
function initializeScrollbars() {
  let scrollTimeout;
  const debounceTime = 2000;

  function handleScroll(event) {
    const element = event.target;
    element.classList.add('scrollbar-active');
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      element.classList.remove('scrollbar-active');
    }, debounceTime);
  }

  // Check if element is scrollable
  function isScrollable(element) {
    const isRadixScroll = element.closest('[data-radix-scroll-area-viewport]');
    return isRadixScroll || (
      element.scrollHeight > element.clientHeight ||
      element.scrollWidth > element.clientWidth
    );
  }

  // Add listeners to existing elements
  document.querySelectorAll('*').forEach(element => {
    if (isScrollable(element)) {
      element.addEventListener('scroll', handleScroll, { passive: true });
    }
  });

  // Watch for new elements
  const observer = new MutationObserver(mutations => {
    mutations.forEach(({ addedNodes }) => {
      addedNodes.forEach(node => {
        if (node.nodeType === 1) {
          if (isScrollable(node)) {
            node.addEventListener('scroll', handleScroll, { passive: true });
          }
          node.querySelectorAll('*').forEach(child => {
            if (isScrollable(child)) {
              child.addEventListener('scroll', handleScroll, { passive: true });
            }
          });
        }
      });
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

// Initialize
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', initializeScrollbars);
  // Remove the problematic unload listener since handleScroll is scoped inside initializeScrollbars
  // and we don't need to remove it from window as it's not added to window
}
