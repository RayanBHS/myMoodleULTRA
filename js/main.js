// myMoodle ULTRA - Initialization and DOM Monitoring
const init = () => {
  fetchMoodleCourses(); // warm-up API cache early
  injectDashboardLanding();
  cleanNavbarLinks();
  injectCustomProfilePill();
  if (isDashboard()) {
    ensureCardLayoutSelected();
    injectCoursesHeader();
    customizeMoodleCards();
    customizeRecentCourses();
    customizeTimeline();
  }
};

// Global click handler to close active filter popups when clicking outside
document.addEventListener('click', (e) => {
  const header = document.getElementById('ultramoodle-courses-header');
  if (!header) return;
  
  const toggleBtn = document.getElementById('ultramoodle-filter-toggle-btn');
  const filterBar = header.associatedFilterBar;
  
  if (filterBar && filterBar.classList.contains('ultramoodle-filter-bar-visible')) {
    if (!header.contains(e.target) && !filterBar.contains(e.target)) {
      filterBar.classList.remove('ultramoodle-filter-bar-visible');
      if (toggleBtn) {
        toggleBtn.classList.remove('active');
      }
    }
  }
});

// Try injecting immediately on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Observe mutations to ensure elements stay injected and handle dynamic updates (e.g. Moodle Ajax tabs)
const observer = new MutationObserver((mutations) => {
  if (window._ultramoodleFiltering) return;

  // Ignore mutations caused by our own components or class changes (e.g. search updates, hiding/showing cards)
  const isOwnMutation = mutations.every(m => {
    if (m.target.closest && m.target.closest('#ultramoodle-hero-wrapper, #ultramoodle-courses-header')) {
      return true;
    }
    if (m.type === 'attributes' && m.attributeName === 'class') {
      const el = m.target;
      const oldVal = m.oldValue || '';
      const newVal = el.className || '';
      // If only ultramoodle-specific classes changed, skip
      const changed = newVal.split(' ').filter(c => !oldVal.split(' ').includes(c))
        .concat(oldVal.split(' ').filter(c => !newVal.split(' ').includes(c)));
      return changed.every(c => c.startsWith('ultramoodle-'));
    }
    return false;
  });
  if (isOwnMutation) return;

  if (isDashboard()) {
    injectDashboardLanding();
    ensureCardLayoutSelected();
    injectCoursesHeader();
    customizeMoodleCards();
    customizeRecentCourses();
    customizeTimeline();
  }
  cleanNavbarLinks();
  injectCustomProfilePill();
});

observer.observe(document.body || document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['class'],
  attributeOldValue: true
});
