// myMoodle ULTRA - Initialization and DOM Monitoring
(function() {
  'use strict';

  const injectCSSVariables = () => {
    const root = document.documentElement;
    if (root) {
      root.style.setProperty('--ultra-pdf-icon', `url("${chrome.runtime.getURL('img/pdfIcone.png')}")`);
      root.style.setProperty('--ultra-word-icon', `url("${chrome.runtime.getURL('img/wordIcone.png')}")`);
      root.style.setProperty('--ultra-powerpoint-icon', `url("${chrome.runtime.getURL('img/powerpointIcone.png')}")`);
      root.style.setProperty('--ultra-excel-icon', `url("${chrome.runtime.getURL('img/excelIcone.png')}")`);
      root.style.setProperty('--ultra-text-icon', `url("${chrome.runtime.getURL('img/blocnoteIcone.png')}")`);
    }
  };

const replaceFavicon = () => {
  try {
    const logoUrl = chrome.runtime.getURL('img/logoMyMoodleUltra.png');
    const links = document.querySelectorAll("link[rel*='icon']");
    
    if (links.length > 0) {
      links.forEach(link => {
        if (link.getAttribute('href') !== logoUrl) {
          link.href = logoUrl;
        }
      });
    } else {
      const head = document.head || document.getElementsByTagName('head')[0];
      if (head) {
        const link = document.createElement('link');
        link.type = 'image/png';
        link.rel = 'shortcut icon';
        link.href = logoUrl;
        head.appendChild(link);
      }
    }
  } catch (e) {
    console.error('[myMoodle ULTRA] Error replacing favicon:', e);
  }
};

const isProfilePage = () => {
  return window.location.pathname.includes('/user/profile.php') || (document.body && document.body.classList.contains('path-user-profile')) || document.getElementById('page-user-profile') !== null;
};

const isMessageActive = () => {
  return window.location.pathname.includes('/message/index.php') || (document.body && document.body.classList.contains('path-message')) || document.querySelector('[data-region="message-drawer"], .message-app') !== null;
};

  const cleanupDOM = () => {
    try {
      const elementsToRemove = [
        '#ultramoodle-hero-wrapper',
        '#ultramoodle-courses-header',
        '#ultramoodle-course-page-header',
        '#mye-calendars-container',
        '.ultramoodle-block-header',
        '.ultramoodle-profile-pill',
        '#ultramoodle-doc-viewer'
      ];
      elementsToRemove.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => el.remove());
      });

      document.querySelectorAll('.ultramoodle-card-customized').forEach(card => {
        card.classList.remove('ultramoodle-card-customized');
        card.style.display = '';
      });

      document.querySelectorAll('.block .header').forEach(header => {
        header.style.display = '';
      });
    } catch (e) {
      console.error('[myMoodle ULTRA] Error cleaning up DOM:', e);
    }
  };

  const init = () => {
    const isEnabled = localStorage.getItem('mymoodle_user_enabled') !== 'false';
    if (!isEnabled) {
      console.log('[myMoodle ULTRA] Extension is disabled via settings.');
      document.documentElement.setAttribute('data-mymoodle-disabled', 'true');
      cleanupDOM();
      return;
    }
    document.documentElement.removeAttribute('data-mymoodle-disabled');
    runInit();
  };

const runInit = () => {
  injectCSSVariables();
  fetchMoodleCourses(); // warm-up API cache early
  replaceFavicon();
  injectDashboardLanding();
  cleanNavbarLinks();
  injectCustomProfilePill();
  if (isDashboard()) {
    ensureCardLayoutSelected();
    injectBlockHeaders();
    customizeMoodleCards();
    customizeRecentCourses();
    customizeStarredCourses();
    customizeRecentItems();
    cleanDropdownCheckmarks();
    customizeTimeline();
  } else if (window.isCoursePage && window.isCoursePage()) {
    window.customizeCoursePageHeader();
    if (window.customizeResourceIcons) {
      window.customizeResourceIcons();
    }
  } else if (window.isCalendarPage && window.isCalendarPage()) {
    window.initMoodleCalendar();
  } else if (isProfilePage()) {
    if (window.customizeUserProfilePage) {
      window.customizeUserProfilePage();
    }
  }
  
  if (isMessageActive()) {
    if (window.customizeMoodleMessaging) {
      window.customizeMoodleMessaging();
    }
  }
};

// Global click handler to close active filter popups when clicking outside
document.addEventListener('click', (e) => {
  const isEnabled = localStorage.getItem('mymoodle_user_enabled') !== 'false';
  if (!isEnabled) {
    return;
  }
  const headers = document.querySelectorAll('.ultramoodle-block-header');
  headers.forEach(header => {
    const toggleBtn = header.querySelector('.ultramoodle-filter-toggle-btn');
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
});

// Watch settings updates
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.mymoodle_user_enabled) {
      const isEnabled = changes.mymoodle_user_enabled.newValue !== false && changes.mymoodle_user_enabled.newValue !== 'false';
      if (isEnabled) {
        document.documentElement.removeAttribute('data-mymoodle-disabled');
        init();
      } else {
        document.documentElement.setAttribute('data-mymoodle-disabled', 'true');
        cleanupDOM();
      }
    }
  });
}

// Try injecting immediately on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Observe mutations to ensure elements stay injected and handle dynamic updates (e.g. Moodle Ajax tabs)
const observer = new MutationObserver((mutations) => {
  const isEnabled = localStorage.getItem('mymoodle_user_enabled') !== 'false';
  if (!isEnabled) {
    return;
  }
  try {
    if (window._ultramoodleFiltering) return;

    // Ignore mutations caused by our own components or class changes (e.g. search updates, hiding/showing cards)
    const isOwnMutation = mutations.every(m => {
      if (m.target.closest && m.target.closest('#ultramoodle-hero-wrapper, #ultramoodle-courses-header, #ultramoodle-course-page-header, #mye-calendars-container')) {
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

    replaceFavicon();
    if (isDashboard()) {
      injectDashboardLanding();
      ensureCardLayoutSelected();
      injectBlockHeaders();
      customizeMoodleCards();
      customizeRecentCourses();
      customizeStarredCourses();
      customizeRecentItems();
      cleanDropdownCheckmarks();
      customizeTimeline();
    } else if (window.isCoursePage && window.isCoursePage()) {
      window.customizeCoursePageHeader();
      if (window.customizeResourceIcons) {
        window.customizeResourceIcons();
      }
    } else if (window.isCalendarPage && window.isCalendarPage()) {
      if (!document.getElementById('mye-calendars-container')) {
        window.initMoodleCalendar();
      }
    } else if (isProfilePage()) {
      if (window.customizeUserProfilePage) {
        window.customizeUserProfilePage();
      }
    }
    
    if (isMessageActive()) {
      if (window.customizeMoodleMessaging) {
        window.customizeMoodleMessaging();
      }
    }
    cleanNavbarLinks();
    injectCustomProfilePill();
  } catch (error) {
    console.error('[myMoodle ULTRA] MutationObserver callback error:', error);
  }
});

  try {
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
      attributeOldValue: true
    });
  } catch (error) {
    console.error('[myMoodle ULTRA] Failed to initialize MutationObserver:', error);
  }
})();
