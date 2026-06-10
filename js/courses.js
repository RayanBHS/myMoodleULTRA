// myMoodle ULTRA - Course Customizations, Indexing, Header, and Filters
const getCourseOverviewContainer = () => {
  return document.querySelector('[data-block="myoverview"], .block_myoverview, [data-region="course-overview"]');
};

const getCourseCards = () => {
  const container = getCourseOverviewContainer();
  if (!container) return [];

  const cardsSet = new Set();

  // 0. Priority: find already-customized cards directly (most reliable for filtering)
  const customized = container.querySelectorAll('.ultramoodle-card-customized');
  customized.forEach(card => cardsSet.add(card));
  if (cardsSet.size > 0) return Array.from(cardsSet);

  // 1. If Card View is active
  const cardView = container.querySelector('[data-region="card-view"]');
  if (cardView) {
    const cards = cardView.querySelectorAll('.card, [data-purpose="course-card"], .coc-course-box');
    cards.forEach(card => cardsSet.add(card));
  }

  // 2. If List View is active
  const listView = container.querySelector('[data-region="list-view"]');
  if (listView) {
    const items = listView.querySelectorAll('.list-group-item, [class*="list-group-item"]');
    items.forEach(item => cardsSet.add(item));
  }

  // 3. If Summary View is active
  const summaryView = container.querySelector('[data-region="summary-view"]');
  if (summaryView) {
    const items = summaryView.querySelectorAll('.list-group-item, .course-summaryitem, [class*="list-group-item"]');
    items.forEach(item => cardsSet.add(item));
  }

  // 4. Fallback if none of the specific regions are found (for compatibility)
  if (cardsSet.size === 0) {
    const cardSelectors = [
      '.coc-course-box',
      '.course-info-container',
      '[data-purpose="course-card"]',
      '.dashboard-card-deck .card',
      '.course-list-item',
      '.coursebox',
      '.course-summaryitem'
    ];
    cardSelectors.forEach(selector => {
      const found = container.querySelectorAll(selector);
      found.forEach(el => {
        const card = el.closest('.coc-course-box') || 
                     el.closest('.card') || 
                     el.closest('.course-list-item') || 
                     el.closest('.coursebox') || 
                     el;
        if (card && card.id !== 'ultramoodle-hero' && !card.closest('#ultramoodle-hero') && 
            card.id !== 'ultramoodle-hero-wrapper' && !card.closest('#ultramoodle-hero-wrapper') &&
            !card.classList.contains('block') && !card.classList.contains('block_myoverview') &&
            card.getAttribute('data-block') !== 'myoverview') {
          cardsSet.add(card);
        }
      });
    });
  }

  // 5. Fallback link tracing if still empty
  if (cardsSet.size === 0) {
    const courseLinks = container.querySelectorAll('a[href*="/course/view.php?id="]');
    courseLinks.forEach(link => {
      const card = link.closest('.coc-course-box') ||
                   link.closest('.card') || 
                   link.closest('.list-group-item') || 
                   link.closest('.coursebox') || 
                   link.closest('div[data-course-id]') || 
                   link.parentElement;
      if (card && card.id !== 'ultramoodle-hero' && !card.closest('#ultramoodle-hero') && 
          card.id !== 'ultramoodle-hero-wrapper' && !card.closest('#ultramoodle-hero-wrapper') &&
          !card.classList.contains('block') && !card.classList.contains('block_myoverview') &&
          card.getAttribute('data-block') !== 'myoverview') {
        cardsSet.add(card);
      }
    });
  }

  return Array.from(cardsSet);
};

const getCleanText = (element) => {
  if (!element) return '';
  // Clone node so we don't modify the actual page DOM
  const clone = element.cloneNode(true);
  // Remove Moodle's screen-reader/hidden elements
  const hiddenSelectors = ['.sr-only', '.accesshide', 'span[class*="sr-"]', '[class*="accesshide"]', '.hidden-sr'];
  hiddenSelectors.forEach(sel => {
    clone.querySelectorAll(sel).forEach(el => el.remove());
  });
  return clone.textContent.trim().replace(/\s+/g, ' ');
};

const getCourseTitle = (card) => {
  if (card.dataset.ultramoodleTitle) {
    return card.dataset.ultramoodleTitle;
  }
  // Select title using standard classes or text inside link
  const titleSelectors = [
    '.ultramoodle-card-title',
    '.coursename',
    '.course-name',
    '.multiline',
    '.card-title',
    'h5',
    'h6',
    'a[href*="/course/view.php?id="]'
  ];

  for (const selector of titleSelectors) {
    const el = card.querySelector(selector);
    if (el) {
      const cleanText = getCleanText(el);
      if (cleanText) return cleanText;
    }
  }

  // Fallback to textContent of the card itself, but limit length
  return getCleanText(card).split('\n')[0] || '';
};

