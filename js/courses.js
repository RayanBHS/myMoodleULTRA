// myMoodle ULTRA - Course Customizations, Indexing, Header, and Filters
let _customCourseImages = {};
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
  chrome.storage.local.get('custom_course_images', (res) => {
    if (res.custom_course_images) {
      _customCourseImages = res.custom_course_images;
    }
  });
}

// Listen to events dispatched by the main world interceptor script (js/interceptor.js)
window.addEventListener('ultramoodle-preview-click', (e) => {
  const { fileUrl, fileName, fileType, mode } = e.detail;
  if (window.openDocumentViewer) {
    window.openDocumentViewer(fileUrl, fileName, fileType, mode);
  } else {
    console.error('[myMoodle ULTRA] openDocumentViewer global function not loaded.');
  }
});

window.addEventListener('ultramoodle-download-click', (e) => {
  const { fileUrl, fileName } = e.detail;
  const a = document.createElement('a');
  a.href = fileUrl;
  a.download = fileName;
  a.click();
});

window.addEventListener('ultramoodle-toggle-click', (e) => {
  const { fileUrl, fileName, fileType } = e.detail;
  if (window.closeDocumentViewer) {
    window.closeDocumentViewer();
  }
  if (window.openDocumentViewer) {
    window.openDocumentViewer(fileUrl, fileName, fileType, 'office');
  }
});

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
  
  // Try extracting from script tags text content (critical when main DOM is cleared)
  const scripts = document.getElementsByTagName('script');
  for (let i = 0; i < scripts.length; i++) {
    const content = scripts[i].textContent || '';
    const m = content.match(/"sesskey"\s*:\s*"([^"]+)"/);
    if (m) return m[1];
  }
  
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

const injectBlockHeaders = () => {
  if (!isDashboard()) return;

  const blocks = document.querySelectorAll('.block, section[data-block]');
  blocks.forEach((block) => {
    // Find the title text from native Moodle header
    const headingEl = block.querySelector('h2, h3.card-title, h3, .block-title, [role="heading"]');
    let titleText = '';
    if (headingEl) {
      titleText = headingEl.textContent.trim();
    }

    // Map Moodle blocks to their custom names if not found or for normalization
    if (!titleText) {
      if (block.classList.contains('block_myoverview') || block.querySelector('[data-region="course-overview"]')) {
        titleText = "Les cours";
      } else if (block.classList.contains('block_recentlyaccessedcourses')) {
        titleText = "Cours récents";
      } else if (block.classList.contains('block_recentlyaccesseditems')) {
        titleText = "Activités récentes";
      } else if (block.classList.contains('block_timeline')) {
        titleText = "Chronologie";
      } else if (block.classList.contains('block_private_files')) {
        titleText = "Fichiers personnels";
      } else {
        return; // Skip blocks without title that we can't identify
      }
    }

    const lowerTitle = titleText.toLowerCase();
    if (lowerTitle.includes("vue d'ensemble des cours") || lowerTitle === "course overview") {
      titleText = "Les cours";
    } else if (block.classList.contains('block_recentlyaccesseditems') || lowerTitle.includes("activités") || lowerTitle.includes("éléments consultés") || lowerTitle.includes("recently accessed items")) {
      titleText = "Activités récentes";
    } else if (lowerTitle.includes("récemment") || lowerTitle.includes("recently accessed")) {
      titleText = "Cours récents";
    } else if (lowerTitle.includes("chronologie") || lowerTitle.includes("timeline")) {
      titleText = "Chronologie";
    } else if (lowerTitle.includes("fichiers personnels") || lowerTitle.includes("private files") || lowerTitle.includes("fichiers privés")) {
      titleText = "Fichiers personnels";
    }

    // Hide native headings only when NOT in edit mode
    const isEditing = document.body.classList.contains('editing');
    if (headingEl) {
      if (isEditing) {
        headingEl.style.removeProperty('display');
      } else {
        headingEl.style.setProperty('display', 'none', 'important');
      }
    }
    block.querySelectorAll('.card-title, h5.card-title, h3.card-title, h2.card-title').forEach(h => {
      // Don't hide our own title inside our custom header
      if (!h.closest('.ultramoodle-courses-header')) {
        if (isEditing) {
          h.style.removeProperty('display');
        } else {
          h.style.setProperty('display', 'none', 'important');
        }
      }
    });

    // Special configuration for course overview block
    const isOverview = block.classList.contains('block_myoverview') || block.querySelector('[data-region="course-overview"]');
    if (isOverview) {
      ensureCardLayoutSelected();
      if (!hasForcedAll) {
        ensureAllCoursesSelected();
        hasForcedAll = true;
      }
      const currentLayout = localStorage.getItem('ultramoodle-layout-pref') || 'grid';
      if (!block.classList.contains(`ultramoodle-view-${currentLayout}`)) {
        block.classList.remove('ultramoodle-view-grid', 'ultramoodle-view-list');
        block.classList.add(`ultramoodle-view-${currentLayout}`);
      }
    }

    // Detect if the block has filter/search controls
    let filterBar = null;
    if (isOverview) {
      const searchInput = block.querySelector('input[placeholder*="Rechercher"], input[placeholder*="Search"], input[type="search"], [data-region="search-input"] input');
      const filterSelector = block.querySelector('[data-region="filter-selector"]');
      filterBar = (searchInput ? searchInput.closest('.row, .bar, [data-region="filter-bar"], .justify-content-between') : null) ||
                  (filterSelector ? filterSelector.closest('.row, .bar, [data-region="filter-bar"], .justify-content-between') : null) ||
                  block.querySelector('[data-region="filter-bar"]') || 
                  block.querySelector('.bar');
    } else if (block.classList.contains('block_timeline') || block.querySelector('[data-region="timeline"]')) {
      const sortSelector = block.querySelector('[data-region="sorting-selector"]');
      const dateSelector = block.querySelector('[data-region="filter-selector"]');
      const searchSelector = block.querySelector('[data-region="search-input"]');
      filterBar = (sortSelector ? sortSelector.closest('.row, .bar, [data-region="filter-bar"], .d-flex, .justify-content-between') : null) ||
                  (dateSelector ? dateSelector.closest('.row, .bar, [data-region="filter-bar"], .d-flex, .justify-content-between') : null) ||
                  (searchSelector ? searchSelector.closest('.row, .bar, [data-region="filter-bar"], .d-flex, .justify-content-between') : null) ||
                  block.querySelector('[data-region="timeline"] .row, [data-region="timeline"] .bar');
    }

    // Force relative position and overflow visible on the block wrapper so the floating absolute popup works
    block.style.setProperty('position', 'relative', 'important');
    block.style.setProperty('overflow', 'visible', 'important');

    const contentContainer = block.querySelector('.card-body') || block.querySelector('.content') || block;
    contentContainer.style.setProperty('position', 'relative', 'important');
    contentContainer.style.setProperty('overflow', 'visible', 'important');

    // Handle existing header
    let existingHeader = block.querySelector('.ultramoodle-block-header');
    if (existingHeader) {
      if (filterBar && existingHeader.associatedFilterBar !== filterBar) {
        existingHeader.remove();
        existingHeader = null;
      } else {
        if (filterBar && !filterBar.classList.contains('ultramoodle-native-filter-bar')) {
          filterBar.classList.add('ultramoodle-native-filter-bar');
        }
        return;
      }
    }

    const header = document.createElement('div');
    header.className = 'ultramoodle-courses-header ultramoodle-block-header';
    header.associatedFilterBar = filterBar;

    const hasFilters = !!filterBar;

    header.innerHTML = `
      <span class="ultramoodle-courses-header-title">${titleText}</span>
      ${hasFilters ? `
      <div class="ultramoodle-filter-toggle-btn" title="Filtrer" style="cursor: pointer;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
        </svg>
      </div>
      ` : ''}
    `;

    contentContainer.insertBefore(header, contentContainer.firstChild);

    if (filterBar) {
      filterBar.classList.add('ultramoodle-native-filter-bar');

      // If this is the course overview, inject our custom layout selector inside the filter popup
      if (isOverview) {
        if (!filterBar.querySelector('#ultramoodle-custom-layout-selector')) {
          const currentLayout = localStorage.getItem('ultramoodle-layout-pref') || 'grid';
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

          const gridBtn = filterBar.querySelector('#ultramoodle-btn-layout-grid');
          const listBtn = filterBar.querySelector('#ultramoodle-btn-layout-list');

          if (gridBtn && listBtn) {
            gridBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              localStorage.setItem('ultramoodle-layout-pref', 'grid');
              gridBtn.classList.add('active');
              listBtn.classList.remove('active');
              const courseOverview = getCourseOverviewContainer();
              if (courseOverview) {
                courseOverview.classList.remove('ultramoodle-view-list');
                courseOverview.classList.add('ultramoodle-view-grid');
              }
              makeCardsFillRow();
              window.dispatchEvent(new Event('resize'));
            });

            listBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              localStorage.setItem('ultramoodle-layout-pref', 'list');
              listBtn.classList.add('active');
              gridBtn.classList.remove('active');
              const courseOverview = getCourseOverviewContainer();
              if (courseOverview) {
                courseOverview.classList.remove('ultramoodle-view-grid');
                courseOverview.classList.add('ultramoodle-view-list');
              }
              makeCardsFillRow();
              window.dispatchEvent(new Event('resize'));
            });
          }
        }
      }

      const toggleBtn = header.querySelector('.ultramoodle-filter-toggle-btn');
      if (toggleBtn) {
        toggleBtn.classList.remove('active');
        filterBar.classList.remove('ultramoodle-filter-bar-visible');

        const interactionEvents = ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend'];
        interactionEvents.forEach(evtName => {
          toggleBtn.addEventListener(evtName, (e) => {
            e.stopPropagation();
          });
        });

        toggleBtn.addEventListener('click', (e) => {
          e.preventDefault();
          filterBar.classList.toggle('ultramoodle-filter-bar-visible');
          toggleBtn.classList.toggle('active');
        });
      }
    }
  });
};;

const getCourseLinkEl = (card) => {
  if (card.tagName === 'A' && card.href && card.href.includes('/course/view.php?id=')) {
    return card;
  }
  return card.querySelector('a[href*="/course/view.php?id="]');
};

