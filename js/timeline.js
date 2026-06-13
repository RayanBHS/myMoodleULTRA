// myMoodle ULTRA - Timeline Customization

const customizeTimelineEvent = (item) => {
  // Prevent re-processing if our card is already there
  if (item.querySelector('.ultramoodle-timeline-card')) return;
  item.classList.add('ultramoodle-timeline-processed');

  // Try to extract data from the native Moodle DOM
  const linkEl = item.querySelector('a.text-truncate, a.event-name-link, a[href*="assign"], a[href*="view"], a[href*="course"]');
  const courseEl = item.querySelector('small.text-truncate, .text-truncate.mb-0, .course-name, .text-muted');
  const timeEl = item.querySelector('.text-right.text-nowrap, .date, small.text-nowrap, .time');
  const iconEl = item.querySelector('img.icon, img.activityicon');
  
  if (!linkEl) return; // Not an event we can parse

  const url = linkEl.href;
  const title = linkEl.textContent.trim() || 'Événement';
  const courseName = courseEl ? courseEl.textContent.trim() : '';
  const timeText = timeEl ? timeEl.textContent.trim() : '';
  const iconSrc = iconEl ? iconEl.src : '';

  // Extract a shorter course code if possible (e.g., "FE402 - Economie" -> "FE402")
  const codeMatch = courseName.match(/^\s*\*?\s*([A-Za-z]{2,5}\d{3,4}(?:-[A-Za-z0-9]+)?)/);
  const displayCourse = codeMatch ? codeMatch[1] : courseName;

  // We can try to get the course image from our cache if it exists from courses.js
  let courseImage = '';
  if (window._moodleCourseCache) {
    const courseMatch = Object.values(window._moodleCourseCache).find(c => 
      (c.fullname && courseName && c.fullname.includes(courseName)) || (c.shortname && courseName && courseName.includes(c.shortname))
    );
    if (courseMatch && courseMatch.courseimage) {
      courseImage = courseMatch.courseimage;
    }
  }

  // Create the new card structure
  const card = document.createElement('a');
  card.href = url;
  card.className = 'ultramoodle-timeline-card';
  
  // Image or Icon
  const imgHtml = courseImage 
    ? `<img src="${courseImage}" alt="" />`
    : (iconSrc ? `<img src="${iconSrc}" style="width:24px; height:24px; object-fit:contain; border-radius:0;" alt="" />` : `<div class="ultramoodle-timeline-image-placeholder"></div>`);

  card.innerHTML = `
    <div class="ultramoodle-timeline-image">
      ${imgHtml}
    </div>
    <div class="ultramoodle-timeline-content">
      ${displayCourse ? `<div class="ultramoodle-timeline-course">${displayCourse}</div>` : ''}
      <div class="ultramoodle-timeline-title" title="${title}">${title}</div>
      <div class="ultramoodle-timeline-footer">
        ${timeText ? `<div class="ultramoodle-timeline-pill due">${timeText}</div>` : ''}
      </div>
    </div>
  `;

  // Hide the original content
  Array.from(item.children).forEach(child => {
    if (!child.classList.contains('ultramoodle-timeline-card')) {
      child.classList.add('ultramoodle-timeline-hidden-original');
    }
  });

  // Append our custom card
  item.appendChild(card);
};

const customizeTimeline = () => {
  const timelineBlocks = document.querySelectorAll('.block_timeline, [data-region="timeline"]');
  if (timelineBlocks.length === 0) return;

  timelineBlocks.forEach(block => {
    // Process existing events
    const events = block.querySelectorAll('.list-group-item');
    events.forEach(customizeTimelineEvent);

    // Observe for new events loaded via AJAX
    const observer = new MutationObserver((mutations) => {
      let shouldProcess = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldProcess = true;
          break;
        }
      }
      
      if (shouldProcess) {
        const newEvents = block.querySelectorAll('.list-group-item');
        newEvents.forEach(customizeTimelineEvent);
        
        // Rerun timeline filtering if there's an active query in the search bar
        const searchInput = document.getElementById('ultramoodle-course-search');
        if (searchInput && searchInput.value.trim() !== '') {
          filterTimeline(searchInput.value);
        }
      }
    });

    observer.observe(block, { childList: true, subtree: true });
  });
};

