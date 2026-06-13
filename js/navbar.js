// myMoodle ULTRA - Navbar Customization
const getStudentInfo = () => {
  // 1. Try to extract from the userinitials element first, as it contains the full name in title/aria-label
  const initialsEl = document.querySelector('.userinitials');
  let name = "";
  if (initialsEl) {
    name = initialsEl.getAttribute('title') || initialsEl.getAttribute('aria-label') || '';
  }

  // 2. Fallback to usertext or usermenu dropdown toggle if userinitials is not found or has no title
  if (!name || !name.trim()) {
    const userTextEl = document.querySelector('.usertext') || document.querySelector('.usermenu .dropdown-toggle') || document.querySelector('.userbutton');
    if (userTextEl) {
      name = userTextEl.textContent.trim().replace(/\s+/g, ' ');
      if (name.includes('\n')) {
        name = name.split('\n')[0].trim();
      }
    }
  }

  if (!name || !name.trim()) {
    name = "Prénom Étudiant Nom Étudiant";
  }

  // Parse name into firstName and lastName
  // In French Moodle, initials titles are typically "LASTNAME Firstname" (e.g. "BELHOUS Rayan")
  const parts = name.trim().split(/\s+/);
  let firstName = 'Prénom';
  let lastName = 'Étudiant';

  if (parts.length === 1) {
    lastName = parts[0];
    firstName = '';
  } else if (parts.length > 1) {
    // Detect words that are fully uppercase (last name parts)
    const isUppercase = (str) => {
      return /[a-zA-ZÀ-ÿ]/.test(str) && str === str.toUpperCase();
    };

    const uppercaseParts = parts.filter(p => isUppercase(p));
    const otherParts = parts.filter(p => !isUppercase(p));

    if (uppercaseParts.length > 0 && otherParts.length > 0) {
      lastName = uppercaseParts.join(' ');
      firstName = otherParts.join(' ');
    } else {
      // Fallback: first word is first name, rest is last name
      firstName = parts[0];
      lastName = parts.slice(1).join(' ');
    }
  }

  // Capitalize first name and uppercase last name nicely
  const capitalizeWord = (word) => {
    return word.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('-');
  };
  if (firstName) {
    firstName = firstName.split(' ').map(w => capitalizeWord(w)).join(' ');
  }
  if (lastName) {
    lastName = lastName.toUpperCase();
  }

  // Find initials
  let initials = "";
  if (initialsEl) {
    initials = initialsEl.textContent.trim();
  }
  if (!initials) {
    const fLetter = firstName ? firstName.charAt(0) : '';
    const lLetter = lastName ? lastName.charAt(0) : '';
    initials = (fLetter + lLetter).toUpperCase() || 'U';
  }

  // Only target actual userpicture img tags to avoid matching general icons in the header
  const avatarEl = document.querySelector('.userbutton img.userpicture, .usermenu img.userpicture, .avatars img.userpicture');
  const avatarUrl = avatarEl ? avatarEl.src : '';

  return { firstName, lastName, initials, avatarUrl };
};

const injectCustomProfilePill = () => {
  // Find the native toggle element using specific selectors to avoid matching notification/chat buttons
  const toggle = document.querySelector('.usermenu .dropdown-toggle, .usermenu a, .userbutton, #usernavigation .dropdown-toggle');
  if (!toggle) return;

  // If we already styled the toggle, do not run again
  if (toggle.id === 'ultramoodle-profile-pill') return;

  const { firstName, lastName, initials, avatarUrl } = getStudentInfo();

  let avatarHTML = '';
  if (avatarUrl) {
    avatarHTML = `<img class="ultramoodle-profile-avatar" src="${avatarUrl}" alt="Avatar" />`;
  } else {
    avatarHTML = `<div class="ultramoodle-profile-avatar-initials">${initials}</div>`;
  }

  // Replace the inner HTML of the native toggle with our premium custom pill contents
  toggle.innerHTML = `
    <div class="ultramoodle-profile-text">
      <div class="ultramoodle-profile-firstname">${firstName}</div>
      <div class="ultramoodle-profile-lastname">${lastName}</div>
    </div>
    ${avatarHTML}
  `;

  // Apply styles by adding class and id
  toggle.id = 'ultramoodle-profile-pill';
  toggle.classList.add('ultramoodle-profile-pill');
  toggle.style.setProperty('display', 'flex', 'important');
};

