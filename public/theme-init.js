// Apply the saved (or OS-preferred) color scheme BEFORE first paint so a
// dark-mode user never sees a white flash (FOUC). Mirrors getInitialTheme
// in src/context/ThemeContext.tsx — keep the two in sync.
(function () {
  try {
    var stored = localStorage.getItem('edupal-theme');
    var dark =
      stored === 'dark' ||
      (stored !== 'light' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) {
      document.documentElement.classList.add('dark');
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', '#0f172a');
    }
  } catch (e) {
    /* ignore */
  }
})();