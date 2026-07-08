// myMoodle ULTRA - Theme and Settings Management
(function() {
  'use strict';

  // Helper to toggle extension-specific stylesheets
  const toggleExtensionStylesheets = (enable) => {
    try {
      const sheets = document.styleSheets;
      if (!sheets) return;
      for (let i = 0; i < sheets.length; i++) {
        const sheet = sheets[i];
        try {
          if (sheet.href && sheet.href.includes('chrome-extension://')) {
            sheet.disabled = !enable;
          }
        } catch (e) {
          // Ignore cross-origin access errors if any
        }
      }
    } catch (e) {
      console.error('[myMoodle ULTRA] Error toggling stylesheets:', e);
    }
  };

  const applySettings = (settings) => {
    const root = document.documentElement;

    root.classList.remove('ultramoodle-dark', 'ultramoodle-light');

    // Apply Theme
    if (settings.theme === 'dark') {
      root.classList.add('ultramoodle-dark');
    } else if (settings.theme === 'light') {
      root.classList.add('ultramoodle-light');
    } else {
      // Auto/System
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(prefersDark ? 'ultramoodle-dark' : 'ultramoodle-light');
    }

    // Trigger window resize event to force Moodle scripts to recalculate grid sizes
    window.dispatchEvent(new Event('resize'));
  };

  const initSettings = () => {
    const settings = {
      theme: localStorage.getItem('mymoodle_user_theme') || 'light'
    };
    applySettings(settings);
  };

  // Run stylesheet toggle on script load
  const runToggleOnLoad = () => {
    const isEnabled = localStorage.getItem('mymoodle_user_enabled') !== 'false';
    toggleExtensionStylesheets(isEnabled);
  };

  runToggleOnLoad();

  // Run again on DOM load and full window load to make sure we catch them all
  document.addEventListener('DOMContentLoaded', runToggleOnLoad);
  window.addEventListener('load', runToggleOnLoad);

  // 1. Sync from chrome.storage.local to localStorage asynchronously (for future loads)
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get({
      mymoodle_user_enabled: true,
      theme: 'light',
      layout: 'grid',
      courseHeader: true,
      quickFilters: true,
      viewer: true,
      oneui: true,
      handshake: true
    }, (settings) => {
      const wasEnabled = localStorage.getItem('mymoodle_user_enabled') !== 'false';
      const isEnabled = settings.mymoodle_user_enabled !== false && settings.mymoodle_user_enabled !== 'false';
      
      localStorage.setItem('mymoodle_user_enabled', String(settings.mymoodle_user_enabled));
      localStorage.setItem('mymoodle_user_theme', String(settings.theme));
      localStorage.setItem('mymoodle_layout_pref', String(settings.layout));
      localStorage.setItem('mymoodle_course_header', String(settings.courseHeader));
      localStorage.setItem('mymoodle_quick_filters', String(settings.quickFilters));
      localStorage.setItem('mymoodle_user_viewer', String(settings.viewer));
      localStorage.setItem('mymoodle_user_oneui', String(settings.oneui));
      localStorage.setItem('mymoodle_user_handshake', String(settings.handshake));
      
      if (wasEnabled !== isEnabled) {
        window.location.reload();
        return;
      }
      
      toggleExtensionStylesheets(isEnabled);
      
      if (isEnabled) {
        window.mymoodle_disabled = false;
        document.documentElement.setAttribute('data-mymoodle-enabled', 'true');
        applySettings({
          theme: settings.theme
        });
      } else {
        window.mymoodle_disabled = true;
        document.documentElement.removeAttribute('data-mymoodle-enabled');
        const root = document.documentElement;
        root.classList.remove('ultramoodle-dark', 'ultramoodle-light');
      }
    });
  }

  // 2. Read synchronously from Moodle's localStorage
  const mymEnabled = localStorage.getItem('mymoodle_user_enabled') !== 'false';
  if (!mymEnabled) {
    window.mymoodle_disabled = true;
    document.documentElement.removeAttribute('data-mymoodle-enabled');
    const root = document.documentElement;
    root.classList.remove('ultramoodle-dark', 'ultramoodle-light', 'ultramoodle-hide-footer', 'ultramoodle-condensed', 'ultramoodle-hide-sidebar');
    toggleExtensionStylesheets(false);
  } else {
    document.documentElement.setAttribute('data-mymoodle-enabled', 'true');
    window.mymoodle_disabled = false;
    // Run theme setup synchronously
    initSettings();
  }

  // Watch system theme change if set to Auto
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const theme = localStorage.getItem('mymoodle_user_theme') || 'light';
    if (theme === 'auto') {
      initSettings();
    }
  });

  // Watch storage changes in real-time
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        if (changes.mymoodle_user_enabled) {
          const wasEnabled = localStorage.getItem('mymoodle_user_enabled') !== 'false';
          const newEnabled = changes.mymoodle_user_enabled.newValue !== false && changes.mymoodle_user_enabled.newValue !== 'false';
          localStorage.setItem('mymoodle_user_enabled', String(changes.mymoodle_user_enabled.newValue));
          if (wasEnabled !== newEnabled) {
            window.location.reload();
            return;
          }
        }
        if (changes.theme) {
          localStorage.setItem('mymoodle_user_theme', String(changes.theme.newValue));
        }
        if (changes.layout) {
          localStorage.setItem('mymoodle_layout_pref', String(changes.layout.newValue));
        }
        if (changes.courseHeader) {
          localStorage.setItem('mymoodle_course_header', String(changes.courseHeader.newValue));
        }
        if (changes.quickFilters) {
          localStorage.setItem('mymoodle_quick_filters', String(changes.quickFilters.newValue));
        }
        if (changes.viewer) {
          localStorage.setItem('mymoodle_user_viewer', String(changes.viewer.newValue));
        }
        if (changes.oneui) {
          localStorage.setItem('mymoodle_user_oneui', String(changes.oneui.newValue));
        }
        if (changes.handshake) {
          localStorage.setItem('mymoodle_user_handshake', String(changes.handshake.newValue));
        }

        const isEnabled = localStorage.getItem('mymoodle_user_enabled') !== 'false';
        toggleExtensionStylesheets(isEnabled);

        if (isEnabled) {
          window.mymoodle_disabled = false;
          document.documentElement.setAttribute('data-mymoodle-enabled', 'true');
          initSettings();
        } else {
          window.mymoodle_disabled = true;
          document.documentElement.removeAttribute('data-mymoodle-enabled');
          const root = document.documentElement;
          root.classList.remove('ultramoodle-dark', 'ultramoodle-light');
        }
      }
    });
  }
})();