const cleanNavbarLinks = () => {
  const navLinks = document.querySelectorAll('.navbar .nav-link');
  navLinks.forEach(link => {
    const text = link.textContent.trim().toLowerCase();
    if (text === 'accueil' || text === 'myefrei' || text === 'home') {
      const parent = link.closest('.nav-item');
      const target = parent || link;
      if (target.style.display !== 'none') {
        target.style.setProperty('display', 'none', 'important');
      }
    }
  });

  // Redirect Moodle message drawer toggle icon to the full messaging page
  const msgSelectors = [
    '[data-region="popover-region-messages"] .popover-region-toggle',
    '[data-region="popover-region-messages"] a.nav-link',
    'a[data-route="view-contacts"]',
    '#message-drawer-toggle',
    '.popover-region-messages .popover-region-toggle',
    '.popover-region-messages a'
  ];

  msgSelectors.forEach(selector => {
    const el = document.querySelector(selector);
    if (el && !el.classList.contains('ultramoodle-message-redirect-bound')) {
      el.classList.add('ultramoodle-message-redirect-bound');
      
      // If it's an anchor tag, change the href directly
      if (el.tagName === 'A') {
        el.setAttribute('href', window.location.origin + '/message/index.php');
      }

      // Add capture-phase click listener to intercept before Moodle drawer JS runs
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = window.location.origin + '/message/index.php';
      }, true);
    }
  });
};