const buildCard = (card, apiCourse) => {
  let courseUrl = '';
  const linkEl = getCourseLinkEl(card);
  if (linkEl) {
    courseUrl = linkEl.href;
  } else if (apiCourse && apiCourse.viewurl) {
    courseUrl = apiCourse.viewurl;
  } else if (apiCourse && apiCourse.id) {
    courseUrl = `/course/view.php?id=${apiCourse.id}`;
  } else {
    return;
  }

  let fullname, subtitle, progress;

  if (apiCourse) {
    fullname  = apiCourse.fullname || '';
    subtitle  = apiCourse.coursecategory || '';
    progress  = apiCourse.hasprogress ? apiCourse.progress : null;
  } else {
    fullname  = getCourseTitle(card);
    subtitle  = getCardSubtitle(card);
    progress  = getCardProgress(card);
  }

  const semester = extractSemester(fullname);
  const cleanRegex = /^\s*\*?\s*([A-Z0-9]+(?:-[A-Z0-9]+)*)\s*(?:-|\u2013|\u2014)\s*/i;
  const codeMatch = fullname.match(cleanRegex);
  const courseCode = codeMatch ? codeMatch[1] : null;
  let cleanTitle = fullname.replace(cleanRegex, '').replace(/\s*\([^)]*\)\s*$/g, '').trim() || fullname;

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

  let courseId = null;
  const idMatch = courseUrl.match(/\/course\/view\.php\?id=(\d+)/);
  if (idMatch) {
    courseId = parseInt(idMatch[1]);
  } else if (apiCourse && apiCourse.id) {
    courseId = apiCourse.id;
  }

  const imageUrl = (courseId && _customCourseImages && _customCourseImages[courseId])
    ? _customCourseImages[courseId]
    : (apiCourse ? (apiCourse.courseimage || getCardImage(card)) : getCardImage(card));

  let isFavourite = false;
  if (apiCourse && apiCourse.isfavourite !== undefined) {
    isFavourite = !!apiCourse.isfavourite;
  } else if (courseId && _moodleCourseCache && _moodleCourseCache[courseId]) {
    isFavourite = !!_moodleCourseCache[courseId].isfavourite;
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

  if (courseId) {
    const starBtn = document.createElement('button');
    starBtn.type = 'button';
    starBtn.className = `ultramoodle-card-fav-btn${isFavourite ? ' is-favorite' : ''}`;
    starBtn.dataset.courseId = courseId;
    starBtn.title = isFavourite ? 'Retirer des favoris' : 'Ajouter aux favoris';
    starBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
      </svg>
    `;

    starBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const willBeFavorite = !starBtn.classList.contains('is-favorite');

      toggleMoodleCourseFavorite(courseId, willBeFavorite);

      // Update all star buttons on the page for this course
      const allStarBtns = document.querySelectorAll(`.ultramoodle-card-fav-btn[data-course-id="${courseId}"]`);
      allStarBtns.forEach(btn => {
        if (willBeFavorite) {
          btn.classList.add('is-favorite');
          btn.title = 'Retirer des favoris';
        } else {
          btn.classList.remove('is-favorite');
          btn.title = 'Ajouter aux favoris';
        }
      });

      // Refresh Starred Courses block
      setTimeout(() => {
        const starredBlock = document.querySelector('.block_starredcourses');
        if (starredBlock) {
          starredBlock.removeAttribute('data-ultramoodle-loading');
          const oldSlider = starredBlock.querySelector('.ultramoodle-starred-slider');
          if (oldSlider) oldSlider.remove();
          if (window.customizeStarredCourses) {
            window.customizeStarredCourses();
          }
        }
      }, 500);
    });

    const footer = card.querySelector('.ultramoodle-card-footer');
    if (footer) {
      footer.appendChild(starBtn);
    }
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

let _recentCoursesCache = null;
let _recentCoursesFetchPromise = null;

const fetchRecentCourses = () => {
  if (_recentCoursesCache) return Promise.resolve(_recentCoursesCache);
  if (_recentCoursesFetchPromise) return _recentCoursesFetchPromise;
  const sesskey = getMoodleSesskey();
  if (!sesskey) return Promise.resolve(null);
  
  _recentCoursesFetchPromise = fetch(
    `/lib/ajax/service.php?sesskey=${sesskey}&info=core_course_get_recent_courses`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        index: 0,
        methodname: 'core_course_get_recent_courses',
        args: { limit: 12 } // Retrieve up to 12 recently accessed courses
      }])
    }
  )
  .then(r => r.json())
  .then(data => {
    if (data?.[0]?.error === false && data[0].data) {
      _recentCoursesCache = data[0].data;
      return _recentCoursesCache;
    }
    return null;
  })
  .catch(() => null);
  return _recentCoursesFetchPromise;
};

const customizeRecentCourses = () => {
  const block = document.querySelector('.block_recentlyaccessedcourses');
  if (!block) return;

  // Check if our custom slider is already injected or currently loading
  if (block.querySelector('.ultramoodle-recent-slider') || block.dataset.ultramoodleLoading === 'true') {
    return; // Already customized or loading
  }

  block.dataset.ultramoodleLoading = 'true';

  // Find the contentArea to clear and inject our slider
  const contentArea = block.querySelector('.card-text.content') || block.querySelector('.card-body') || block;

  // Fetch both enrolled classifications and recent courses to merge data
  Promise.all([fetchMoodleCourses(), fetchRecentCourses()]).then(([enrolledData, recentCourses]) => {
    block.dataset.ultramoodleLoading = 'false';
    if (!recentCourses || recentCourses.length === 0) return;

    // Check again to avoid race conditions
    if (block.querySelector('.ultramoodle-recent-slider')) return;

    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'ultramoodle-recent-slider';

    // Prevent Moodle's native carousel delegation from intercepting slider interactions
    const stopEvents = ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend'];
    stopEvents.forEach(evtName => {
      sliderContainer.addEventListener(evtName, (e) => {
        // If click is on native dropdown menus/toggles, let it bubble so Bootstrap can open it.
        // Otherwise, stop propagation to isolate from Moodle native carousel scroll resets.
        if (e.target.closest('.dropdown, .dropdown-menu, .dropdown-toggle')) {
          return;
        }
        e.stopPropagation();
      }, { passive: true });
    });

    recentCourses.forEach(recentCourse => {
      // Find full classifications (progress, category) from enrolled courses cache
      const enrolledCourse = enrolledData ? enrolledData[recentCourse.id] : null;
      
      // Merge properties (category name, progress, startdate, image, etc.)
      const apiCourse = Object.assign({}, recentCourse, enrolledCourse);

      const customCard = document.createElement('div');
      customCard.className = 'card dashboard-card';
      
      // Append card to sliderContainer first so buildCard replacement parentNode check succeeds
      sliderContainer.appendChild(customCard);
      
      // Custom card build from merged data
      buildCard(customCard, apiCourse);
    });

    // Hide native Moodle elements instead of removing them, to prevent native scripts from crashing
    Array.from(contentArea.children).forEach(child => {
      if (!child.classList.contains('ultramoodle-block-header') && !child.classList.contains('ultramoodle-recent-slider')) {
        child.style.setProperty('display', 'none', 'important');
      }
    });
    if (!contentArea.querySelector('.ultramoodle-recent-slider')) {
      contentArea.appendChild(sliderContainer);
    }
  });
};

const customizeStarredCourses = () => {
  const block = document.querySelector('.block_starredcourses');
  if (!block) return;

  // Check if our custom slider is already injected or currently loading
  if (block.querySelector('.ultramoodle-starred-slider') || block.dataset.ultramoodleLoading === 'true') {
    return; // Already customized or loading
  }

  block.dataset.ultramoodleLoading = 'true';

  // Find the contentArea to clear and inject our slider
  const contentArea = block.querySelector('.card-text.content') || block.querySelector('.card-body') || block;

  // Fetch enrolled courses to filter starred ones
  fetchMoodleCourses().then(courseData => {
    block.dataset.ultramoodleLoading = 'false';
    if (!courseData) return;

    const starredCourses = Object.values(courseData).filter(course => course.isfavourite);
    if (starredCourses.length === 0) {
      return;
    }

    // Check again to avoid race conditions
    if (block.querySelector('.ultramoodle-starred-slider')) return;

    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'ultramoodle-starred-slider';

    // Prevent Moodle's native carousel delegation from intercepting slider interactions
    const stopEvents = ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend'];
    stopEvents.forEach(evtName => {
      sliderContainer.addEventListener(evtName, (e) => {
        if (e.target.closest('.dropdown, .dropdown-menu, .dropdown-toggle')) {
          return;
        }
        e.stopPropagation();
      }, { passive: true });
    });

    starredCourses.forEach(course => {
      const customCard = document.createElement('div');
      customCard.className = 'card dashboard-card';
      
      // Append card to sliderContainer first so buildCard replacement parentNode check succeeds
      sliderContainer.appendChild(customCard);
      
      // Custom card build
      buildCard(customCard, course);
    });

    // Hide native Moodle elements instead of removing them, to prevent native scripts from crashing
    Array.from(contentArea.children).forEach(child => {
      if (!child.classList.contains('ultramoodle-block-header') && !child.classList.contains('ultramoodle-starred-slider')) {
        child.style.setProperty('display', 'none', 'important');
      }
    });
    if (!contentArea.querySelector('.ultramoodle-starred-slider')) {
      contentArea.appendChild(sliderContainer);
    }
  }).catch(err => {
    console.error('[myMoodle ULTRA] Error customizing starred courses:', err);
    block.dataset.ultramoodleLoading = 'false';
  });
};

const extractIconSrc = (htmlString) => {
  if (!htmlString) return '';
  const match = htmlString.match(/src=["']([^"']+)["']/);
  return match ? match[1] : '';
};

const cleanCourseTitleText = (fullname) => {
  if (!fullname) return '';
  const cleanRegex = /^\s*\*?\s*([A-Za-z]{2,5}\d{3,4}(?:-[A-Za-z0-9]+)?)\s*(?:-|\u2013|\u2014)\s*/;
  const codeMatch = fullname.match(cleanRegex);
  const courseCode = codeMatch ? codeMatch[1] : null;
  let cleanTitle = fullname.replace(cleanRegex, '').replace(/\s*\(P\d[^)]*\)\s*$/g, '').trim() || fullname;
  return courseCode ? `${courseCode} - ${cleanTitle}` : cleanTitle;
};

let _recentItemsCache = null;
let _recentItemsFetchPromise = null;

const fetchRecentItems = () => {
  if (_recentItemsCache) return Promise.resolve(_recentItemsCache);
  if (_recentItemsFetchPromise) return _recentItemsFetchPromise;
  const sesskey = getMoodleSesskey();
  if (!sesskey) return Promise.resolve(null);
  
  _recentItemsFetchPromise = fetch(
    `/lib/ajax/service.php?sesskey=${sesskey}&info=block_recentlyaccesseditems_get_recent_items`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        index: 0,
        methodname: 'block_recentlyaccesseditems_get_recent_items',
        args: { limit: 9 }
      }])
    }
  )
  .then(r => r.json())
  .then(data => {
    if (data?.[0]?.error === false && data[0].data) {
      _recentItemsCache = data[0].data;
      return _recentItemsCache;
    }
    return null;
  })
  .catch(() => null);
  return _recentItemsFetchPromise;
};

const customizeRecentItems = () => {
  const block = document.querySelector('.block_recentlyaccesseditems');
  if (!block) return;

  // Check if our custom slider is already injected or currently loading
  if (block.querySelector('.ultramoodle-recent-items-slider') || block.dataset.ultramoodleLoading === 'true') {
    return; // Already customized or loading
  }

  block.dataset.ultramoodleLoading = 'true';

  // Find the contentArea to clear and inject our slider
  const contentArea = block.querySelector('.card-text.content') || block.querySelector('.card-body') || block;

  fetchRecentItems().then(recentItems => {
    block.dataset.ultramoodleLoading = 'false';
    if (!recentItems || recentItems.length === 0) return;

    // Check again to avoid race conditions
    if (block.querySelector('.ultramoodle-recent-items-slider')) return;

    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'ultramoodle-recent-items-slider';

    // Prevent Moodle's native carousel delegation from intercepting slider interactions
    const stopEvents = ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend'];
    stopEvents.forEach(evtName => {
      sliderContainer.addEventListener(evtName, (e) => {
        if (e.target.closest('.dropdown, .dropdown-menu, .dropdown-toggle')) {
          return;
        }
        e.stopPropagation();
      }, { passive: true });
    });

    recentItems.forEach(item => {
      const iconSrc = extractIconSrc(item.icon);
      const cleanedCourseName = cleanCourseTitleText(item.coursename);
      const cleanItemName = item.name.trim();

      const customCard = document.createElement('a');
      customCard.href = item.viewurl;
      customCard.className = 'ultramoodle-recent-item-card';
      
      let purposeClass = 'purpose-content';
      if (item.purpose === 'assessment') {
        purposeClass = 'purpose-assessment';
      } else if (item.purpose === 'collaboration') {
        purposeClass = 'purpose-collaboration';
      }

      customCard.innerHTML = `
        <div class="ultramoodle-recent-item-icon-wrapper ${purposeClass}">
          ${iconSrc ? `<img src="${iconSrc}" class="ultramoodle-recent-item-icon" alt="" />` : `<div class="ultramoodle-recent-item-icon-placeholder"></div>`}
        </div>
        <div class="ultramoodle-recent-item-details">
          <div class="ultramoodle-recent-item-name" title="${cleanItemName}">${cleanItemName}</div>
          <div class="ultramoodle-recent-item-course" title="${item.coursename}">${cleanedCourseName}</div>
        </div>
      `;

      sliderContainer.appendChild(customCard);
    });

    // Hide native Moodle elements instead of removing them, to prevent native scripts from crashing
    Array.from(contentArea.children).forEach(child => {
      if (!child.classList.contains('ultramoodle-block-header') && !child.classList.contains('ultramoodle-recent-items-slider')) {
        child.style.setProperty('display', 'none', 'important');
      }
    });
    if (!contentArea.querySelector('.ultramoodle-recent-items-slider')) {
      contentArea.appendChild(sliderContainer);
    }
  });
};

// Make card column wrappers fill row space evenly, with a min-width so they wrap properly
const makeCardsFillRow = () => {
  const currentLayout = localStorage.getItem('ultramoodle-layout-pref') || 'grid';
  const container = getCourseOverviewContainer();
  if (!container) return;

  const allCards = container.querySelectorAll('.ultramoodle-card-customized');

  allCards.forEach(card => {
    const parent = card.parentElement;
    if (!parent) return;

    const isWrapper = parent !== container && !parent.matches('[data-region], .dashboard-card-deck, .card-deck');
    const target = isWrapper ? parent : card;

    if (currentLayout !== 'grid') {
      target.style.removeProperty('flex');
      target.style.removeProperty('max-width');
      target.style.removeProperty('min-width');
    } else {
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
    }
  });
};

const showEmptyState = (container, show, type = 'search') => {
  let emptyEl = container.querySelector('.ultramoodle-empty-state');
  
  if (show) {
    if (!emptyEl) {
      emptyEl = document.createElement('div');
      emptyEl.className = 'ultramoodle-empty-state';
      
      const title = type === 'course' ? 'Aucune matière' : (type === 'timeline' ? 'Aucune tâche' : 'Aucun résultat');
      const desc = type === 'course' 
        ? "Aucune matière ne correspond à votre recherche." 
        : (type === 'timeline' ? "Aucune tâche à venir ne correspond." : "Aucun résultat trouvé.");
      
      emptyEl.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          <line x1="8" y1="11" x2="14" y2="11" stroke-dasharray="1.5"></line>
        </svg>
        <h4>${title}</h4>
        <p>${desc}</p>
      `;
      
      const appendTarget = container.querySelector('[data-region="course-content"], [data-region="event-list-content"], .card-body, .content') || container;
      appendTarget.appendChild(emptyEl);
    }
    emptyEl.classList.add('visible');
  } else {
    if (emptyEl) {
      emptyEl.classList.remove('visible');
    }
  }
};
window.showEmptyState = showEmptyState;

const normalizeText = (text) => {
  if (!text) return '';
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
};

const filterCourses = (query) => {
  window._ultramoodleFiltering = true;
  
  // Sync main search to Moodle's native timeline search
  const nativeTimelineSearch = document.querySelector('.block_timeline [data-region="search-input"] input, [data-region="timeline"] [data-region="search-input"] input');
  if (nativeTimelineSearch) {
    nativeTimelineSearch.value = query;
    nativeTimelineSearch.dispatchEvent(new Event('input', { bubbles: true }));
    nativeTimelineSearch.dispatchEvent(new Event('change', { bubbles: true }));
    nativeTimelineSearch.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  }

  // Locally filter custom timeline cards and headers
  if (window.filterTimeline) {
    window.filterTimeline(query);
  }

  const cards = getCourseCards();
  const cleanQuery = normalizeText(query);
  
  if (cleanQuery === '') {
    cards.forEach(card => {
      card.classList.remove('ultramoodle-course-hidden');
    });
    showAllContainers();
    makeCardsFillRow();

    // Show all blocks again
    const blocks = document.querySelectorAll('.block, section[data-block]');
    blocks.forEach(block => {
      block.classList.remove('ultramoodle-block-search-hidden');
    });

    // Hide empty state for courses
    const overviewBlock = getCourseOverviewContainer();
    if (overviewBlock) {
      showEmptyState(overviewBlock, false);
      const pagingControls = overviewBlock.querySelectorAll('[data-region="paging-control-limit"], [data-region="paging-control-container"], .paging-bar, .pagination');
      pagingControls.forEach(ctrl => {
        ctrl.style.removeProperty('display');
      });
    }

    const feedback = document.getElementById('ultramoodle-search-results-feedback');
    if (feedback) {
      feedback.textContent = '';
    }
    setTimeout(() => {
      window._ultramoodleFiltering = false;
    }, 100);
    return;
  }

  // Hide all right blocks except timeline
  const blocks = document.querySelectorAll('.block, section[data-block]');
  blocks.forEach(block => {
    const isTimeline = block.classList.contains('block_timeline') || block.querySelector('[data-region="timeline"]');
    const isOverview = block.classList.contains('block_myoverview') || block.querySelector('[data-region="course-overview"]');
    if (!isTimeline && !isOverview) {
      block.classList.add('ultramoodle-block-search-hidden');
    } else {
      block.classList.remove('ultramoodle-block-search-hidden');
    }
  });

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

  // Show or hide empty state for courses
  const overviewBlock = getCourseOverviewContainer();
  if (overviewBlock) {
    showEmptyState(overviewBlock, matchCount === 0, 'course');
    const pagingControls = overviewBlock.querySelectorAll('[data-region="paging-control-limit"], [data-region="paging-control-container"], .paging-bar, .pagination');
    pagingControls.forEach(ctrl => {
      ctrl.style.setProperty('display', matchCount === 0 ? 'none' : '', 'important');
    });
  }

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

const cleanDropdownCheckmarks = () => {
  const items = document.querySelectorAll('.ultramoodle-native-filter-bar .dropdown-menu a, .ultramoodle-native-filter-bar .dropdown-menu .dropdown-item');
  items.forEach(item => {
    // Check if checkmark icon is already injected
    if (item.querySelector('.ultramoodle-check-icon') || item.querySelector('.ultramoodle-check-spacer')) {
      return;
    }
    
    let text = item.textContent.trim();
    // Remove existing checkmarks in text content if any
    if (text.startsWith('✓')) {
      const cleanText = text.substring(1).trim();
      item.innerHTML = `<span class="ultramoodle-check-icon">✓</span>${cleanText}`;
    } else {
      item.innerHTML = `<span class="ultramoodle-check-spacer"></span>${text}`;
    }
  });
};

const isCoursePage = () => {
  return window.location.pathname.includes('/course/view.php');
};

const getCourseIdFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
};

