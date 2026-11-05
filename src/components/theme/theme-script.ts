import { DEFAULT_THEME, THEME_STORAGE_KEY } from "./types";

/**
 * Inline script applied before first paint.
 *
 * React cannot do this: the provider mounts after the browser has already
 * painted, so a stored light preference would flash dark first. This runs
 * synchronously in <head> and sets the class up front.
 *
 * Every access is guarded — localStorage throws in private mode and with
 * site data blocked, and a theme toggle must never break the page.
 */
export const themeInitScript = `
(function () {
  try {
    var stored = null;
    try { stored = localStorage.getItem('${THEME_STORAGE_KEY}'); } catch (e) {}
    var pref = stored === 'light' || stored === 'dark' || stored === 'system'
      ? stored
      : '${DEFAULT_THEME}';
    var resolved = pref === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : pref;
    var root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.style.colorScheme = resolved;
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
`.trim();
