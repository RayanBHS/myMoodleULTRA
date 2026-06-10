document.addEventListener('DOMContentLoaded', () => {
  const themeRadios = document.querySelectorAll('input[name="theme"]');
  const hideFooterCheckbox = document.getElementById('hide-footer');
  const condensedCardsCheckbox = document.getElementById('condensed-cards');
  const hideSidebarCheckbox = document.getElementById('hide-sidebar');

  chrome.storage.local.get({
    theme: 'light',
    hideFooter: true,
    condensedCards: true,
    hideSidebar: true
  }, (items) => {
    // Select correct theme radio
    const checkedRadio = document.querySelector(`input[name="theme"][value="${items.theme}"]`);
    if (checkedRadio) checkedRadio.checked = true;

    // Set toggle states
    hideFooterCheckbox.checked = items.hideFooter;
    condensedCardsCheckbox.checked = items.condensedCards;
    hideSidebarCheckbox.checked = items.hideSidebar;
  });

  // Save changes and notify all Moodle tabs
  const saveAndNotify = () => {
    const selectedTheme = document.querySelector('input[name="theme"]:checked').value;
    const settings = {
      theme: selectedTheme,
      hideFooter: hideFooterCheckbox.checked,
      condensedCards: condensedCardsCheckbox.checked,
      hideSidebar: hideSidebarCheckbox.checked
    };

    chrome.storage.local.set(settings, () => {
      // Notify EFREI Moodle tabs about the configuration update
      chrome.tabs.query({ url: '*://moodle.myefrei.fr/*' }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { action: 'updateSettings', settings }).catch(() => {
            // Ignore errors for tabs where content script isn't loaded yet
          });
        });
      });
    });
  };

  // Add event listeners to all controls
  themeRadios.forEach(radio => radio.addEventListener('change', saveAndNotify));
  hideFooterCheckbox.addEventListener('change', saveAndNotify);
  condensedCardsCheckbox.addEventListener('change', saveAndNotify);
  hideSidebarCheckbox.addEventListener('change', saveAndNotify);
});