let _coursePageHeaderLoading = false;

const findNativeFavoriteBtn = () => {
  // 1. Direct standard selectors first (most specific)
  const primarySelectors = [
    '.course-toggle-favorite',
    '[data-action="toggle-course-favorite"]',
    'a[href*="togglefavorite"]'
  ];
  for (const selector of primarySelectors) {
    const el = document.querySelector(selector);
    if (el && !el.closest('#ultramoodle-course-page-header')) {
      return el;
    }
  }

  // 2. Search a bit broader but with strict exclusion rules
  const elements = document.querySelectorAll('a, button, [role="button"], .btn');
  for (const el of elements) {
    if (el.closest('#ultramoodle-course-page-header')) continue;
    
    // Strict exclusions to avoid matching navigation menu links, sidebars, or dashboards
    const href = el.getAttribute('href') || '';
    if (href && !href.startsWith('#') && !href.startsWith('javascript') && !href.includes('course/view.php') && !href.includes('togglefavorite')) {
      // If it navigates to other pages (like /my/, /course/index.php, etc.), it's not our button
      continue;
    }

    // Exclude links that have text content containing navigation keywords
    const text = (el.textContent || '').toLowerCase();
    if (text.includes('mes cours') || text.includes('tableau de bord') || text.includes('accueil') || text.includes('dashboard') || text.includes('mon moodle')) {
      continue;
    }
    
    const title = (el.getAttribute('title') || '').toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    const dataTitle = (el.getAttribute('data-original-title') || '').toLowerCase();
    
    const hasFavoriteKeyword = title.includes('favori') || title.includes('star') || title.includes('étoile') ||
                               ariaLabel.includes('favori') || ariaLabel.includes('star') || ariaLabel.includes('étoile') ||
                               dataTitle.includes('favori') || dataTitle.includes('star') || dataTitle.includes('étoile');
                               
    if (hasFavoriteKeyword) {
      return el;
    }
  }

  // 3. Search by star icon inside the element
  for (const el of elements) {
    if (el.closest('#ultramoodle-course-page-header')) continue;
    
    const href = el.getAttribute('href') || '';
    if (href && !href.startsWith('#') && !href.startsWith('javascript') && !href.includes('course/view.php') && !href.includes('togglefavorite')) {
      continue;
    }
    
    const text = (el.textContent || '').toLowerCase();
    if (text.includes('mes cours') || text.includes('tableau de bord') || text.includes('accueil') || text.includes('dashboard') || text.includes('mon moodle')) {
      continue;
    }

    if (el.querySelector('.fa-star, .star, svg.star-icon, [class*="star"]')) {
      const title = (el.getAttribute('title') || '').toLowerCase();
      if (text.includes('favori') || text.includes('star') || text.includes('marquer') || text.includes('étoile') || 
          (title && (title.includes('favori') || title.includes('star') || title.includes('étoile') || title.includes('marquer'))) || 
          el.classList.contains('btn-icon') || el.classList.contains('btn-secondary')) {
        return el;
      }
    }
  }
  
  return null;
};

const findAllNativeFavoriteBtns = () => {
  const list = [];
  const primarySelectors = [
    '.course-toggle-favorite',
    '[data-action="toggle-course-favorite"]',
    'a[href*="togglefavorite"]'
  ];
  primarySelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      if (!el.closest('#ultramoodle-course-page-header') && !list.includes(el)) {
        list.push(el);
      }
    });
  });
  
  const elements = document.querySelectorAll('a, button, [role="button"], .btn');
  elements.forEach(el => {
    if (el.closest('#ultramoodle-course-page-header')) return;
    if (list.includes(el)) return;
    
    const href = el.getAttribute('href') || '';
    if (href && !href.startsWith('#') && !href.startsWith('javascript') && !href.includes('course/view.php') && !href.includes('togglefavorite')) {
      return;
    }
    
    const text = (el.textContent || '').toLowerCase();
    if (text.includes('mes cours') || text.includes('tableau de bord') || text.includes('accueil') || text.includes('dashboard') || text.includes('mon moodle')) {
      return;
    }
    
    const title = (el.getAttribute('title') || '').toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    const dataTitle = (el.getAttribute('data-original-title') || '').toLowerCase();
    
    const hasFavoriteKeyword = title.includes('favori') || title.includes('star') || title.includes('étoile') ||
                               ariaLabel.includes('favori') || ariaLabel.includes('star') || ariaLabel.includes('étoile') ||
                               dataTitle.includes('favori') || dataTitle.includes('star') || dataTitle.includes('étoile');
                               
    if (hasFavoriteKeyword) {
      list.push(el);
    }
  });
  return list;
};

const setNativeFavoriteBtnState = (starBtn, isStarred) => {
  if (!starBtn) return;
  
  if (isStarred) {
    starBtn.classList.add('starred', 'active');
    starBtn.setAttribute('aria-pressed', 'true');
    starBtn.setAttribute('data-favorite', '1');
    starBtn.setAttribute('data-value', 'true');
    const icon = starBtn.querySelector('.fa, .fas, .far, .fa-star, .fa-star-o');
    if (icon) {
      icon.classList.remove('fa-star-o');
      icon.classList.add('fa-star');
    }
  } else {
    starBtn.classList.remove('starred', 'active');
    starBtn.setAttribute('aria-pressed', 'false');
    starBtn.setAttribute('data-favorite', '0');
    starBtn.setAttribute('data-value', 'false');
    const icon = starBtn.querySelector('.fa, .fas, .far, .fa-star, .fa-star-o');
    if (icon) {
      icon.classList.remove('fa-star');
      icon.classList.add('fa-star-o');
    }
  }
};

const hideNativeFavoriteBtns = () => {
  const primarySelectors = [
    '.course-toggle-favorite',
    '[data-action="toggle-course-favorite"]',
    'a[href*="togglefavorite"]'
  ];
  primarySelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      if (!el.closest('#ultramoodle-course-page-header')) {
        hideElement(el);
      }
    });
  });
  
  const elements = document.querySelectorAll('a, button, [role="button"], .btn');
  elements.forEach(el => {
    if (el.closest('#ultramoodle-course-page-header')) return;
    
    const href = el.getAttribute('href') || '';
    if (href && !href.startsWith('#') && !href.startsWith('javascript') && !href.includes('course/view.php') && !href.includes('togglefavorite')) {
      return;
    }
    
    const text = (el.textContent || '').toLowerCase();
    if (text.includes('mes cours') || text.includes('tableau de bord') || text.includes('accueil') || text.includes('dashboard') || text.includes('mon moodle')) {
      return;
    }
    
    const title = (el.getAttribute('title') || '').toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    const dataTitle = (el.getAttribute('data-original-title') || '').toLowerCase();
    
    const hasFavoriteKeyword = title.includes('favori') || title.includes('star') || title.includes('étoile') ||
                               ariaLabel.includes('favori') || ariaLabel.includes('star') || ariaLabel.includes('étoile') ||
                               dataTitle.includes('favori') || dataTitle.includes('star') || dataTitle.includes('étoile');
                               
    if (hasFavoriteKeyword) {
      hideElement(el);
    }
  });
};

const toggleMoodleCourseFavorite = (courseId, isFavorite) => {
  const sesskey = getMoodleSesskey();
  if (!sesskey || !courseId) return;
  
  fetch(
    `/lib/ajax/service.php?sesskey=${sesskey}&info=core_course_set_favourite_courses`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        index: 0,
        methodname: 'core_course_set_favourite_courses',
        args: {
          courses: [{
            id: parseInt(courseId),
            favourite: isFavorite
          }]
        }
      }])
    }
  )
  .then(r => r.json())
  .then(data => {
    console.log('[myMoodle ULTRA] toggleMoodleCourseFavorite response:', data);
    // Update cache
    if (_moodleCourseCache && _moodleCourseCache[courseId]) {
      _moodleCourseCache[courseId].isfavourite = isFavorite;
    }
  })
  .catch(err => {
    console.error('[myMoodle ULTRA] Error toggling course favorite:', err);
  });
};

const hideElement = (el) => {
  if (el) {
    el.style.setProperty('display', 'none', 'important');
    const parentLi = el.closest('li, .nav-item');
    if (parentLi) parentLi.style.setProperty('display', 'none', 'important');
  }
};

const findNativeHistoryBtn = () => {
  // Trouver l'icône d'historique en excluant notre propre menu personnalisé
  const clockIcon = document.querySelector('.fa-history, .fa-clock, .fa-undo, [class*="history"], [class*="clock"]');
  if (clockIcon && !clockIcon.closest('#ultramoodle-course-page-header')) {
    return clockIcon.closest('a, button, .btn') || clockIcon.parentElement;
  }
  const clockBtn = document.querySelector('a[href*="resetpage=1"], a[href*="history"], a[href*="log"], .course-history');
  if (clockBtn && !clockBtn.closest('#ultramoodle-course-page-header')) {
    return clockBtn;
  }
  return null;
};