// Helpers for card details extraction
const getCardImage = (card) => {
  // Check for images inside the card first
  const img = card.querySelector('img.card-img-top, img.course-image, img');
  if (img && img.src && !img.src.includes('logoMyMoodleUltra')) {
    return img.src;
  }
  // Check background image on card-img or course-image
  const bgEl = card.querySelector('.card-img, .course-image, [style*="background-image"]');
  if (bgEl) {
    const bg = bgEl.style.backgroundImage;
    if (bg && bg.startsWith('url')) {
      const match = bg.match(/url\(['"]?([^'"]+)['"]?\)/);
      if (match && match[1]) {
        return match[1];
      }
    }
  }
  return '';
};

const getCardProgress = (card) => {
  const progressBar = card.querySelector('.progress-bar, [role="progressbar"]');
  if (progressBar) {
    const value = progressBar.getAttribute('aria-valuenow') || progressBar.style.width;
    if (value) {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  }
  // Fallback: search for text containing % in the card
  const textElements = card.querySelectorAll('.progress, .percent, .percentage, [data-percent], span, div');
  for (const el of textElements) {
    const text = el.textContent.trim();
    const match = text.match(/(\d+)\s*%/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return null;
};

const extractSemester = (title) => {
  // Check for SX or S0 pattern (e.g. S4, S5, S6, S04, S05, S1, etc.)
  const sMatch = title.match(/\b[sS]\s*([1-9])\b/);
  if (sMatch) {
    return parseInt(sMatch[1], 10);
  }
  
  // Check for course code pattern at the start (e.g. FE401, FH401, etc.)
  const codeMatch = title.match(/^\s*\*?\s*([A-Za-z]{2,5})(\d)/);
  if (codeMatch) {
    return parseInt(codeMatch[2], 10);
  }
  
  // Fallback: check any word in the title that starts with letters and is followed by a digit
  const anyCodeMatch = title.match(/\b[A-Za-z]{2,5}(\d)\d{2}/);
  if (anyCodeMatch) {
    return parseInt(anyCodeMatch[1], 10);
  }
  
  return null;
};

const getCardSubtitle = (card) => {
  const selectors = [
    '.text-muted',
    '.muted',
    '.categoryname',
    '.course-category',
    '.category',
    '.course-list-category'
  ];
  for (const selector of selectors) {
    const el = card.querySelector(selector);
    if (el) {
      const cleanText = getCleanText(el);
      if (cleanText) return cleanText;
    }
  }
  return '';
};

// --- Moodle API: fetch all enrolled courses for reliable data ---
let _moodleCourseCache = null;
let _moodleCourseFetchPromise = null;

const getMoodleSesskey = () => {
  if (window.M?.cfg?.sesskey) return window.M.cfg.sesskey;
  const link = document.querySelector('a[href*="sesskey="]');
  if (link) { const m = link.href.match(/sesskey=([^&]+)/); if (m) return m[1]; }
  const form = document.querySelector('input[name="sesskey"]');
  if (form) return form.value;
  return null;
};

const fetchMoodleCourses = () => {
  if (_moodleCourseCache) return Promise.resolve(_moodleCourseCache);
  if (_moodleCourseFetchPromise) return _moodleCourseFetchPromise;
  const sesskey = getMoodleSesskey();
  if (!sesskey) return Promise.resolve(null);
  _moodleCourseFetchPromise = fetch(
    `/lib/ajax/service.php?sesskey=${sesskey}&info=core_course_get_enrolled_courses_by_timeline_classification`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ index: 0, methodname: 'core_course_get_enrolled_courses_by_timeline_classification',
        args: { offset: 0, limit: 0, classification: 'all', sort: 'fullname', customfieldname: '', customfieldvalue: '' } }])
    }
  )
  .then(r => r.json())
  .then(data => {
    if (data?.[0]?.error === false && data[0].data?.courses) {
      _moodleCourseCache = {};
      data[0].data.courses.forEach(c => { _moodleCourseCache[c.id] = c; });
      return _moodleCourseCache;
    }
    return null;
  })
  .catch(() => null);
  return _moodleCourseFetchPromise;
};

let hasForcedAll = false;

