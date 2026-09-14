// The Corona dashboard design is a permanent dark theme. Force `.dark` before
// first paint so no white flash (FOUC) ever appears. Mirrors ThemeContext.tsx.
(function () {
  try {
    document.documentElement.classList.add('dark');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#0f1116');
  } catch (e) {
    /* ignore */
  }
})();