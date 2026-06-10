// myMoodle ULTRA - Dashboard Landing Zone and Hero Search Banner
const isDashboard = () => {
  const isMyPage = window.location.pathname.startsWith('/my/') || window.location.pathname === '/my';
  const hasOverviewBlock = document.querySelector('[data-block="myoverview"], .block_myoverview, [data-region="course-overview"]') !== null;
  return isMyPage || hasOverviewBlock;
};

// SVG Assets
const SEARCH_ICON = `
<svg class="ultramoodle-search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="11" cy="11" r="8"></circle>
  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
</svg>`;

const CALENDAR_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
  <line x1="16" y1="2" x2="16" y2="6"></line>
  <line x1="8" y1="2" x2="8" y2="6"></line>
  <line x1="3" y1="10" x2="21" y2="10"></line>
  <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"></path>
</svg>`;

const handleScrollOrSearch = () => {
  const pageElement = document.querySelector('#page');
  const heroWrapper = document.getElementById('ultramoodle-hero-wrapper');
  const heroElement = document.getElementById('ultramoodle-hero');
  const searchInput = document.getElementById('ultramoodle-course-search');
  if (!pageElement || !heroWrapper || !heroElement || !searchInput) return;

  // Calculate the normal height of the hero banner (always viewport height minus navbar)
  const normalHeroHeight = window.innerHeight - 64;
  
  // Trigger sticky header when scrolled past the hero banner minus the header height
  const isScrolledPastHero = pageElement.scrollTop >= (normalHeroHeight - 80);
  const hasSearchVal = searchInput.value.trim() !== '';

  // Toggle visibility of the floating scroll down button
  const scrollBtn = document.getElementById('ultramoodle-scroll-down-btn');
  if (scrollBtn) {
    if (pageElement.scrollTop > 20 || hasSearchVal) {
      scrollBtn.classList.add('ultramoodle-hidden');
    } else {
      scrollBtn.classList.remove('ultramoodle-hidden');
    }
  }

  if (hasSearchVal) {
    // Typing: collapse the wrapper to compact mode
    heroWrapper.classList.add('ultramoodle-collapsed');
    
    if (pageElement.scrollTop > 10) {
      // If user scrolls down while typing, lock it fixed at the top
      heroElement.classList.add('ultramoodle-hero-sticky');
      heroElement.classList.remove('ultramoodle-hero-scroll-trigger');
    } else {
      // At the top, keep it in document flow for smooth height transition
      heroElement.classList.remove('ultramoodle-hero-sticky', 'ultramoodle-hero-scroll-trigger');
    }
  } else {
    // Not typing: restore full wrapper size
    heroWrapper.classList.remove('ultramoodle-collapsed');
    
    if (isScrolledPastHero) {
      // Scrolling down: slide down the sticky header smoothly
      heroElement.classList.add('ultramoodle-hero-sticky', 'ultramoodle-hero-scroll-trigger');
    } else {
      // Back to top: return to normal flow inside wrapper
      heroElement.classList.remove('ultramoodle-hero-sticky', 'ultramoodle-hero-scroll-trigger');
    }
  }
};

const injectDashboardLanding = () => {
  if (!isDashboard()) return;
  if (document.getElementById('ultramoodle-hero-wrapper')) return; // Already injected

  // Find Moodle's main page container (#page)
  const pageElement = document.querySelector('#page');
  if (!pageElement) return;

  const heroWrapper = document.createElement('div');
  heroWrapper.id = 'ultramoodle-hero-wrapper';
  heroWrapper.className = 'ultramoodle-hero-wrapper';

  const heroSection = document.createElement('div');
  heroSection.id = 'ultramoodle-hero';
  heroSection.className = 'ultramoodle-hero-container';
  
  const logoUrl = chrome.runtime.getURL('img/logoMyMoodleUltra.png');
  heroSection.innerHTML = `
    <div class="ultramoodle-hero-brand">
      <img class="ultramoodle-hero-logo" src="${logoUrl}" alt="myMoodle ULTRA Logo" />
      <div class="ultramoodle-hero-title">
        <div class="title-line1">myMoodle</div>
        <div class="title-line2">ULTRA</div>
      </div>
    </div>
    <div class="ultramoodle-search-row">
      <div class="ultramoodle-search-bar">
        ${SEARCH_ICON}
        <input type="text" id="ultramoodle-course-search" class="ultramoodle-search-input" placeholder="Rechercher une matière..." autocomplete="off" />
      </div>
      <a href="https://moodle.myefrei.fr/calendar/view.php" class="ultramoodle-calendar-btn" title="Calendrier Moodle">
        ${CALENDAR_ICON}
      </a>
    </div>
    <div id="ultramoodle-search-results-feedback" class="ultramoodle-feedback-text"></div>
    <button id="ultramoodle-scroll-down-btn" class="ultramoodle-scroll-down-btn" title="Accéder aux cours">
      <span>Voir les cours</span>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>
  `;

  heroWrapper.appendChild(heroSection);

  // Insert hero wrapper as the first child of the #page container so it scrolls naturally
  pageElement.insertBefore(heroWrapper, pageElement.firstChild);

  // Setup scroll down button click event
  const scrollBtn = document.getElementById('ultramoodle-scroll-down-btn');
  if (scrollBtn) {
    scrollBtn.addEventListener('click', () => {
      const normalHeroHeight = window.innerHeight - 64;
      pageElement.scrollTo({
        top: normalHeroHeight - 40,
        behavior: 'smooth'
      });
    });
  }

  // Setup course search listener and sticky handlers
  const searchInput = document.getElementById('ultramoodle-course-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      filterCourses(e.target.value);
      handleScrollOrSearch();
    });
  }

  // Monitor scrolling on #page container to trigger sticky search bar
  pageElement.addEventListener('scroll', handleScrollOrSearch);

  // Check initial state
  handleScrollOrSearch();
};
