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
      }
    });

    observer.observe(block, { childList: true, subtree: true });
  });
};

// Expose globally to be called from main.js
window.customizeTimeline = customizeTimeline;