const ensureAllCoursesSelected = () => {
  const container = getCourseOverviewContainer();
  if (!container) return;
  
  const filterSelector = container.querySelector('[data-region="filter-selector"]');
  if (!filterSelector) return;
  
  const button = filterSelector.querySelector('.dropdown-toggle, button');
  if (button) {
    const text = button.textContent.trim().toLowerCase();
    // If it's set to "Favoris" (or "Starred" / "Favourites" in English), force click "Tout" / "All"
    if (text.includes('favori') || text.includes('star')) {
      const allLink = filterSelector.querySelector('a[data-filter-value="all"], [data-filter-value="all"]');
      if (allLink) {
        allLink.click();
      }
    }
  }
};

const ensureCardLayoutSelected = () => {
  const container = getCourseOverviewContainer();
  if (!container) return;
  
  const displaySelector = container.querySelector('[data-region="display-selector"]');
  if (displaySelector) {
    // Language-independent check: check active layout dropdown option
    const activeOption = displaySelector.querySelector('[data-display-option].active');
    if (activeOption) {
      const value = activeOption.getAttribute('data-display-option');
      if (value === 'list' || value === 'summary') {
        const cardLink = displaySelector.querySelector('[data-display-option="card"]');
        if (cardLink) {
          const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          cardLink.dispatchEvent(clickEvent);
        }
      }
    } else {
      // Fallback to text matching if the active class is missing
      const button = displaySelector.querySelector('.dropdown-toggle, button');
      if (button) {
        const text = button.textContent.trim().toLowerCase();
        if (text.includes('liste') || text.includes('list') || text.includes('summary') || text.includes('résumé') || text.includes('sommaire')) {
          const cardLink = displaySelector.querySelector('[data-display-option="card"]');
          if (cardLink) {
            const clickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window
            });
            cardLink.dispatchEvent(clickEvent);
          }
        }
      }
    }
  }
};

const hideNativeCourseOverviewTitle = (container) => {
  if (!container) return;
  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6, .card-title, [role="heading"], .title, .block-title, header');
  headings.forEach(el => {
    if (el.closest('#ultramoodle-courses-header')) return;
    const text = el.textContent.trim().toLowerCase();
    if (text === "vue d'ensemble des cours" || text === "course overview" || text.includes("vue d'ensemble")) {
      el.style.setProperty('display', 'none', 'important');
    }
  });
};

