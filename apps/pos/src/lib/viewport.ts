/** One viewport owner: Android adjustResize / browser resizes-content.
 * visualViewport only clamps overlays; never resize the layout again or scroll the window.
 */
export function installViewportGuards() {
  const root = document.documentElement;
  let frame = 0;
  const update = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const viewport = window.visualViewport;
      if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;
      root.style.setProperty('--visible-height', `${Math.round(viewport?.height ?? window.innerHeight)}px`);
      const inputFocused = document.activeElement?.matches('input,textarea,[contenteditable="true"]');
      root.classList.toggle('input-focused', Boolean(inputFocused));
    });
  };
  window.addEventListener('resize', update);
  window.visualViewport?.addEventListener('resize', update);
  document.addEventListener('focusin', update);
  document.addEventListener('focusout', update);
  update();
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', update);
    window.visualViewport?.removeEventListener('resize', update);
    document.removeEventListener('focusin', update);
    document.removeEventListener('focusout', update);
  };
}
