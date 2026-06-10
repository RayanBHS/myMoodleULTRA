// myMoodle ULTRA - Theme and Settings Management
const initSettings = () => {
  chrome.storage.local.get({
    theme: 'light',
    hideFooter: true,
    condensedCards: true,
    hideSidebar: true
  }, (settings) => {
    applySettings(settings);
  });
};

const applySettings = (settings) => {
  const root = document.documentElement;

  // Apply Theme
  root.classList.remove('ultramoodle-dark', 'ultramoodle-light');
  if (settings.theme === 'dark') {
    root.classList.add('ultramoodle-dark');
  } else if (settings.theme === 'light') {
    root.classList.add('ultramoodle-light');
  } else {
    // Auto/System
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.add(prefersDark ? 'ultramoodle-dark' : 'ultramoodle-light');
  }

  // Apply Toggles
  root.classList.toggle('ultramoodle-hide-footer', settings.hideFooter);
  root.classList.toggle('ultramoodle-condensed', settings.condensedCards);
  root.classList.toggle('ultramoodle-hide-sidebar', settings.hideSidebar);

  // Trigger window resize event to force Moodle scripts to recalculate grid sizes
  window.dispatchEvent(new Event('resize'));
};

// Listen for updates from popup settings
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateSettings') {
    applySettings(request.settings);
    sendResponse({ status: 'applied' });
  }
});

// Run theme setup as early as possible
initSettings();

// Watch system theme change if set to Auto
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  chrome.storage.local.get('theme', (data) => {
    if (data.theme === 'auto') {
      initSettings();
    }
  });
});