const injectCoursesHeader = () => {
  if (!isDashboard()) return;
  
  const courseOverview = getCourseOverviewContainer();
  if (!courseOverview) return;
  
  hideNativeCourseOverviewTitle(courseOverview);
  
  // Force Card layout on Moodle's side so Moodle always renders full card info
  ensureCardLayoutSelected();
  
  // Force selection of "Tout" on first load if it was set to "Favoris"
  if (!hasForcedAll) {
    ensureAllCoursesSelected();
    hasForcedAll = true;
  }
  
  // Apply our custom view class (grid or list) constantly to keep styling active
  const currentLayout = localStorage.getItem('ultramoodle-layout-pref') || 'grid';
  if (!courseOverview.classList.contains(`ultramoodle-view-${currentLayout}`)) {
    courseOverview.classList.remove('ultramoodle-view-grid', 'ultramoodle-view-list');
    courseOverview.classList.add(`ultramoodle-view-${currentLayout}`);
  }
  
  const searchInput = courseOverview.querySelector('input[placeholder*="Rechercher"], input[placeholder*="Search"], input[type="search"], [data-region="search-input"] input');
  const filterSelector = courseOverview.querySelector('[data-region="filter-selector"]');
  const filterBar = (searchInput ? searchInput.closest('.row, .bar, [data-region="filter-bar"], .justify-content-between') : null) ||
                    (filterSelector ? filterSelector.closest('.row, .bar, [data-region="filter-bar"], .justify-content-between') : null) ||
                    courseOverview.querySelector('[data-region="filter-bar"]') || 
                    courseOverview.querySelector('.bar');

  const existingHeader = document.getElementById('ultramoodle-courses-header');
  if (existingHeader) {
    // If the filter bar changed (e.g. Moodle AJAX layout/tab re-rendering), force re-injection
    if (filterBar && existingHeader.associatedFilterBar !== filterBar) {
      existingHeader.remove();
    } else {
      // Ensure the filterBar still has the class even if Moodle partially re-rendered it
      if (filterBar && !filterBar.classList.contains('ultramoodle-native-filter-bar')) {
        filterBar.classList.add('ultramoodle-native-filter-bar');
      }
      return;
    }
  }
  
  const header = document.createElement('div');
  header.id = 'ultramoodle-courses-header';
  header.className = 'ultramoodle-courses-header';
  header.associatedFilterBar = filterBar;
  header.innerHTML = `
    <span class="ultramoodle-courses-header-title">Les cours</span>
    <div id="ultramoodle-filter-toggle-btn" class="ultramoodle-filter-toggle-btn" title="Filtrer les cours" style="cursor: pointer;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
      </svg>
    </div>
  `;
  
  const contentContainer = courseOverview.querySelector('[data-region="course-overview"]') || 
                           courseOverview.querySelector('.card-body') || 
                           courseOverview;
  
  contentContainer.insertBefore(header, contentContainer.firstChild);
  
  if (filterBar) {
    filterBar.classList.add('ultramoodle-native-filter-bar');
    
    // Inject our custom layout selector inside the popup
    if (!document.getElementById('ultramoodle-custom-layout-selector')) {
      const selectorWrapper = document.createElement('div');
      selectorWrapper.id = 'ultramoodle-custom-layout-selector';
      selectorWrapper.className = 'ultramoodle-custom-layout-selector-wrapper';
      selectorWrapper.innerHTML = `
        <span class="ultramoodle-custom-layout-title">Affichage</span>
        <div class="ultramoodle-custom-layout-buttons">
          <button id="ultramoodle-btn-layout-grid" class="ultramoodle-layout-btn ${currentLayout === 'grid' ? 'active' : ''}">Carte</button>
          <button id="ultramoodle-btn-layout-list" class="ultramoodle-layout-btn ${currentLayout === 'list' ? 'active' : ''}">Liste</button>
        </div>
      `;
      filterBar.appendChild(selectorWrapper);
      
      const gridBtn = document.getElementById('ultramoodle-btn-layout-grid');
      const listBtn = document.getElementById('ultramoodle-btn-layout-list');
      
      if (gridBtn && listBtn) {
        gridBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          localStorage.setItem('ultramoodle-layout-pref', 'grid');
          gridBtn.classList.add('active');
          listBtn.classList.remove('active');
          courseOverview.classList.remove('ultramoodle-view-list');
          courseOverview.classList.add('ultramoodle-view-grid');
          window.dispatchEvent(new Event('resize'));
        });
        
        listBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          localStorage.setItem('ultramoodle-layout-pref', 'list');
          listBtn.classList.add('active');
          gridBtn.classList.remove('active');
          courseOverview.classList.remove('ultramoodle-view-grid');
          courseOverview.classList.add('ultramoodle-view-list');
          window.dispatchEvent(new Event('resize'));
        });
      }
    }
  }
  
  const toggleBtn = document.getElementById('ultramoodle-filter-toggle-btn');
  if (toggleBtn) {
    toggleBtn.classList.remove('active');
    if (filterBar) {
      filterBar.classList.remove('ultramoodle-filter-bar-visible');
    }
    
    // Stop event propagation in bubble phase to prevent Moodle event delegation from catching interactions
    const interactionEvents = ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend'];
    interactionEvents.forEach(evtName => {
      toggleBtn.addEventListener(evtName, (e) => {
        e.stopPropagation();
      });
    });
    
    // Handle toggle logic
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (filterBar) {
        filterBar.classList.toggle('ultramoodle-filter-bar-visible');
        toggleBtn.classList.toggle('active');
      }
    });
  }
};

const getCourseLinkEl = (card) => {
  if (card.tagName === 'A' && card.href && card.href.includes('/course/view.php?id=')) {
    return card;
  }
  return card.querySelector('a[href*="/course/view.php?id="]');
};