const findDayHeaderForEvent = (item, block) => {
  // Find the event list container
  const listContainer = item.closest('.list-group, [data-region="event-list"]');
  if (listContainer) {
    // Find the nearest preceding sibling of the list container that is a heading
    let sib = listContainer.previousElementSibling;
    while (sib) {
      if (sib.matches('h5, h6, [data-region="day-header"]') || sib.classList.contains('day') || sib.classList.contains('date')) {
        return sib;
      }
      const heading = sib.querySelector('h5, h6, [data-region="day-header"]');
      if (heading) return heading;
      sib = sib.previousElementSibling;
    }
  }
  
  // Fallback: search preceding siblings of the event item itself
  let itemSib = item.previousElementSibling;
  while (itemSib) {
    if (itemSib.matches('h5, h6, [data-region="day-header"]') || itemSib.classList.contains('day') || itemSib.classList.contains('date')) {
      return itemSib;
    }
    itemSib = itemSib.previousElementSibling;
  }
  
  return null;
};

const filterTimeline = (query) => {
  let timelineBlocks = Array.from(document.querySelectorAll('.block_timeline, [data-region="timeline"]'));
  if (timelineBlocks.length === 0) return;

  // Filter out nested matches to avoid duplicate processing on the same block
  timelineBlocks = timelineBlocks.filter((block, index, self) => {
    return !self.some((other, otherIndex) => otherIndex !== index && other.contains(block));
  });

  const cleanQuery = query ? query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';

  timelineBlocks.forEach(block => {
    const events = block.querySelectorAll('.list-group-item');
    const headers = block.querySelectorAll('h5, h6, [data-region="day-header"], .day, .date');

    if (cleanQuery === '') {
      events.forEach(event => {
        event.classList.remove('ultramoodle-event-hidden');
      });
      headers.forEach(header => {
        header.classList.remove('ultramoodle-event-hidden');
      });
      if (window.showEmptyState) {
        window.showEmptyState(block, false);
      }
      return;
    }

    // Hide all headers initially
    headers.forEach(header => {
      header.classList.add('ultramoodle-event-hidden');
    });

    let matchCount = 0;
    events.forEach(event => {
      const title = (event.querySelector('.ultramoodle-timeline-title')?.textContent || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const course = (event.querySelector('.ultramoodle-timeline-course')?.textContent || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const originalText = (event.textContent || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

      const dayHeader = findDayHeaderForEvent(event, block);
      const dayText = dayHeader ? (dayHeader.textContent || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';

      const isMatch = title.includes(cleanQuery) || 
                      course.includes(cleanQuery) || 
                      originalText.includes(cleanQuery) || 
                      dayText.includes(cleanQuery);

      if (isMatch) {
        event.classList.remove('ultramoodle-event-hidden');
        if (dayHeader) {
          dayHeader.classList.remove('ultramoodle-event-hidden');
        }
        matchCount++;
      } else {
        event.classList.add('ultramoodle-event-hidden');
      }
    });

    // Automatically click "Show more" button if we are searching to fetch all events
    const moreBtn = block.querySelector('[data-action="more-events"]');
    const isMoreBtnVisible = moreBtn && !moreBtn.disabled && (moreBtn.offsetWidth > 0 || moreBtn.offsetHeight > 0);
    
    if (isMoreBtnVisible) {
      const now = Date.now();
      const lastClick = window._ultramoodleLastTimelineClick || 0;
      if (now - lastClick > 500) {
        window._ultramoodleLastTimelineClick = now;
        moreBtn.click();
      }
    }

    // Show or hide empty state
    if (window.showEmptyState) {
      window.showEmptyState(block, matchCount === 0 && !isMoreBtnVisible, 'timeline');
    }
  });
};

// Expose globally
window.customizeTimeline = customizeTimeline;
window.filterTimeline = filterTimeline;
