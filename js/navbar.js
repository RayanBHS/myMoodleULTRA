// myMoodle ULTRA - Navbar Customization
const getStudentInfo = () => {
  const userTextEl = document.querySelector('.usertext') || document.querySelector('.usermenu .dropdown-toggle') || document.querySelector('.userbutton');
  let name = "Prénom Étudiant Nom Étudiant";
  if (userTextEl) {
    name = userTextEl.textContent.trim().replace(/\s+/g, ' ');
    if (name.includes('\n')) {
      name = name.split('\n')[0].trim();
    }
  }

  const nameParts = name.split(' ');
  const firstName = nameParts[0] || 'Prénom';
  const lastName = nameParts.slice(1).join(' ') || 'Étudiant';

  const avatarEl = document.querySelector('.userbutton img.userpicture') || document.querySelector('.usermenu img') || document.querySelector('.avatars img');
  const avatarUrl = avatarEl ? avatarEl.src : '';

  return { firstName, lastName, avatarUrl };
};

const injectCustomProfilePill = () => {
  const nativeUserMenu = document.querySelector('.usermenu') || document.querySelector('#usernavigation');
  if (!nativeUserMenu) return;
  if (document.getElementById('ultramoodle-profile-pill')) return;

  const { firstName, lastName, avatarUrl } = getStudentInfo();

  const pill = document.createElement('div');
  pill.id = 'ultramoodle-profile-pill';
  pill.className = 'ultramoodle-profile-pill';
  pill.innerHTML = `
    <div class="ultramoodle-profile-text">
      <div class="ultramoodle-profile-firstname">${firstName}</div>
      <div class="ultramoodle-profile-lastname">${lastName}</div>
    </div>
    <img class="ultramoodle-profile-avatar" src="${avatarUrl || 'https://via.placeholder.com/36'}" alt="Avatar" />
  `;

  // Hide native toggle
  const toggle = nativeUserMenu.querySelector('.dropdown-toggle') || nativeUserMenu.querySelector('a');
  if (toggle && toggle.style.display !== 'none') {
    toggle.style.setProperty('display', 'none', 'important');
  }
  
  nativeUserMenu.appendChild(pill);
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
};