const buildCard = (card, apiCourse) => {
  const linkEl = getCourseLinkEl(card);
  if (!linkEl) return;
  const courseUrl = linkEl.href;

  let fullname, subtitle, progress, imageUrl;

  if (apiCourse) {
    fullname  = apiCourse.fullname || '';
    subtitle  = apiCourse.coursecategory || '';
    progress  = apiCourse.hasprogress ? apiCourse.progress : null;
    imageUrl  = apiCourse.courseimage || getCardImage(card);
  } else {
    fullname  = getCourseTitle(card);
    subtitle  = getCardSubtitle(card);
    progress  = getCardProgress(card);
    imageUrl  = getCardImage(card);
  }

  const semester = extractSemester(fullname);
  const cleanRegex = /^\s*\*?\s*([A-Za-z]{2,5}\d{3,4}(?:-[A-Za-z0-9]+)?)\s*(?:-|\u2013|\u2014)\s*/;
  const codeMatch = fullname.match(cleanRegex);
  const courseCode = codeMatch ? codeMatch[1] : null;
  let cleanTitle = fullname.replace(cleanRegex, '').replace(/\s*\(P\d[^)]*\)\s*$/g, '').trim() || fullname;

  const nativeDropdown = card.querySelector('.dropdown');

  // If the card is an A tag, replace it with a DIV tag to avoid nested A tags and preserve click behaviors
  if (card.tagName === 'A') {
    const divCard = document.createElement('div');
    for (const attr of card.attributes) {
      divCard.setAttribute(attr.name, attr.value);
    }
    divCard.removeAttribute('href');
    card.parentNode.replaceChild(divCard, card);
    card = divCard;
  }

  // Store full name for search BEFORE overwriting innerHTML
  card.dataset.ultramoodleTitle = fullname;
  card.classList.add('ultramoodle-card-customized');

  card.innerHTML = `
    <div class="ultramoodle-custom-card-inner">
      <a href="${courseUrl}" class="ultramoodle-card-link-wrapper">
        <div class="ultramoodle-card-image-container">
          ${imageUrl ? `<img src="${imageUrl}" class="ultramoodle-card-image" alt="" />` : ''}
          <div class="ultramoodle-card-image-placeholder"></div>
        </div>
        <div class="ultramoodle-card-body">
          ${courseCode ? `<div class="ultramoodle-card-code">${courseCode}</div>` : ''}
          <div class="ultramoodle-card-title" title="${fullname}">${cleanTitle}</div>
          <div class="ultramoodle-card-subtitle" title="${subtitle}">${subtitle}</div>
        </div>
      </a>
      <div class="ultramoodle-card-footer">
        <div class="ultramoodle-card-pills">
          ${progress !== null ? `<div class="ultramoodle-pill-progress">${progress}%</div>` : ''}
          ${semester !== null ? `<div class="ultramoodle-pill-semester">Semestre ${semester}</div>` : ''}
        </div>
        <div class="ultramoodle-card-menu-placeholder"></div>
      </div>
    </div>
  `;

  if (nativeDropdown) {
    const placeholder = card.querySelector('.ultramoodle-card-menu-placeholder');
    if (placeholder) placeholder.appendChild(nativeDropdown);
  }
};


const customizeMoodleCards = () => {
  if (!isDashboard()) return;
  
  const container = getCourseOverviewContainer();
  hideNativeCourseOverviewTitle(container);

  const cards = getCourseCards();
  const uncustomized = cards.filter(c => !c.classList.contains('ultramoodle-card-customized'));
  if (uncustomized.length === 0) {
    makeCardsFillRow();
    return;
  }

  fetchMoodleCourses().then(courseData => {
    uncustomized.forEach(card => {
      if (card.classList.contains('ultramoodle-card-customized')) return;
      const linkEl = getCourseLinkEl(card);
      if (!linkEl) return;
      const idMatch = linkEl.href.match(/\/course\/view\.php\?id=(\d+)/);
      const courseId = idMatch ? parseInt(idMatch[1]) : null;
      const apiCourse = (courseData && courseId) ? courseData[courseId] : null;
      buildCard(card, apiCourse);
    });
    makeCardsFillRow();
  });
};

const customizeRecentCourses = () => {
  const block = document.querySelector('.block_recentlyaccessedcourses');
  if (!block) return;

  // Check if our custom slider is already injected
  if (block.querySelector('.ultramoodle-recent-slider')) {
    return; // Already customized
  }

  // Find all cards inside the block (both customized and uncustomized)
  const nativeCards = block.querySelectorAll('.card, [data-purpose="course-card"]');
  if (nativeCards.length === 0) return;

  // Filter to keep only real cards with valid course links (ignores Moodle's loading skeletons)
  const realCards = Array.from(nativeCards).filter(card => getCourseLinkEl(card) !== null);
  if (realCards.length === 0) return;

  const contentArea = block.querySelector('.card-text.content') || block.querySelector('.card-body') || block;

  fetchMoodleCourses().then(courseData => {
    // Check again to avoid race conditions
    if (block.querySelector('.ultramoodle-recent-slider')) return;

    // Create a new clean container for our slider
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'ultramoodle-recent-slider';

    realCards.forEach(card => {
      // Find course URL
      const linkEl = getCourseLinkEl(card);
      if (!linkEl) return;
      const courseUrl = linkEl.href;
      
      const idMatch = courseUrl.match(/\/course\/view\.php\?id=(\d+)/);
      const courseId = idMatch ? parseInt(idMatch[1]) : null;
      const apiCourse = (courseData && courseId) ? courseData[courseId] : null;

      // Clone native card to preserve structures for buildCard
      const cardClone = card.cloneNode(true);
      cardClone.removeAttribute('style');
      cardClone.className = 'card dashboard-card';

      // Append it to the sliderContainer FIRST so it has a parentNode for replaceChild
      sliderContainer.appendChild(cardClone);

      // Build the card inside our slider
      buildCard(cardClone, apiCourse);
    });

    // Clear content area and append our slider
    contentArea.innerHTML = '';
    contentArea.appendChild(sliderContainer);
  });
};