const showEditImageModal = (courseId, apiCourse = null) => {
  const currentImageUrl = (courseId && _customCourseImages && _customCourseImages[courseId])
    ? _customCourseImages[courseId]
    : (apiCourse ? (apiCourse.courseimage || "") : "");
    
  const nativeImageUrl = (apiCourse && apiCourse.courseimage) ? apiCourse.courseimage : "";
  let selectedImageUrl = currentImageUrl;

  const modalBackdrop = document.createElement('div');
  modalBackdrop.className = 'ultramoodle-modal-backdrop';
  
  modalBackdrop.innerHTML = `
    <div class="ultramoodle-modal-content">
      <div class="ultramoodle-modal-header">
        <h3>Modifier l'image du cours</h3>
        <button class="ultramoodle-modal-close" aria-label="Fermer">&times;</button>
      </div>
      <div class="ultramoodle-modal-body">
        <div class="ultramoodle-modal-preview-container">
          <img class="ultramoodle-modal-preview" src="${selectedImageUrl || ''}" style="${selectedImageUrl ? '' : 'display:none;'}">
          <div class="ultramoodle-modal-preview-placeholder" style="${selectedImageUrl ? 'display:none;' : ''}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span>Aucune image sélectionnée</span>
          </div>
        </div>
        
        <div class="ultramoodle-modal-form-group">
          <label for="ultramoodle-modal-input-url">URL de l'image</label>
          <div class="ultramoodle-modal-input-row">
            <input type="text" id="ultramoodle-modal-input-url" placeholder="https://exemple.com/image.png" value="${selectedImageUrl && !selectedImageUrl.startsWith('data:') ? selectedImageUrl : ''}">
          </div>
        </div>
        
        <div class="ultramoodle-modal-divider">
          <span>OU</span>
        </div>
        
        <div class="ultramoodle-modal-form-group">
          <span class="ultramoodle-modal-label">Importer un fichier</span>
          <label for="ultramoodle-modal-input-file" class="ultramoodle-modal-file-label">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <span class="file-label-text">Choisir une image...</span>
          </label>
          <input type="file" id="ultramoodle-modal-input-file" accept="image/*" style="display: none;">
          <div class="ultramoodle-modal-file-info" style="display: none;"></div>
        </div>
      </div>
      <div class="ultramoodle-modal-footer">
        <button class="ultramoodle-modal-btn btn-reset" title="Restaurer l'image par défaut de Moodle">Réinitialiser</button>
        <div style="display: flex; gap: 10px;">
          <button class="ultramoodle-modal-btn btn-cancel">Annuler</button>
          <button class="ultramoodle-modal-btn btn-save">Enregistrer</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalBackdrop);

  const urlInput = modalBackdrop.querySelector('#ultramoodle-modal-input-url');
  const fileInput = modalBackdrop.querySelector('#ultramoodle-modal-input-file');
  const fileInfo = modalBackdrop.querySelector('.ultramoodle-modal-file-info');
  const fileLabelText = modalBackdrop.querySelector('.file-label-text');
  const previewImg = modalBackdrop.querySelector('.ultramoodle-modal-preview');
  const previewPlaceholder = modalBackdrop.querySelector('.ultramoodle-modal-preview-placeholder');

  const updatePreview = () => {
    if (selectedImageUrl) {
      previewImg.src = selectedImageUrl;
      previewImg.style.display = 'block';
      previewImg.style.opacity = '1';
      previewPlaceholder.style.display = 'none';
    } else {
      previewImg.style.display = 'none';
      previewPlaceholder.style.display = 'flex';
    }
  };

  const closeModal = () => {
    modalBackdrop.classList.add('closing');
    modalBackdrop.addEventListener('animationend', () => {
      modalBackdrop.remove();
    }, { once: true });
    document.removeEventListener('keydown', handleKeyDown);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  modalBackdrop.querySelector('.ultramoodle-modal-close').addEventListener('click', closeModal);
  modalBackdrop.querySelector('.btn-cancel').addEventListener('click', closeModal);
  
  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) {
      closeModal();
    }
  });

  urlInput.addEventListener('input', () => {
    const val = urlInput.value.trim();
    selectedImageUrl = val;
    fileInput.value = '';
    fileInfo.style.display = 'none';
    fileInfo.textContent = '';
    fileLabelText.textContent = 'Choisir une image...';
    updatePreview();
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert("Veuillez sélectionner un fichier image valide.");
        return;
      }
      
      fileInfo.textContent = file.name;
      fileInfo.style.display = 'block';
      fileLabelText.textContent = 'Changer d\'image...';
      
      const reader = new FileReader();
      reader.onload = (e) => {
        selectedImageUrl = e.target.result;
        urlInput.value = '';
        updatePreview();
      };
      reader.readAsDataURL(file);
    }
  });

  modalBackdrop.querySelector('.btn-reset').addEventListener('click', () => {
    selectedImageUrl = nativeImageUrl;
    urlInput.value = '';
    fileInput.value = '';
    fileInfo.style.display = 'none';
    fileInfo.textContent = '';
    fileLabelText.textContent = 'Choisir une image...';
    updatePreview();
  });

  modalBackdrop.querySelector('.btn-save').addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get('custom_course_images', (res) => {
        const images = res.custom_course_images || {};
        
        if (!selectedImageUrl || selectedImageUrl === nativeImageUrl) {
          delete images[courseId];
        } else {
          images[courseId] = selectedImageUrl;
        }
        
        chrome.storage.local.set({ custom_course_images: images }, () => {
          _customCourseImages = images;
          
          const headerImgContainer = document.querySelector('.ultramoodle-course-page-image-container');
          if (headerImgContainer) {
            let img = headerImgContainer.querySelector('.ultramoodle-course-page-image');
            const displayUrl = selectedImageUrl || nativeImageUrl;
            if (displayUrl) {
              if (img) {
                img.src = displayUrl;
              } else {
                img = document.createElement('img');
                img.className = 'ultramoodle-course-page-image';
                img.alt = '';
                img.src = displayUrl;
                headerImgContainer.insertBefore(img, headerImgContainer.firstChild);
              }
            } else {
              if (img) {
                img.remove();
              }
            }
          }
          
          closeModal();
        });
      });
    } else {
      closeModal();
    }
  });
};

const bindCoursePageActions = (apiCourse = null) => {
  console.log('[myMoodle ULTRA] bindCoursePageActions: Called! apiCourse =', !!apiCourse);
  const actionsContainer = document.getElementById('ultramoodle-course-header-buttons');
  console.log('[myMoodle ULTRA] bindCoursePageActions: actionsContainer found =', !!actionsContainer);
  if (!actionsContainer) return;
  
  const courseId = getCourseIdFromUrl();
  if (!apiCourse && courseId && _moodleCourseCache) {
    apiCourse = _moodleCourseCache[courseId];
  }
  
  // Tenter de trouver le bouton natif
  const starBtn = findNativeFavoriteBtn();
  console.log('[myMoodle ULTRA] bindCoursePageActions: starBtn found =', !!starBtn, ', apiCourse =', !!apiCourse);
  
  // Masquer les boutons natifs de favori et d'historique
  hideNativeFavoriteBtns();
  const clockBtn = findNativeHistoryBtn();
  if (clockBtn) {
    hideElement(clockBtn);
  }

  // Vérifier si NOS boutons customisés sont déjà physiquement dans le DOM
  const hasCustomHistory = !!actionsContainer.querySelector('#ultramoodle-course-btn-history');
  const hasCustomFavorite = !!actionsContainer.querySelector('#ultramoodle-course-btn-favorite');
  const hasCustomEdit = !!actionsContainer.querySelector('#ultramoodle-course-btn-edit-image');
  console.log('[myMoodle ULTRA] bindCoursePageActions: hasCustomHistory =', hasCustomHistory, ', hasCustomFavorite =', hasCustomFavorite, ', hasCustomEdit =', hasCustomEdit);
  
  // Déterminer l'état initial actif du favori
  let isStarred = false;
  if (starBtn) {
    const icon = starBtn.querySelector('.fa-star');
    const isStarredClass = starBtn.classList.contains('starred') || starBtn.classList.contains('active') || starBtn.getAttribute('aria-pressed') === 'true';
    isStarred = !!icon || isStarredClass;
  } else if (apiCourse) {
    isStarred = !!apiCourse.isfavourite;
  }

  if (hasCustomHistory && hasCustomFavorite && hasCustomEdit) {
    // Les boutons existent déjà, on met juste à jour l'état actif du favori
    const favBtn = actionsContainer.querySelector('#ultramoodle-course-btn-favorite');
    if (favBtn) {
      if (isStarred) {
        favBtn.classList.add('active');
      } else {
        favBtn.classList.remove('active');
      }
      console.log('[myMoodle ULTRA] bindCoursePageActions: Buttons already exist in DOM. Synced active state:', isStarred);
    }
  } else {
    console.log('[myMoodle ULTRA] bindCoursePageActions: Injecting buttons into actions container!');
    // Injection forcée du HTML des boutons si absents
    actionsContainer.innerHTML = `
      <button id="ultramoodle-course-btn-favorite" class="ultramoodle-course-header-btn ${isStarred ? 'active' : ''}" title="Ajouter aux favoris">
        <svg class="star-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
      </button>
      <button id="ultramoodle-course-btn-history" class="ultramoodle-course-header-btn" title="Historique">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
          <polyline points="3 3 3 8 8 8"></polyline>
          <line x1="12" y1="7" x2="12" y2="12"></line>
          <line x1="12" y1="12" x2="16" y2="14"></line>
        </svg>
      </button>
      <button id="ultramoodle-course-btn-edit-image" class="ultramoodle-course-header-btn" title="Modifier l'image du cours">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>
    `;

    // Événement Historique
    const customHistoryBtn = actionsContainer.querySelector('#ultramoodle-course-btn-history');
    if (customHistoryBtn) {
      let dropdown = actionsContainer.querySelector('#ultramoodle-recent-menu');
      if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'ultramoodle-recent-menu';
        dropdown.className = 'ultramoodle-recent-menu';
        actionsContainer.appendChild(dropdown);
      }

      customHistoryBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isVisible = dropdown.classList.contains('visible');
        document.querySelectorAll('.ultramoodle-recent-menu').forEach(d => d.classList.remove('visible'));
        
        if (!isVisible) {
          dropdown.innerHTML = `
            <div class="ultramoodle-recent-menu-header">Matières récentes</div>
            <div class="ultramoodle-recent-loading" style="padding: 12px 16px; text-align: center; color: var(--ultra-text-sub); font-size: 12px;">Chargement...</div>
          `;
          dropdown.classList.add('visible');
          
          fetchRecentCourses().then(recentCourses => {
            if (!recentCourses || recentCourses.length === 0) {
              dropdown.innerHTML = `<div class="ultramoodle-recent-menu-header">Matières récentes</div><div style="padding: 12px 16px; text-align: center; color: var(--ultra-text-sub); font-size: 12px;">Aucun historique</div>`;
              return;
            }
            let listHtml = '';
            recentCourses.forEach(course => {
              const courseFullname = course.fullname || '';
              const semester = extractSemester(courseFullname);
              const cleanRegex = /^\s*\*?\s*([A-Z0-9]+(?:-[A-Z0-9]+)*)\s*(?:-|\u2013|\u2014)\s*/i;
              const codeMatch = courseFullname.match(cleanRegex);
              const courseCode = codeMatch ? codeMatch[1] : null;
              const cleanTitle = courseFullname.replace(cleanRegex, '').replace(/\s*\([^)]*\)\s*$/g, '').trim() || courseFullname;
              
              listHtml += `
                <a href="/course/view.php?id=${course.id}" class="ultramoodle-recent-item">
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    ${courseCode ? `<span class="ultramoodle-recent-item-code">${courseCode}</span>` : ''}
                    ${semester !== null ? `<span style="font-size: 9px; color: var(--ultra-text-sub); font-weight: 500;">Semestre ${semester}</span>` : ''}
                  </div>
                  <div class="ultramoodle-recent-item-title" title="${courseFullname}">${cleanTitle}</div>
                </a>`;
            });
            
            dropdown.innerHTML = `
              <div class="ultramoodle-recent-menu-header">Matières récentes</div>
              <div class="ultramoodle-recent-menu-list" style="display: flex; flex-direction: column; gap: 2px; max-height: 250px; overflow-y: auto; padding: 0 4px;">${listHtml}</div>
              <a href="https://moodle.myefrei.fr/my/" class="ultramoodle-recent-menu-footer">Afficher tous les cours</a>`;
          }).catch(() => {
            dropdown.innerHTML = `<div class="ultramoodle-recent-menu-header">Matières récentes</div><div style="padding: 12px 16px; text-align: center; color: var(--ultra-text-sub); font-size: 12px;">Erreur de chargement</div>`;
          });
        }
      });
    }

    // Événement Favori
    const customFavoriteBtn = actionsContainer.querySelector('#ultramoodle-course-btn-favorite');
    if (customFavoriteBtn) {
      customFavoriteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const willBeFavorite = !customFavoriteBtn.classList.contains('active');
        customFavoriteBtn.classList.toggle('active', willBeFavorite);
        
        // 1. Mettre à jour le cache local immédiatement
        if (_moodleCourseCache && _moodleCourseCache[courseId]) {
          _moodleCourseCache[courseId].isfavourite = willBeFavorite;
        }
        
        // 2. Mettre à jour l'état du/des bouton(s) natif(s) dans le DOM pour la persistance locale
        const nativeBtns = findAllNativeFavoriteBtns();
        nativeBtns.forEach(btn => {
          setNativeFavoriteBtnState(btn, willBeFavorite);
        });
        
        // 3. Appeler l'API AJAX Moodle directement pour forcer le bon état sur le serveur
        toggleMoodleCourseFavorite(courseId, willBeFavorite);
      });
    }

    // Événement Modifier l'image
    const customEditBtn = actionsContainer.querySelector('#ultramoodle-course-btn-edit-image');
    if (customEditBtn) {
      customEditBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showEditImageModal(courseId, apiCourse);
      });
    }
  }

  // Tenter de trouver et masquer le bouton natif asynchrone après 200ms si absent initialement
  setTimeout(() => {
    hideNativeFavoriteBtns();
    const lateStarBtn = findNativeFavoriteBtn();
    if (lateStarBtn) {
      // Synchroniser à nouveau l'état
      const favBtn = actionsContainer.querySelector('#ultramoodle-course-btn-favorite');
      if (favBtn) {
        const icon = lateStarBtn.querySelector('.fa-star');
        const isStarredClass = lateStarBtn.classList.contains('starred') || lateStarBtn.classList.contains('active') || lateStarBtn.getAttribute('aria-pressed') === 'true';
        const lateIsStarred = !!icon || isStarredClass;
        if (lateIsStarred) {
          favBtn.classList.add('active');
        } else {
          favBtn.classList.remove('active');
        }
      }
    }
  }, 200);
  
  // Debug computed styles to find why it is invisible
  const favBtn = actionsContainer.querySelector('#ultramoodle-course-btn-favorite');
  if (favBtn) {
    const style = window.getComputedStyle(favBtn);
    const containerStyle = window.getComputedStyle(actionsContainer);
    console.log('[myMoodle ULTRA] debug styles: container display =', containerStyle.display, ', container width =', containerStyle.width, ', container height =', containerStyle.height, ', button display =', style.display, ', button visibility =', style.visibility, ', button width =', style.width, ', button height =', style.height, ', button opacity =', style.opacity);
  }
};



const customizeCoursePageHeader = () => {
  console.log('[myMoodle ULTRA] customizeCoursePageHeader: Running...');
  if (!isCoursePage()) {
    console.log('[myMoodle ULTRA] customizeCoursePageHeader: Not a course page, exiting.');
    return;
  }
  
  const mainInner = document.querySelector('.main-inner') || document.getElementById('region-main-box') || document.getElementById('page-content');
  if (!mainInner) {
    console.warn('[myMoodle ULTRA] customizeCoursePageHeader: mainInner not found!');
    return;
  }
  
  let customHeader = document.getElementById('ultramoodle-course-page-header');
  const isHeaderConnected = customHeader && document.body.contains(customHeader);
  const courseId = getCourseIdFromUrl();
  if (!courseId) {
    console.warn('[myMoodle ULTRA] customizeCoursePageHeader: courseId not found in URL!');
    return;
  }

  const buildOrUpdateHeader = (apiCourse = null) => {
    const existingHeader = document.getElementById('ultramoodle-course-page-header');
    
    // Try to find native Moodle course title first as fallback
    const pageHeader = document.getElementById('page-header');
    let fullname = '';
    if (pageHeader) {
      const nativeHeading = pageHeader.querySelector('h1, h2, .page-header-headings h1');
      if (nativeHeading) {
        fullname = getCleanText(nativeHeading);
      }
    }
    
    let category = '';
    if (apiCourse) {
      if (apiCourse.fullname) fullname = apiCourse.fullname;
      category = apiCourse.coursecategory || '';
    }
    
    const semester = extractSemester(fullname);
    const cleanRegex = /^\s*\*?\s*([A-Z0-9]+(?:-[A-Z0-9]+)*)\s*(?:-|\u2013|\u2014)\s*/i;
    const codeMatch = fullname.match(cleanRegex);
    const courseCode = codeMatch ? codeMatch[1] : null;
    const cleanTitle = fullname.replace(cleanRegex, '').replace(/\s*\([^)]*\)\s*$/g, '').trim() || fullname;

    let imageUrl = '';
    if (courseId && _customCourseImages && _customCourseImages[courseId]) {
      imageUrl = _customCourseImages[courseId];
    } else if (apiCourse) {
      imageUrl = apiCourse.courseimage || '';
    }

    // Hide native title elements inside Moodle's header
    if (pageHeader) {
      const nativeHeading = pageHeader.querySelector('h1, h2, .page-header-headings h1');
      if (nativeHeading) {
        nativeHeading.style.setProperty('display', 'none', 'important');
      }
      const headingWrapper = pageHeader.querySelector('.page-header-headings');
      if (headingWrapper) {
        headingWrapper.style.setProperty('display', 'none', 'important');
      }
      const contextHeader = pageHeader.querySelector('.page-context-header');
      if (contextHeader) {
        contextHeader.style.setProperty('display', 'none', 'important');
      }
    }

    if (existingHeader) {
      // Update existing elements dynamically to avoid unnecessary full redraw
      const imgContainer = existingHeader.querySelector('.ultramoodle-course-page-image-container');
      if (imgContainer) {
        let img = imgContainer.querySelector('.ultramoodle-course-page-image');
        if (imageUrl) {
          if (img) {
            if (img.src !== imageUrl) img.src = imageUrl;
          } else {
            img = document.createElement('img');
            img.className = 'ultramoodle-course-page-image';
            img.alt = '';
            img.src = imageUrl;
            imgContainer.insertBefore(img, imgContainer.firstChild);
          }
          imgContainer.classList.remove('skeleton-pulse');
        } else if (!apiCourse) {
          imgContainer.classList.add('skeleton-pulse');
        } else {
          if (img) img.remove();
          imgContainer.classList.remove('skeleton-pulse');
        }
      }

      const titleEl = existingHeader.querySelector('.ultramoodle-course-page-title');
      if (titleEl && titleEl.textContent !== cleanTitle) {
        titleEl.textContent = cleanTitle;
        titleEl.title = fullname;
      }

      const metaContainer = existingHeader.querySelector('.ultramoodle-course-page-meta');
      if (metaContainer) {
        metaContainer.innerHTML = `
          ${courseCode ? `<span class="ultramoodle-course-page-code">${courseCode}</span>` : ''}
          ${semester !== null ? `<span class="ultramoodle-course-page-semester">Semestre ${semester}</span>` : ''}
        `;
      }

      const subtitleEl = existingHeader.querySelector('.ultramoodle-course-page-subtitle');
      if (subtitleEl) {
        if (category) {
          subtitleEl.textContent = category;
          subtitleEl.title = category;
          subtitleEl.style.display = '';
        } else {
          subtitleEl.style.display = 'none';
        }
      }

      bindCoursePageActions(apiCourse);
      return existingHeader;
    }

    // Creating header for the first time
    const header = document.createElement('div');
    header.id = 'ultramoodle-course-page-header';
    header.className = 'ultramoodle-course-page-header';
    
    header.innerHTML = `
      <div class="ultramoodle-course-page-image-container ${!imageUrl && !apiCourse ? 'skeleton-pulse' : ''}">
        ${imageUrl ? `<img src="${imageUrl}" class="ultramoodle-course-page-image" alt="" />` : ''}
        <div class="ultramoodle-course-page-image-placeholder"></div>
      </div>
      <div class="ultramoodle-course-page-info">
        <div class="ultramoodle-course-page-title-group">
          <div class="ultramoodle-course-page-meta">
            ${courseCode ? `<span class="ultramoodle-course-page-code">${courseCode}</span>` : ''}
            ${semester !== null ? `<span class="ultramoodle-course-page-semester">Semestre ${semester}</span>` : ''}
          </div>
          <h1 class="ultramoodle-course-page-title" title="${fullname}">${cleanTitle}</h1>
        </div>
        <div class="ultramoodle-course-page-subtitle" title="${category}" style="${category ? '' : 'display:none;'}">${category}</div>
      </div>
      <div class="ultramoodle-course-header-buttons" id="ultramoodle-course-header-buttons"></div>
    `;

    // Inject above main-inner
    mainInner.parentNode.insertBefore(header, mainInner);

    if (window.ResizeObserver) {
      const observer = new ResizeObserver(() => {
        if (header && mainInner) {
          header.style.setProperty('max-width', `${mainInner.offsetWidth}px`, 'important');
        }
      });
      observer.observe(mainInner);
      header.setProperty ? header.style.setProperty('max-width', `${mainInner.offsetWidth}px`, 'important') : (header.style.maxWidth = `${mainInner.offsetWidth}px`);
    }

    bindCoursePageActions(apiCourse);
    return header;
  };

  // 1. Synchronously render or update using currently available DOM info (instantaneous)
  buildOrUpdateHeader(null);

  // 2. Fetch from API as background progressive enhancement to populate the cover image and details
  if (!_coursePageHeaderLoading) {
    _coursePageHeaderLoading = true;
    
    // Fast-path: check if we already have the cache populated
    const cachedCourse = (_moodleCourseCache && _moodleCourseCache[courseId]) ? _moodleCourseCache[courseId] : null;
    if (cachedCourse) {
      buildOrUpdateHeader(cachedCourse);
      _coursePageHeaderLoading = false;
    } else {
      fetchMoodleCourses().then(courseData => {
        _coursePageHeaderLoading = false;
        const apiCourse = courseData ? courseData[courseId] : null;
        buildOrUpdateHeader(apiCourse);
      }).catch(err => {
        console.error('[myMoodle ULTRA] customizeCoursePageHeader: fetchMoodleCourses failed:', err);
        _coursePageHeaderLoading = false;
      });
    }
  }
};

const customizeResourceIcons = () => {
  if (!isCoursePage()) return;

  const containers = document.querySelectorAll('.activityiconcontainer');
  containers.forEach(container => {
    if (container.dataset.ultramoodleProcessed === 'true') return;

    const activityItem = container.closest('.activity-item, .activity, .modtype_resource, .modtype_quiz');
    if (!activityItem) return;

    const isResource = activityItem.classList.contains('resource') || 
                       activityItem.classList.contains('modtype_resource') ||
                       container.classList.contains('resource') ||
                       activityItem.querySelector('a[href*="/mod/resource/"]');

    const isQuiz = activityItem.classList.contains('quiz') || 
                   activityItem.classList.contains('modtype_quiz') ||
                   container.classList.contains('quiz') ||
                   activityItem.querySelector('a[href*="/mod/quiz/"]');
                       
    if (!isResource && !isQuiz) return;

    const linkEl = activityItem.querySelector('a.aalink, a');
    if (!linkEl) return;

    const img = container.querySelector('img.activityicon, img');
    const originalSrc = (img ? img.getAttribute('src') || img.src || '' : '').toLowerCase();
    const imgAlt = (img ? img.getAttribute('alt') || '' : '').toLowerCase();

    const detailsEl = activityItem.querySelector('.resourcelinkdetails');
    const detailsText = (detailsEl ? detailsEl.textContent || '' : '').toLowerCase();
    const linkText = (linkEl ? linkEl.textContent || '' : '').toLowerCase();
    const href = (linkEl ? linkEl.href || '' : '').toLowerCase();

    let isPdf = false;
    let isWord = false;
    let isExcel = false;
    let isPowerPoint = false;
    let isText = false;
    let isQcm = isQuiz;

    // 1. Detect by native icon image source
    if (originalSrc.includes('pdf')) {
      isPdf = true;
    } else if (originalSrc.includes('document') || originalSrc.includes('word') || originalSrc.includes('docx')) {
      isWord = true;
    } else if (originalSrc.includes('presentation') || originalSrc.includes('powerpoint') || originalSrc.includes('pptx') || originalSrc.includes('ppt')) {
      isPowerPoint = true;
    } else if (originalSrc.includes('spreadsheet') || originalSrc.includes('excel') || originalSrc.includes('xlsx')) {
      isExcel = true;
    } else if (originalSrc.includes('text') || originalSrc.includes('txt')) {
      isText = true;
    }
    // 2. Fallback to image alt text
    else if (imgAlt.includes('pdf')) {
      isPdf = true;
    } else if (imgAlt.includes('word') || imgAlt.includes('document') || imgAlt.includes('docx')) {
      isWord = true;
    } else if (imgAlt.includes('powerpoint') || imgAlt.includes('présentation') || imgAlt.includes('pptx')) {
      isPowerPoint = true;
    } else if (imgAlt.includes('excel') || imgAlt.includes('calcul') || imgAlt.includes('xlsx')) {
      isExcel = true;
    } else if (imgAlt.includes('text') || imgAlt.includes('texte') || imgAlt.includes('txt')) {
      isText = true;
    }
    // 3. Fallback to file extension in link URL (href)
    else if (href.includes('.pdf')) {
      isPdf = true;
    } else if (href.includes('.docx') || href.includes('.doc')) {
      isWord = true;
    } else if (href.includes('.pptx') || href.includes('.ppt')) {
      isPowerPoint = true;
    } else if (href.includes('.xlsx') || href.includes('.xls') || href.includes('.csv')) {
      isExcel = true;
    } else if (href.includes('.txt') || href.includes('.text')) {
      isText = true;
    }
    // 4. Fallback to details metadata text
    else if (detailsText.includes('pdf')) {
      isPdf = true;
    } else if (detailsText.includes('word') || detailsText.includes('docx') || detailsText.includes('doc')) {
      isWord = true;
    } else if (detailsText.includes('powerpoint') || detailsText.includes('pptx') || detailsText.includes('ppt')) {
      isPowerPoint = true;
    } else if (detailsText.includes('excel') || detailsText.includes('xlsx') || detailsText.includes('xls') || detailsText.includes('calcul')) {
      isExcel = true;
    } else if (detailsText.includes('text') || detailsText.includes('texte') || detailsText.includes('txt')) {
      isText = true;
    }

    let iconUrl = null;
    let typeName = '';

    if (isPdf) {
      iconUrl = chrome.runtime.getURL('img/pdfIcone.png');
      typeName = 'pdf';
    } else if (isWord) {
      iconUrl = chrome.runtime.getURL('img/wordIcone.png');
      typeName = 'word';
    } else if (isExcel) {
      iconUrl = chrome.runtime.getURL('img/excelIcone.png');
      typeName = 'excel';
    } else if (isPowerPoint) {
      iconUrl = chrome.runtime.getURL('img/powerpointIcone.png');
      typeName = 'powerpoint';
    } else if (isText) {
      iconUrl = chrome.runtime.getURL('img/blocnoteIcone.png');
      typeName = 'text';
    } else if (isQcm) {
      iconUrl = chrome.runtime.getURL('img/qcmIcone.png');
      typeName = 'qcm';
    }

    if (iconUrl) {
      const img = container.querySelector('img.activityicon, img');
      if (img) {
        img.src = iconUrl;
        img.classList.add('ultramoodle-custom-icon');
        container.dataset.ultramoodleProcessed = 'true';
        container.classList.add('ultramoodle-custom-icon-container', `ultramoodle-icon-${typeName}`);
      }
    }

    if (isWord || isPowerPoint) {
      if (!activityItem.querySelector('.ultramoodle-btn-preview')) {
        const previewBtn = document.createElement('button');
        previewBtn.className = 'ultramoodle-btn-preview';
        previewBtn.type = 'button';
        previewBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          Visualiser
        `;

        const textBtn = document.createElement('button');
        textBtn.className = 'ultramoodle-btn-preview';
        textBtn.type = 'button';
        textBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          Mode Texte
        `;

        const fileUrl = linkEl.href;
        
        let fileName = linkEl.textContent.trim();
        const instanceNameEl = linkEl.querySelector('.instancename');
        if (instanceNameEl) {
          const clone = instanceNameEl.cloneNode(true);
          clone.querySelectorAll('.accesshide, .sr-only, .accesshide-text').forEach(el => el.remove());
          fileName = clone.textContent.trim();
        }
        fileName = fileName.replace(/\s*(?:Fichier|Présentation|Document|Word|PowerPoint|PDF|Excel)\s*$/gi, '').trim();
        
        const fileType = isWord ? 'word' : 'powerpoint';

        // Store file metadata on the buttons for the global capturing listener
        previewBtn.dataset.fileUrl = fileUrl;
        previewBtn.dataset.fileName = fileName;
        previewBtn.dataset.fileType = fileType;
        previewBtn.dataset.mode = 'office';

        textBtn.dataset.fileUrl = fileUrl;
        textBtn.dataset.fileName = fileName;
        textBtn.dataset.fileType = fileType;
        textBtn.dataset.mode = 'text';
        
        // Disable parent link hover effect when hovering either preview button
        [previewBtn, textBtn].forEach(btn => {
          if (!btn) return;
          btn.addEventListener('mouseenter', () => {
            linkEl.style.setProperty('pointer-events', 'none', 'important');
            linkEl.style.setProperty('text-decoration', 'none', 'important');
          });
          btn.addEventListener('mouseleave', () => {
            linkEl.style.removeProperty('pointer-events');
            linkEl.style.removeProperty('text-decoration');
          });
        });
        
        linkEl.after(previewBtn);
        if (textBtn) {
          previewBtn.after(textBtn);
        }
      }
    }
  });
};

window.isCoursePage = isCoursePage;
window.customizeCoursePageHeader = customizeCoursePageHeader;
window.customizeStarredCourses = customizeStarredCourses;
window.customizeResourceIcons = customizeResourceIcons;
window.fetchMoodleCourses = fetchMoodleCourses;
window.getMoodleSesskey = getMoodleSesskey;

document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('ultramoodle-recent-menu');
  const historyBtn = document.getElementById('ultramoodle-course-btn-history');
  if (dropdown && dropdown.classList.contains('visible')) {
    if (!dropdown.contains(e.target) && (!historyBtn || !historyBtn.contains(e.target))) {
      dropdown.classList.remove('visible');
    }
  }
});

// Shift + Click file sharing modal listener (intercept in capture phase)
document.addEventListener('click', (e) => {
  if (e.shiftKey) {
    const linkEl = e.target.closest('a[href*="/mod/resource/"], a[href*="/mod/folder/"], a[href*="forcedownload=1"], .ultramoodle-btn-preview');
    if (linkEl) {
      e.preventDefault();
      e.stopPropagation();
      
      // Extract file details
      let fileUrl = linkEl.href || linkEl.dataset.fileUrl || '';
      let fileName = linkEl.textContent.trim() || linkEl.dataset.fileName || 'Fichier';
      
      // If the target was a custom preview button, try to find the main resource text/title
      if (linkEl.classList.contains('ultramoodle-btn-preview')) {
        const activityItem = linkEl.closest('.activity-item, .activity');
        if (activityItem) {
          const mainLink = activityItem.querySelector('a.aalink, a');
          if (mainLink) {
            fileUrl = mainLink.href;
            fileName = mainLink.textContent.trim();
          }
        }
      }
      
      // Detect type from Moodle icon
      let detectedType = 'file';
      const activityItem = linkEl.closest('.activity-item, .activity, li.section .activityinstance, li.activity');
      if (activityItem) {
        const iconImg = activityItem.querySelector('.activityicon, img[src*="/f/"]');
        if (iconImg) {
          const src = iconImg.src.toLowerCase();
          if (src.includes('pdf')) detectedType = 'pdf';
          else if (src.includes('word') || src.includes('document')) detectedType = 'word';
          else if (src.includes('powerpoint') || src.includes('presentation')) detectedType = 'powerpoint';
          else if (src.includes('spreadsheet') || src.includes('excel')) detectedType = 'excel';
        }
      }
      
      // Clean Moodle keywords suffix
      const cleanName = fileName.replace(/\s*(?:Fichier|Présentation|Document|Word|PowerPoint|PDF|Excel)\s*$/gi, '').trim();
      
      showShareModal(cleanName, fileUrl, detectedType);
    }
  }
}, true);

const getCoursePageTitle = () => {
  const heading = document.querySelector('.page-header-headings h1, #page-header h1, h1');
  if (heading) {
    let title = heading.textContent.trim();
    const cleanRegex = /^\s*\*?\s*([A-Z0-9]+(?:-[A-Z0-9]+)*)\s*(?:-|\u2013|\u2014)\s*/i;
    return title.replace(cleanRegex, '').replace(/\s*\([^)]*\)\s*$/g, '').trim();
  }
  return '';
};

const getMoodleUserId = () => {
  if (window.M?.cfg?.userid) return window.M.cfg.userid;
  let userid = document.documentElement.getAttribute('data-moodle-userid');
  if (!userid || userid === '0') {
    const body = document.body;
    if (body) {
      const bodyClass = body.className || '';
      const m = bodyClass.match(/\buser-(\d+)\b/);
      if (m) userid = m[1];
    }
  }
  if (!userid) {
    try {
      userid = sessionStorage.getItem('moodle_userid');
    } catch (e) {}
  }
  return userid ? parseInt(userid) : null;
};

const callMoodleAjax = async (methodname, args) => {
  const sesskey = getMoodleSesskey();
  if (!sesskey) {
    throw new Error('Moodle session key not loaded.');
  }
  const url = `${window.location.origin}/lib/ajax/service.php?sesskey=${sesskey}&info=${methodname}`;
  const payload = [
    {
      index: 0,
      methodname: methodname,
      args: args
    }
  ];

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
  const data = await response.json();
  if (!data || !data[0]) throw new Error('Invalid AJAX response format');
  if (data[0].error) {
    const exception = data[0].exception;
    const errorMsg = exception ? (typeof exception === 'object' ? (exception.message || JSON.stringify(exception)) : exception) : 'Moodle AJAX exception';
    throw new Error(errorMsg);
  }
  return data[0].data;
};

const fetchRecentMessageContacts = async () => {
  const userId = getMoodleUserId();
  if (!userId) return [];
  try {
    const result = await callMoodleAjax('core_message_get_conversations', {
      userid: userId,
      limitnum: 5,
      limitfrom: 0
    });
    const conversations = result.conversations || [];
    return conversations.map(conv => {
      let name = conv.name || '';
      let imageUrl = '';
      
      if (conv.members && conv.members.length > 0) {
        // Try to find the other member (Moodle type 1 conversations only list the other person)
        const otherMember = conv.members.find(m => m.id !== userId);
        if (otherMember) {
          name = otherMember.fullname || name;
          imageUrl = otherMember.profileimageurlsmall || otherMember.profileimageurl || '';
        } else if (conv.members.length === 1 && conv.members[0].id === userId) {
          // Self-conversation (type 3)
          name = `${conv.members[0].fullname} (Vous)`;
          imageUrl = conv.members[0].profileimageurlsmall || conv.members[0].profileimageurl || '';
        }
      } else {
        imageUrl = conv.imageurl || '';
      }
      
      return {
        id: conv.id,
        name: name,
        imageUrl: imageUrl
      };
    });
  } catch (err) {
    console.error('[myMoodle ULTRA] Error fetching message contacts:', err);
    return [];
  }
};

const showShareModal = (fileName, fileUrl, initialType = 'file') => {
  const existing = document.getElementById('ultramoodle-share-modal');
  if (existing) existing.remove();

  // Close Moodle's native message drawer if open to prevent overlap
  const messageDrawer = document.querySelector('[data-region="message-drawer"]');
  if (messageDrawer && messageDrawer.classList.contains('show')) {
    const toggleBtn = document.querySelector('[data-route="view-conversation-bias"]') || 
                      document.getElementById('message-drawer-toggle') ||
                      document.querySelector('[data-region="message-drawer-toggle"]');
    if (toggleBtn) toggleBtn.click();
  }

  const backdrop = document.createElement('div');
  backdrop.id = 'ultramoodle-share-modal';
  backdrop.className = 'ultramoodle-modal-backdrop';
  
  backdrop.innerHTML = `
    <div class="ultramoodle-modal-content" style="max-width: 480px !important; min-height: 380px; display: flex; flex-direction: column;">
      <div class="ultramoodle-modal-header">
        <h3 id="ultramoodle-share-modal-title">Partager le fichier</h3>
        <button class="ultramoodle-modal-close" id="ultramoodle-share-close-btn">&times;</button>
      </div>
      <div id="ultramoodle-share-dynamic-body" style="display: flex; flex-direction: column; gap: 16px; flex: 1;">
        <!-- Views will be injected dynamically -->
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const closeModal = () => {
    backdrop.classList.add('closing');
    backdrop.addEventListener('transitionend', () => {
      backdrop.remove();
    }, { once: true });
  };

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });

  const closeBtn = backdrop.querySelector('#ultramoodle-share-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  const headerTitle = backdrop.querySelector('#ultramoodle-share-modal-title');
  const dynamicBody = backdrop.querySelector('#ultramoodle-share-dynamic-body');

  let attachedFiles = [
    { name: fileName, url: fileUrl, type: initialType, isMoodle: true, fileObject: null }
  ];

  const getAllFilesOnPage = () => {
    const links = Array.from(document.querySelectorAll('a[href*="/mod/resource/"], a[href*="forcedownload=1"]'));
    const files = [];
    const seenUrls = new Set();
    
    links.forEach(link => {
      let url = link.href;
      if (!url) return;
      
      let name = link.textContent.trim();
      name = name.replace(/\s+Fichier$/, '')
                 .replace(/\s+Document PDF$/, '')
                 .replace(/\s+Document Word$/, '')
                 .replace(/\s+Présentation PowerPoint$/, '')
                 .replace(/\s+Dossier$/, '')
                 .trim();

      if (!name || seenUrls.has(url)) return;
      seenUrls.add(url);
      
      files.push({ name, url });
    });
    
    return files;
  };

  const escapeHtml = (unsafe) => {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const renderAddFilesFromPageView = () => {
    if (headerTitle) headerTitle.textContent = "Ajouter des fichiers du cours";
    
    const allPageFiles = getAllFilesOnPage().filter(pf => {
      return !attachedFiles.some(af => af.url === pf.url);
    });

    if (allPageFiles.length === 0) {
      dynamicBody.innerHTML = `
        <div style="font-size: 13.5px; color: var(--ultra-text-sub); text-align: center; padding: 32px 16px; opacity: 0.85;">
          Aucun autre fichier détecté sur cette page de cours.
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 12px; margin-top: auto;">
          <button id="ultramoodle-picker-back-btn" style="width: 100%; background-color: var(--ultra-surface-hover); color: var(--ultra-text-main); border: 1px solid var(--ultra-border); border-radius: 12px; padding: 12px; font-weight: 600; cursor: pointer;">
            Retour
          </button>
        </div>
      `;
      
      const backBtn = dynamicBody.querySelector('#ultramoodle-picker-back-btn');
      if (backBtn) backBtn.addEventListener('click', renderDefaultView);
      return;
    }

    dynamicBody.innerHTML = `
      <div style="position: relative; width: 100%;">
        <input type="text" id="ultramoodle-picker-search" placeholder="Rechercher un fichier sur la page..." style="
          width: 100%;
          background-color: var(--ultra-surface-hover);
          border: 1px solid var(--ultra-border);
          border-radius: 14px;
          padding: 12px 14px 12px 38px;
          font-family: inherit;
          font-size: 13.5px;
          color: var(--ultra-text-main);
          outline: none;
          box-sizing: border-box;
        ">
        <svg style="position: absolute; left: 14px; top: 13px; color: var(--ultra-text-sub); opacity: 0.6;" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0 4px;">
        <label style="display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 600; color: var(--ultra-text-main); cursor: pointer;">
          <input type="checkbox" id="ultramoodle-picker-select-all" style="width: 15px; height: 15px; accent-color: var(--ultra-accent);">
          Tout sélectionner
        </label>
        <span id="ultramoodle-picker-count-label" style="font-size: 11px; font-weight: 600; color: var(--ultra-text-sub); text-transform: uppercase;">
          ${allPageFiles.length} fichiers trouvés
        </span>
      </div>

      <div id="ultramoodle-picker-files-list" style="display: flex; flex-direction: column; gap: 6px; max-height: 180px; overflow-y: auto; padding: 8px; border: 1px solid var(--ultra-border); border-radius: 14px; background-color: var(--ultra-surface-hover);">
        <!-- File checkboxes list -->
      </div>

      <div style="display: flex; gap: 12px; margin-top: auto; padding-bottom: 4px;">
        <button id="ultramoodle-picker-back-btn" style="flex: 1; background-color: var(--ultra-surface-hover); color: var(--ultra-text-main); border: 1px solid var(--ultra-border); border-radius: 12px; padding: 12px; font-weight: 600; cursor: pointer; transition: background-color 0.2s;">
          Retour
        </button>
        <button id="ultramoodle-picker-add-selected" style="flex: 2; background-color: var(--ultra-accent); color: white; border: none; border-radius: 12px; padding: 12px; font-weight: 600; cursor: pointer; transition: opacity 0.2s;">
          Ajouter (0)
        </button>
      </div>
    `;

    const listContainer = dynamicBody.querySelector('#ultramoodle-picker-files-list');
    const selectAllCheckbox = dynamicBody.querySelector('#ultramoodle-picker-select-all');
    const addSelectedBtn = dynamicBody.querySelector('#ultramoodle-picker-add-selected');
    const searchInput = dynamicBody.querySelector('#ultramoodle-picker-search');
    
    let selectedUrls = new Set();

    const updateAddButtonState = () => {
      addSelectedBtn.textContent = `Ajouter (${selectedUrls.size})`;
      addSelectedBtn.disabled = selectedUrls.size === 0;
      addSelectedBtn.style.opacity = selectedUrls.size === 0 ? '0.5' : '1';
    };

    const renderList = (filterQuery = '') => {
      const filtered = allPageFiles.filter(f => f.name.toLowerCase().includes(filterQuery.toLowerCase()));
      if (filtered.length === 0) {
        listContainer.innerHTML = `<div style="font-size: 13px; color: var(--ultra-text-sub); text-align: center; padding: 16px 0;">Aucun fichier trouvé.</div>`;
        return;
      }
      
      listContainer.innerHTML = filtered.map((file, idx) => {
        const isChecked = selectedUrls.has(file.url);
        return `
          <label style="display: flex; align-items: center; justify-content: space-between; background-color: var(--ultra-surface); border: 1px solid var(--ultra-border); border-radius: 10px; padding: 8px 12px; gap: 10px; cursor: pointer; transition: background-color 0.15s;">
            <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
              <input type="checkbox" class="ultramoodle-picker-checkbox" data-url="${file.url}" data-name="${file.name}" style="width: 15px; height: 15px; accent-color: var(--ultra-accent);" ${isChecked ? 'checked' : ''}>
              <span style="font-size: 12.5px; font-weight: 500; color: var(--ultra-text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${file.name}">${file.name}</span>
            </div>
          </label>
        `;
      }).join('');

      listContainer.querySelectorAll('.ultramoodle-picker-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
          if (cb.checked) {
            selectedUrls.add(cb.dataset.url);
          } else {
            selectedUrls.delete(cb.dataset.url);
          }
          updateAddButtonState();
          
          selectAllCheckbox.checked = Array.from(listContainer.querySelectorAll('.ultramoodle-picker-checkbox')).every(c => c.checked);
        });
      });
    };

    renderList();
    updateAddButtonState();

    selectAllCheckbox.addEventListener('change', (e) => {
      const checkboxes = listContainer.querySelectorAll('.ultramoodle-picker-checkbox');
      checkboxes.forEach(cb => {
        cb.checked = e.target.checked;
        if (e.target.checked) {
          selectedUrls.add(cb.dataset.url);
        } else {
          selectedUrls.delete(cb.dataset.url);
        }
      });
      updateAddButtonState();
    });

    searchInput.addEventListener('input', (e) => {
      renderList(e.target.value.trim());
    });

    addSelectedBtn.addEventListener('click', () => {
      allPageFiles.forEach(file => {
        if (selectedUrls.has(file.url)) {
          attachedFiles.push({
            name: file.name,
            url: file.url,
            type: file.type || 'file',
            isMoodle: true,
            fileObject: null
          });
        }
      });
      renderDefaultView();
    });

    const backBtn = dynamicBody.querySelector('#ultramoodle-picker-back-btn');
    if (backBtn) backBtn.addEventListener('click', renderDefaultView);
  };

  const renderAttachedFiles = () => {
    const listContainer = dynamicBody.querySelector('#ultramoodle-attached-files-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = attachedFiles.map((file, idx) => {
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; background-color: var(--ultra-surface); border: 1px solid var(--ultra-border); border-radius: 10px; padding: 6px 12px; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ultra-text-sub)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span style="font-size: 12px; font-weight: 500; color: var(--ultra-text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${file.name}">${file.name}</span>
          </div>
          ${attachedFiles.length > 1 ? `
            <button class="ultramoodle-remove-file-btn" data-index="${idx}" style="background: none; border: none; color: #EF4444; font-size: 16px; cursor: pointer; padding: 0 4px; line-height: 1; display: flex; align-items: center; justify-content: center; opacity: 0.8; transition: opacity 0.2s;">
              &times;
            </button>
          ` : ''}
        </div>
      `;
    }).join('');

    listContainer.querySelectorAll('.ultramoodle-remove-file-btn').forEach(btn => {
      btn.addEventListener('mouseenter', () => btn.style.opacity = '1');
      btn.addEventListener('mouseleave', () => btn.style.opacity = '0.8');
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        attachedFiles.splice(idx, 1);
        renderAttachedFiles();
      });
    });
  };

  const renderDefaultView = () => {
    if (headerTitle) headerTitle.textContent = "Partager le fichier";
    
    dynamicBody.innerHTML = `
      <div style="background-color: var(--ultra-surface-hover); border: 1px solid var(--ultra-border); border-radius: 16px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
        <div style="font-size: 11px; font-weight: 600; color: var(--ultra-text-sub); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Fichiers sélectionnés</div>
        <div id="ultramoodle-attached-files-list" style="display: flex; flex-direction: column; gap: 6px; max-height: 120px; overflow-y: auto; padding-right: 4px;">
          <!-- File items will be rendered here -->
        </div>
        <button id="ultramoodle-add-file-btn" style="background: none; border: 1px dashed var(--ultra-accent); color: var(--ultra-accent); border-radius: 12px; padding: 10px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 4px; transition: background 0.2s;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Ajouter d'autres fichiers
        </button>
        <input type="file" id="ultramoodle-file-picker" multiple style="display: none;">
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 4px;">
        <div style="font-size: 12px; font-weight: 600; color: var(--ultra-text-sub); text-transform: uppercase; letter-spacing: 0.5px;">Partager par message</div>
        <div id="ultramoodle-share-contacts-list" style="display: flex; gap: 12px; overflow-x: auto; padding: 4px 0 12px 0; min-height: 85px;">
          <div style="font-size: 13px; color: var(--ultra-text-sub); opacity: 0.8; text-align: center; width: 100%; padding: 12px 0;">Chargement des contacts...</div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 4px;">
        <div style="font-size: 12px; font-weight: 600; color: var(--ultra-text-sub); text-transform: uppercase; letter-spacing: 0.5px;">Analyser avec une IA</div>
        <div id="ultramoodle-share-ai-list" style="display: flex; gap: 12px; overflow-x: auto; padding: 4px 0 12px 0; min-height: 85px;">
          <!-- ChatGPT -->
          <div class="ai-share-item" data-url="https://chatgpt.com/" style="display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; width: 72px; flex-shrink: 0; transition: transform 0.2s;">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #10a37f, #0d8567); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: white; box-shadow: 0 4px 10px rgba(16, 163, 127, 0.2);">
              GPT
            </div>
            <div style="font-size: 11px; font-weight: 600; color: var(--ultra-text-main); text-align: center; width: 100%;">ChatGPT</div>
          </div>
          <!-- Claude -->
          <div class="ai-share-item" data-url="https://claude.ai/new" style="display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; width: 72px; flex-shrink: 0; transition: transform 0.2s;">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #d97753, #b2533e); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: white; box-shadow: 0 4px 10px rgba(217, 119, 83, 0.2);">
              CLD
            </div>
            <div style="font-size: 11px; font-weight: 600; color: var(--ultra-text-main); text-align: center; width: 100%;">Claude</div>
          </div>
          <!-- Gemini -->
          <div class="ai-share-item" data-url="https://gemini.google.com/app" style="display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; width: 72px; flex-shrink: 0; transition: transform 0.2s;">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #9333ea); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: white; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.2);">
              GEM
            </div>
            <div style="font-size: 11px; font-weight: 600; color: var(--ultra-text-main); text-align: center; width: 100%;">Gemini</div>
          </div>
          <!-- Perplexity -->
          <div class="ai-share-item" data-url="https://www.perplexity.ai/" style="display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; width: 72px; flex-shrink: 0; transition: transform 0.2s;">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #1995ad, #137487); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: white; box-shadow: 0 4px 10px rgba(25, 149, 173, 0.2);">
              PPLX
            </div>
            <div style="font-size: 11px; font-weight: 600; color: var(--ultra-text-main); text-align: center; width: 100%;">Perplexity</div>
          </div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 4px; margin-bottom: 8px;">
        <div style="font-size: 12px; font-weight: 600; color: var(--ultra-text-sub); text-transform: uppercase; letter-spacing: 0.5px;">Options de partage</div>
        
        <div style="display: flex; gap: 12px; width: 100%;">
          <button id="ultramoodle-share-copy-link" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; background-color: var(--ultra-accent); color: white; border: none; border-radius: 12px; padding: 12px; font-weight: 600; cursor: pointer; transition: opacity 0.2s;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
            Copier les liens
          </button>
          <button id="ultramoodle-share-email" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; background-color: var(--ultra-surface-hover); color: var(--ultra-text-main); border: 1px solid var(--ultra-border); border-radius: 12px; padding: 12px; font-weight: 600; cursor: pointer; transition: background-color 0.2s;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            Email
          </button>
        </div>
      </div>
    `;

    renderAttachedFiles();

    const addFileBtn = dynamicBody.querySelector('#ultramoodle-add-file-btn');
    if (addFileBtn) {
      addFileBtn.addEventListener('click', renderAddFilesFromPageView);
    }

    const copyBtn = dynamicBody.querySelector('#ultramoodle-share-copy-link');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const linksText = attachedFiles.map(f => f.url).join('\n');
        navigator.clipboard.writeText(linksText).then(() => {
          copyBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Copié !
          `;
          copyBtn.style.backgroundColor = '#10B981';
          setTimeout(() => {
            copyBtn.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
              Copier les liens
            `;
            copyBtn.style.backgroundColor = 'var(--ultra-accent)';
          }, 2000);
        });
      });
    }

    const emailBtn = dynamicBody.querySelector('#ultramoodle-share-email');
    if (emailBtn) {
      emailBtn.addEventListener('click', () => {
        const subject = encodeURIComponent(`Partage de fichiers de cours`);
        const body = encodeURIComponent(`Voici les liens vers les fichiers de cours :\n\n` + attachedFiles.map(f => `${f.name}\n${f.url}`).join('\n\n'));
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
      });
    }

    const aiItems = dynamicBody.querySelectorAll('.ai-share-item');
    aiItems.forEach(item => {
      item.addEventListener('mouseenter', () => item.style.transform = 'scale(1.05)');
      item.addEventListener('mouseleave', () => item.style.transform = 'scale(1)');
      
      item.addEventListener('click', () => {
        const baseUrl = item.dataset.url;
        const subject = getCoursePageTitle();
        uploadAndShareToAi(baseUrl, subject, item);
      });
    });

    fetchRecentMessageContacts().then(contacts => {
      const listContainer = dynamicBody.querySelector('#ultramoodle-share-contacts-list');
      if (!listContainer) return;
      
      listContainer.innerHTML = '';

      const plusItem = document.createElement('div');
      plusItem.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        width: 72px;
        flex-shrink: 0;
        transition: transform 0.2s;
      `;
      plusItem.addEventListener('mouseenter', () => plusItem.style.transform = 'scale(1.05)');
      plusItem.addEventListener('mouseleave', () => plusItem.style.transform = 'scale(1)');
      
      plusItem.innerHTML = `
        <div style="
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background-color: var(--ultra-surface-hover);
          border: 1px dashed var(--ultra-accent);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 500;
          color: var(--ultra-accent);
          box-sizing: border-box;
        ">
          +
        </div>
        <div style="font-size: 11px; font-weight: 600; color: var(--ultra-accent); text-align: center; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          Rechercher
        </div>
      `;
      plusItem.addEventListener('click', () => {
        renderSearchView();
      });
      listContainer.appendChild(plusItem);

      if (contacts.length > 0) {
        contacts.forEach(contact => {
          const item = document.createElement('div');
          item.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            width: 72px;
            flex-shrink: 0;
            transition: transform 0.2s;
          `;
          item.addEventListener('mouseenter', () => item.style.transform = 'scale(1.05)');
          item.addEventListener('mouseleave', () => item.style.transform = 'scale(1)');
          
          let avatarHtml = '';
          if (contact.imageUrl) {
            avatarHtml = `<img src="${contact.imageUrl}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 1px solid var(--ultra-border);" />`;
          } else {
            const initials = contact.name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
            avatarHtml = `
              <div style="width: 44px; height: 44px; border-radius: 50%; background-color: var(--ultra-surface-hover); border: 1px solid var(--ultra-border); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: var(--ultra-text-main);">
                ${initials}
              </div>
            `;
          }
          
          const firstName = contact.name.split(' ')[0] || contact.name;
          
          item.innerHTML = `
            <div style="position: relative; width: 44px; height: 44px;">
              ${avatarHtml}
            </div>
            <div style="font-size: 11px; font-weight: 600; color: var(--ultra-text-main); text-align: center; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${contact.name}">
              ${firstName}
            </div>
          `;
          
          item.addEventListener('click', () => {
            renderWriteMessageView({
              id: null,
              name: contact.name,
              imageUrl: contact.imageUrl,
              conversationid: contact.id
            });
          });
          
          listContainer.appendChild(item);
        });
      }
    }).catch(err => {
      console.error('Error rendering share contacts:', err);
      const listContainer = dynamicBody.querySelector('#ultramoodle-share-contacts-list');
      if (listContainer) {
        listContainer.innerHTML = `<div style="font-size: 13px; color: var(--ultra-text-sub); opacity: 0.8; text-align: center; width: 100%; padding: 12px 0;">Erreur lors de la récupération des contacts.</div>`;
      }
    });
  };

  const renderSearchView = () => {
    if (headerTitle) headerTitle.textContent = "Rechercher un contact";

    dynamicBody.innerHTML = `
      <div style="display: flex; gap: 10px; align-items: center; width: 100%;">
        <div style="position: relative; flex: 1;">
          <input type="text" id="ultramoodle-search-contact-input" placeholder="Rechercher par nom..." style="
            width: 100%;
            background-color: var(--ultra-surface-hover);
            border: 1px solid var(--ultra-border);
            border-radius: 14px;
            padding: 12px 14px 12px 38px;
            font-family: inherit;
            font-size: 13.5px;
            color: var(--ultra-text-main);
            outline: none;
            box-sizing: border-box;
            transition: border-color 0.2s, box-shadow 0.2s;
          " />
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ultra-text-sub)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="
            position: absolute;
            left: 14px;
            top: 50%;
            transform: translateY(-50%);
            opacity: 0.7;
          ">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
      </div>

      <div id="ultramoodle-search-results-list" style="
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;
        overflow-y: auto;
        max-height: 220px;
        min-height: 150px;
        padding-right: 4px;
      ">
        <div style="font-size: 13px; color: var(--ultra-text-sub); opacity: 0.8; text-align: center; width: 100%; padding: 40px 0;">Tapez un nom pour commencer la recherche.</div>
      </div>

      <div style="display: flex; gap: 12px; margin-top: 4px; margin-bottom: 8px;">
        <button id="ultramoodle-search-back-btn" style="width: 100%; background-color: var(--ultra-surface-hover); border: 1px solid var(--ultra-border); border-radius: 12px; padding: 12px; font-weight: 600; color: var(--ultra-text-main); border: 1px solid var(--ultra-border) !important; cursor: pointer; transition: background-color 0.2s;">
          Retour
        </button>
      </div>
    `;

    const backBtn = dynamicBody.querySelector('#ultramoodle-search-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        renderDefaultView();
      });
    }

    const input = dynamicBody.querySelector('#ultramoodle-search-contact-input');
    const resultsContainer = dynamicBody.querySelector('#ultramoodle-search-results-list');
    
    if (input && resultsContainer) {
      setTimeout(() => input.focus(), 100);

      let searchTimeout = null;
      input.addEventListener('input', () => {
        if (searchTimeout) clearTimeout(searchTimeout);
        
        const query = input.value.trim();
        if (query.length < 2) {
          resultsContainer.innerHTML = `<div style="font-size: 13px; color: var(--ultra-text-sub); opacity: 0.8; text-align: center; width: 100%; padding: 40px 0;">Tapez au moins 2 caractères.</div>`;
          return;
        }

        resultsContainer.innerHTML = `<div style="font-size: 13px; color: var(--ultra-text-sub); opacity: 0.8; text-align: center; width: 100%; padding: 40px 0;">Recherche en cours...</div>`;

        searchTimeout = setTimeout(async () => {
          try {
            const userId = getMoodleUserId();
            const result = await callMoodleAjax('core_message_message_search_users', {
              userid: userId,
              search: query,
              limitnum: 30
            });
            
            const contacts = result.contacts || [];
            const noncontacts = result.noncontacts || [];
            const allUsers = [...contacts, ...noncontacts];

            if (allUsers.length === 0) {
              resultsContainer.innerHTML = `<div style="font-size: 13px; color: var(--ultra-text-sub); opacity: 0.8; text-align: center; width: 100%; padding: 40px 0;">Aucun utilisateur trouvé.</div>`;
              return;
            }

            resultsContainer.innerHTML = '';
            allUsers.forEach(user => {
              const item = document.createElement('div');
              item.style.cssText = `
                display: flex;
                align-items: center;
                gap: 12px;
                background-color: var(--ultra-surface-hover);
                border: 1px solid var(--ultra-border);
                border-radius: 14px;
                padding: 10px 14px;
                cursor: pointer;
                transition: transform 0.15s, background-color 0.15s;
              `;
              item.addEventListener('mouseenter', () => {
                item.style.transform = 'translateY(-1px)';
                item.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
              });
              item.addEventListener('mouseleave', () => {
                item.style.transform = 'none';
                item.style.backgroundColor = 'var(--ultra-surface-hover)';
              });

              let avatarHtml = '';
              const imageUrl = user.profileimageurlsmall || user.profileimageurl;
              if (imageUrl) {
                avatarHtml = `<img src="${imageUrl}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1px solid var(--ultra-border);" />`;
              } else {
                const initials = user.fullname.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
                avatarHtml = `
                  <div style="width: 36px; height: 36px; border-radius: 50%; background-color: var(--ultra-surface); border: 1px solid var(--ultra-border); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: var(--ultra-text-main);">
                    ${initials}
                  </div>
                `;
              }

              item.innerHTML = `
                ${avatarHtml}
                <div style="font-weight: 650; font-size: 13.5px; color: var(--ultra-text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; text-align: left;">
                  ${user.fullname}
                </div>
                <div style="font-size: 10px; color: var(--ultra-text-sub); font-weight: 600; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.5px;">
                  ${user.iscontact ? 'Contact' : 'Efrei'}
                </div>
              `;

              item.addEventListener('click', () => {
                renderWriteMessageView({
                  id: user.id,
                  name: user.fullname,
                  imageUrl: imageUrl,
                  conversationid: null
                });
              });

              resultsContainer.appendChild(item);
            });
          } catch (err) {
            console.error('Error during search users:', err);
            resultsContainer.innerHTML = `<div style="font-size: 13px; color: var(--ultra-text-sub); opacity: 0.8; text-align: center; width: 100%; padding: 40px 0;">Erreur lors de la recherche.</div>`;
          }
        }, 300);
      });
    }
  };

  const prepareMessageText = async (customMessage) => {
    let linksHtml = [];
    const subject = getCoursePageTitle();
    
    for (let file of attachedFiles) {
      if (file.isMoodle) {
        let fileType = 'file';
        if (file.url.toLowerCase().includes('.pdf')) fileType = 'pdf';
        else if (file.url.toLowerCase().includes('.docx') || file.url.toLowerCase().includes('.doc')) fileType = 'word';
        else if (file.url.toLowerCase().includes('.xlsx') || file.url.toLowerCase().includes('.xls') || file.url.toLowerCase().includes('.csv')) fileType = 'excel';
        else if (file.url.toLowerCase().includes('.pptx') || file.url.toLowerCase().includes('.ppt')) fileType = 'powerpoint';
        else if (file.url.toLowerCase().includes('.txt') || file.url.toLowerCase().includes('.text')) fileType = 'text';

        const embedData = {
          name: file.name,
          type: fileType,
          subject: subject
        };
        
        const base64Data = btoa(unescape(encodeURIComponent(JSON.stringify(embedData))));
        const richLink = `${file.url}#um-embed=${base64Data}`;
        linksHtml.push(`<a href="${richLink}">${file.name}</a>`);
      } else {
        try {
          const formData = new FormData();
          formData.append('file', file.fileObject, file.name);
          
          const uploadRes = await fetch('https://tmpfiles.org/api/v1/upload', {
            method: 'POST',
            body: formData
          });
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            if (uploadData.status === 'success' && uploadData.data && uploadData.data.url) {
              const publicUrl = uploadData.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
              linksHtml.push(`<a href="${publicUrl}">${file.name}</a>`);
            }
          }
        } catch (err) {
          console.error('[myMoodle ULTRA] Failed to upload local file for message:', err);
        }
      }
    }
    
    let messageText = '';
    if (linksHtml.length > 0) {
      const linksContainer = `<div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px;">` + linksHtml.join('') + `</div>`;
      if (customMessage) {
        messageText = linksContainer + escapeHtml(customMessage).replace(/\n/g, '<br>');
      } else {
        messageText = linksContainer;
      }
    } else if (customMessage) {
      messageText = escapeHtml(customMessage).replace(/\n/g, '<br>');
    }
    
    return messageText;
  };

  const renderWriteMessageView = (contact) => {
    if (headerTitle) headerTitle.textContent = `Partager avec ${contact.name.split(' ')[0]}`;

    dynamicBody.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
        <textarea id="ultramoodle-share-textarea" placeholder="Écrire un message d'accompagnement (facultatif)..." style="
          width: 100%;
          min-height: 90px;
          background-color: var(--ultra-surface-hover);
          border: 1px solid var(--ultra-border);
          border-radius: 16px;
          padding: 14px;
          font-family: inherit;
          font-size: 13.5px;
          color: var(--ultra-text-main);
          resize: none;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.2s, box-shadow 0.2s;
        " onfocus="this.style.borderColor='var(--ultra-accent)';this.style.boxShadow='0 0 0 3px rgba(var(--ultra-accent-rgb, 100, 100, 255), 0.15)';" onblur="this.style.borderColor='var(--ultra-border)';this.style.boxShadow='none';"></textarea>
      </div>

      <div style="display: flex; gap: 12px; margin-top: 4px; margin-bottom: 8px;">
        <button id="ultramoodle-share-back-btn" style="flex: 1; background-color: var(--ultra-surface-hover); border: 1px solid var(--ultra-border); border-radius: 12px; padding: 12px; font-weight: 600; color: var(--ultra-text-main); cursor: pointer; transition: background-color 0.2s;">
          Retour
        </button>
        <button id="ultramoodle-share-send-btn" style="flex: 2; background-color: var(--ultra-accent); border: none; border-radius: 12px; padding: 12px; font-weight: 600; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: opacity 0.2s;">
          Envoyer
        </button>
      </div>
    `;

    const backBtn = dynamicBody.querySelector('#ultramoodle-share-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (contact.fromSearch) {
          renderSearchView();
        } else {
          renderDefaultView();
        }
      });
    }

    const sendBtn = dynamicBody.querySelector('#ultramoodle-share-send-btn');
    const textarea = dynamicBody.querySelector('#ultramoodle-share-textarea');
    
    if (sendBtn && textarea) {
      setTimeout(() => textarea.focus(), 100);

      sendBtn.addEventListener('click', () => {
        sendBtn.disabled = true;
        sendBtn.style.opacity = '0.6';
        sendBtn.textContent = 'Envoi en cours...';

        const customMessage = textarea.value.trim();
        
        const sendMessage = (messageText) => {
          return contact.conversationid
            ? callMoodleAjax('core_message_send_messages_to_conversation', {
                conversationid: contact.conversationid,
                messages: [
                  {
                    text: messageText,
                    textformat: 1 // HTML
                  }
                ]
              })
            : callMoodleAjax('core_message_get_conversation_between_users', {
                userid: getMoodleUserId(),
                otheruserid: contact.id,
                includecontactrequests: true,
                includeprivacyinfo: true
              }).then(res => {
                return callMoodleAjax('core_message_send_messages_to_conversation', {
                  conversationid: res.id,
                  messages: [
                    {
                      text: messageText,
                      textformat: 1
                    }
                  ]
                });
              }).catch(() => {
                return callMoodleAjax('core_message_send_instant_messages', {
                  messages: [
                    {
                      touserid: contact.id,
                      text: messageText,
                      textformat: 1
                    }
                  ]
                });
              });
        };

        prepareMessageText(customMessage).then(messageText => {
          sendMessage(messageText).then(() => {
            sendBtn.textContent = 'Envoyé !';
            sendBtn.style.backgroundColor = '#10B981';
            
            setTimeout(() => {
              closeModal();
            }, 1200);
          }).catch(err => {
            console.error('[myMoodle ULTRA] Failed to send files via Moodle messages:', err);
            alert('Erreur lors de l\'envoi du message.');
            sendBtn.disabled = false;
            sendBtn.style.opacity = '1';
            sendBtn.textContent = 'Envoyer';
          });
        });
      });
    }
  };

  const uploadAndShareToAi = async (baseUrl, subject, buttonElement) => {
    const originalText = buttonElement.querySelector('div:last-child').textContent;
    const iconContainer = buttonElement.querySelector('div:first-child');
    const textLabel = buttonElement.querySelector('div:last-child');
    const originalBg = iconContainer.style.background;
    
    textLabel.textContent = "Lecture...";
    iconContainer.style.background = "#64748b";
    iconContainer.innerHTML = `
      <svg class="um-spin" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="2" x2="12" y2="6"></line>
        <line x1="12" y1="18" x2="12" y2="22"></line>
        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
        <line x1="2" y1="12" x2="6" y2="12"></line>
        <line x1="18" y1="12" x2="22" y2="12"></line>
        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
      </svg>
    `;
    
    try {
      let filesToSave = [];
      let targetDomain = "";
      if (baseUrl.includes("chatgpt.com")) targetDomain = "chatgpt.com";
      else if (baseUrl.includes("claude.ai")) targetDomain = "claude.ai";
      else if (baseUrl.includes("gemini.google.com")) targetDomain = "gemini.google.com";
      else if (baseUrl.includes("perplexity.ai")) targetDomain = "perplexity.ai";

      const isGemini = targetDomain === "gemini.google.com";
      let promptFilesText = [];

      for (let file of attachedFiles) {
        let detectedExtension = '';
        let detectedMime = '';
        let arrayBuffer;

        if (file.isMoodle) {
          const res = await fetch(file.url);
          if (!res.ok) throw new Error(`Erreur de téléchargement pour ${file.name}`);
          arrayBuffer = await res.arrayBuffer();
          
          const contentType = res.headers.get('content-type') || '';
          const finalUrl = res.url || file.url;
          
          if (contentType.includes('wordprocessingml') || finalUrl.endsWith('.docx')) {
            detectedExtension = 'docx';
            detectedMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          } else if (contentType.includes('msword') || finalUrl.endsWith('.doc')) {
            detectedExtension = 'doc';
            detectedMime = 'application/msword';
          } else if (contentType.includes('presentationml') || finalUrl.endsWith('.pptx')) {
            detectedExtension = 'pptx';
            detectedMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
          } else if (contentType.includes('powerpoint') || contentType.includes('mspowerpoint') || finalUrl.endsWith('.ppt')) {
            detectedExtension = 'ppt';
            detectedMime = 'application/vnd.ms-powerpoint';
          } else if (contentType.includes('pdf') || finalUrl.endsWith('.pdf')) {
            detectedExtension = 'pdf';
            detectedMime = 'application/pdf';
          } else if (contentType.includes('spreadsheet') || finalUrl.endsWith('.xlsx')) {
            detectedExtension = 'xlsx';
            detectedMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          } else {
            detectedExtension = file.url.split('.').pop().split('?')[0] || 'pdf';
            detectedMime = 'application/octet-stream';
          }
        } else {
          arrayBuffer = await file.fileObject.arrayBuffer();
          detectedMime = file.fileObject.type || 'application/octet-stream';
          detectedExtension = file.name.split('.').pop() || 'bin';
        }

        const cleanName = file.name.endsWith(`.${detectedExtension}`) ? file.name : `${file.name}.${detectedExtension}`;

        if (isGemini) {
          const downloadLink = document.createElement('a');
          downloadLink.href = URL.createObjectURL(new Blob([arrayBuffer], { type: detectedMime }));
          downloadLink.download = cleanName;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          downloadLink.remove();
          promptFilesText.push(`"${cleanName}"`);
        } else {
          const blob = new Blob([arrayBuffer], { type: detectedMime });
          const base64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          
          filesToSave.push({
            base64: base64Data,
            fileName: cleanName,
            mimeType: detectedMime
          });
        }
      }

      let promptText = `Peux-tu m'expliquer ce cours en détail, me faire un résumé structuré et me lister les notions clés à retenir ?`;
      if (isGemini) {
        promptText = `Voici les cours : ${promptFilesText.join(', ')}` + (subject ? ` de la matière "${subject}"` : "") + `.\n\n[Les fichiers ont été téléchargés dans votre dossier. Veuillez les glisser-déposer tous ici pour les analyser.]\n\n` + promptText;
      } else {
        promptText = `Voici les documents de cours` + (subject ? ` de la matière "${subject}"` : "") + `.\n\n` + promptText;
      }

      await chrome.storage.local.set({
        pendingAiShare: {
          files: filesToSave,
          prompt: promptText,
          targetDomain: targetDomain,
          timestamp: Date.now()
        }
      });

      window.open(baseUrl, '_blank');

      textLabel.textContent = "Prêt !";
      iconContainer.style.background = "#10B981";
      iconContainer.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;
      setTimeout(() => {
        textLabel.textContent = originalText;
        iconContainer.style.background = originalBg;
        const initials = originalText === "ChatGPT" ? "GPT" : (originalText === "Claude" ? "CLD" : (originalText === "Gemini" ? "GEM" : "PPLX"));
        iconContainer.textContent = initials;
      }, 2000);

    } catch (err) {
      console.error('[myMoodle ULTRA] Failed to prepare files for AI:', err);
      alert("Impossible de préparer les fichiers pour l'IA.");
      textLabel.textContent = originalText;
      iconContainer.style.background = originalBg;
      const initials = originalText === "ChatGPT" ? "GPT" : (originalText === "Claude" ? "CLD" : (originalText === "Gemini" ? "GEM" : "PPLX"));
      iconContainer.textContent = initials;
    }
  };

  renderDefaultView();
};

const extractTextFromDocx = async (arrayBuffer) => {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("Format Word invalide");
  const docXml = await docFile.async("text");
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(docXml, "text/xml");
  const textElements = xmlDoc.getElementsByTagName("w:t");
  let text = "";
  for (let i = 0; i < textElements.length; i++) {
    text += textElements[i].textContent + " ";
  }
  return text.trim();
};

const extractTextFromPptx = async (arrayBuffer) => {
  const zip = await JSZip.loadAsync(arrayBuffer);
  let slideIndex = 1;
  let text = "";
  
  while (true) {
    const slideFile = zip.file(`ppt/slides/slide${slideIndex}.xml`);
    if (!slideFile) break;
    
    const slideXml = await slideFile.async("text");
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(slideXml, "text/xml");
    const textElements = xmlDoc.getElementsByTagName("a:t");
    
    text += `--- Slide ${slideIndex} ---\n`;
    for (let i = 0; i < textElements.length; i++) {
      text += textElements[i].textContent + " ";
    }
    text += "\n\n";
    slideIndex++;
  }
  
  if (text === "") throw new Error("Format PowerPoint invalide ou vide");
  return text.trim();
};