const customizeUserProfilePage = () => {
  try {
    // Check if we are on the profile page
    const isProfile = window.location.pathname.includes('/user/profile.php') || document.body.classList.contains('path-user-profile') || document.getElementById('page-user-profile') !== null;
    if (!isProfile) return;
    
    // If we already injected our banner, do not run again
    if (document.getElementById('ultramoodle-profile-banner')) return;

    const mainRegion = document.querySelector('#region-main');
    if (!mainRegion) return;

    // Find the detailed info card using highly inclusive selectors and exact heading match
    const categoryCards = document.querySelectorAll('#region-main .card, #region-main section, #region-main .profile_category, #region-main .box');
    let detailedInfoCard = null;
    for (const card of categoryCards) {
      const header = card.querySelector('h1, h2, h3, h4, h5, h6, .card-title, .lead');
      if (header) {
        const titleLower = header.textContent.trim().toLowerCase();
        if (titleLower === 'informations détaillées' || titleLower === 'user details') {
          detailedInfoCard = card;
          break;
        }
      }
    }

    if (!detailedInfoCard) {
      console.warn('[myMoodle ULTRA] Detailed info card not found!');
      return;
    }

    // Extract email, edit profile URL
    const emailEl = detailedInfoCard.querySelector('a[href^="mailto:"]');
    const email = emailEl ? emailEl.textContent.trim() : '';
    
    const editLinkEl = detailedInfoCard.querySelector('a[href*="editprofile"], a[href*="edit"]');
    const editUrl = editLinkEl ? editLinkEl.getAttribute('href') : '';

    // Get name and avatar from our robust method
    const { firstName, lastName, initials } = getStudentInfo();

    // Try to find the large page header avatar for high resolution
    const headerAvatarEl = document.querySelector('.page-header-image img.userpicture, #page-header img.userpicture, .userprofile img.userpicture');
    const avatarUrl = headerAvatarEl ? headerAvatarEl.src : '';

    // Clone the detailed info container to preserve other fields (Country, Timezone)
    const contentArea = detailedInfoCard.querySelector('.card-body, ul, dl, .content') || detailedInfoCard;
    const clonedContent = contentArea.cloneNode(true);

    // Remove the edit link from the cloned content (as it will be in the banner)
    const editLinks = clonedContent.querySelectorAll('a[href*="editprofile"], a[href*="edit"]');
    editLinks.forEach(link => link.remove());

    // Find and remove the email field from the cloned content (in li elements)
    const lis = clonedContent.querySelectorAll('li');
    if (lis.length > 0) {
      lis.forEach(li => {
        if (li.textContent.includes(email) || li.querySelector('a[href^="mailto:"]')) {
          li.remove();
        }
      });
    }

    // Find and remove the email field from definition lists (dt/dd pairs)
    const dts = clonedContent.querySelectorAll('dt');
    const dds = clonedContent.querySelectorAll('dd');
    if (dts.length > 0) {
      for (let i = 0; i < dts.length; i++) {
        const dtText = dts[i].textContent.trim();
        if (dtText.toLowerCase().includes('courriel') || dtText.toLowerCase().includes('email') || dts[i].querySelector('a[href^="mailto:"]') || dds[i].querySelector('a[href^="mailto:"]')) {
          dts[i].remove();
          if (dds[i]) dds[i].remove();
        }
      }
    }

    // Find and remove email from generic child divs
    const childDivs = clonedContent.querySelectorAll(':scope > div');
    if (childDivs.length > 0) {
      childDivs.forEach(div => {
        if (div.textContent.includes(email) || div.querySelector('a[href^="mailto:"]')) {
          div.remove();
        }
      });
    }

    // Create the Large Banner element
    const banner = document.createElement('div');
    banner.id = 'ultramoodle-profile-banner';
    banner.className = 'ultramoodle-profile-banner';

    let avatarHTML = '';
    if (avatarUrl) {
      avatarHTML = `<img class="ultramoodle-profile-banner-avatar" src="${avatarUrl}" alt="Avatar" />`;
    } else {
      avatarHTML = `<div class="ultramoodle-profile-banner-avatar-initials">${initials}</div>`;
    }

    let actionsHTML = '';
    if (editUrl) {
      actionsHTML = `
        <div class="ultramoodle-profile-banner-actions">
          <a href="${editUrl}" class="ultramoodle-profile-banner-edit-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Modifier le profil
          </a>
        </div>
      `;
    }

    let emailHTML = '';
    if (email) {
      emailHTML = `
        <div class="ultramoodle-profile-banner-email">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          ${email}
        </div>
      `;
    }

    banner.innerHTML = `
      <div class="ultramoodle-profile-banner-avatar-container">
        ${avatarHTML}
      </div>
      <div class="ultramoodle-profile-banner-info">
        <h1 class="ultramoodle-profile-banner-name">${firstName} ${lastName}</h1>
        ${emailHTML}
      </div>
      ${actionsHTML}
    `;

    // Create the new compact "Informations" card
    const infoCard = document.createElement('div');
    infoCard.className = 'profile_category ultramoodle-info-card card';
    
    // Set the card header
    const newHeader = document.createElement('h3');
    newHeader.textContent = 'Informations';
    infoCard.appendChild(newHeader);
    infoCard.appendChild(clonedContent);

    // Insert the banner at the top of the main container inside the outer card container
    // Use :scope direct child selectors to target the outer card-body specifically
    const outerCard = mainRegion.querySelector(':scope > .card') || mainRegion.querySelector(':scope > div > .card') || mainRegion;
    const contentWrapper = outerCard.querySelector(':scope > .card-body') || outerCard;
    contentWrapper.insertBefore(banner, contentWrapper.firstChild);

    // Replace the original detailedInfoCard with the new compact "Informations" card
    detailedInfoCard.parentNode.replaceChild(infoCard, detailedInfoCard);
    
    console.log('[myMoodle ULTRA] customizeUserProfilePage completed successfully!');
  } catch (err) {
    console.error('[myMoodle ULTRA] Error in customizeUserProfilePage:', err);
  }
};

// Expose globally
window.customizeUserProfilePage = customizeUserProfilePage;