// Make card column wrappers fill row space evenly, with a min-width so they wrap properly
const makeCardsFillRow = () => {
  const currentLayout = localStorage.getItem('ultramoodle-layout-pref') || 'grid';
  if (currentLayout !== 'grid') return;

  const container = getCourseOverviewContainer();
  if (!container) return;

  const allCards = container.querySelectorAll('.ultramoodle-card-customized');

  allCards.forEach(card => {
    const parent = card.parentElement;
    if (!parent) return;

    const isWrapper = parent !== container && !parent.matches('[data-region], .dashboard-card-deck, .card-deck');
    const target = isWrapper ? parent : card;

    if (card.classList.contains('ultramoodle-course-hidden')) {
      target.style.removeProperty('flex');
      target.style.removeProperty('max-width');
      target.style.removeProperty('min-width');
      return;
    }

    // flex: 1 1 300px → grow equally, but each card needs at least 300px before wrapping to next line
    // max-width: 50% → never wider than half the row
    // min-width: 300px → ensures cards don't get squeezed too small
    target.style.setProperty('flex', '1 1 300px', 'important');
    target.style.setProperty('max-width', '50%', 'important');
    target.style.setProperty('min-width', '300px', 'important');
  });
};

const normalizeText = (text) => {
  if (!text) return '';
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
};

const filterCourses = (query) => {
  window._ultramoodleFiltering = true;
  
  const cards = getCourseCards();
  const cleanQuery = normalizeText(query);
  
  if (cleanQuery === '') {
    cards.forEach(card => {
      card.classList.remove('ultramoodle-course-hidden');
    });
    showAllContainers();
    makeCardsFillRow();
    const feedback = document.getElementById('ultramoodle-search-results-feedback');
    if (feedback) {
      feedback.textContent = '';
    }
    setTimeout(() => {
      window._ultramoodleFiltering = false;
    }, 100);
    return;
  }

  let matchCount = 0;
  cards.forEach(card => {
    const title = getCourseTitle(card);
    const subtitle = getCardSubtitle(card);
    
    if (title) {
      let searchableText = title + ' ' + subtitle;
      const semester = extractSemester(title);
      if (semester !== null) {
        searchableText += ' semestre ' + semester + ' s' + semester;
      }
      
      const normalizedSearchable = normalizeText(searchableText);
      const isMatch = normalizedSearchable.includes(cleanQuery);
      
      if (isMatch) {
        card.classList.remove('ultramoodle-course-hidden');
        matchCount++;
      } else {
        card.classList.add('ultramoodle-course-hidden');
      }
    }
  });

  const feedback = document.getElementById('ultramoodle-search-results-feedback');
  if (feedback) {
    feedback.textContent = `${matchCount} matière(s) trouvée(s)`;
  }
  toggleEmptyContainers();
  makeCardsFillRow();

  setTimeout(() => {
    window._ultramoodleFiltering = false;
  }, 100);
};

const showAllContainers = () => {
  const emptyContainers = document.querySelectorAll('.ultramoodle-container-hidden');
  emptyContainers.forEach(c => c.classList.remove('ultramoodle-container-hidden'));
};

const toggleEmptyContainers = () => {
  const decks = document.querySelectorAll('.dashboard-card-deck, .card-deck');
  decks.forEach(deck => {
    const totalCards = deck.querySelectorAll('.coc-course-box, .course-info-container, .card, [data-purpose="course-card"]');
    if (totalCards.length > 0) {
      const hiddenCards = deck.querySelectorAll('.ultramoodle-course-hidden');
      if (hiddenCards.length === totalCards.length) {
        deck.classList.add('ultramoodle-container-hidden');
      } else {
        deck.classList.remove('ultramoodle-container-hidden');
      }
    }
  });
};
