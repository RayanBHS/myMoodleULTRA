// ==========================================================
//  MYMOODLE ULTRA — Module Calendrier (calendar.js)
// ==========================================================

(function () {
  'use strict';

  // Helper detection of calendar page
  const isCalendarPage = () => {
    return window.location.pathname.includes('/calendar/view.php');
  };

  // State Management
  let state = {
    currentDate: new Date(),
    currentView: 'week', // 'day', 'week', 'month'
    events: [],
    loading: true,
    activeFilters: {
      'cours': true,
      'devoir': true,
      'quiz': true,
      'personnel': true,
      'site': true,
      'evenement': true
    },
    targetOpenEventTime: null,
    targetOpenEventTitle: null
  };

  const defaultSettings = {
    colors: {
      'cours': '#007aff',
      'devoir': '#ff9500',
      'quiz': '#af52de',
      'personnel': '#34c759',
      'site': '#ff3b30',
      'evenement': '#8e8e93'
    },
    displayStart: 8.0,
    displayEnd: 19.0
  };

  let userSettings = { ...defaultSettings };

  // Load display settings from extension storage
  function loadSettings(callback) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get('mye_moodle_calendar_settings', (res) => {
        if (res.mye_moodle_calendar_settings) {
          try {
            const parsed = JSON.parse(res.mye_moodle_calendar_settings);
            userSettings = { ...defaultSettings, ...parsed };
            userSettings.colors = { ...defaultSettings.colors, ...(parsed.colors || {}) };
          } catch (e) {}
        }
        if (callback) callback();
      });
    } else {
      if (callback) callback();
    }
  }

  // Save display settings to extension storage
  function saveSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        'mye_moodle_calendar_settings': JSON.stringify(userSettings)
      });
    }
  }

  // Apply custom colors dynamically by injecting a style tag
  function applyColors() {
    let styleTag = document.getElementById('mye-custom-colors');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'mye-custom-colors';
      document.head.appendChild(styleTag);
    }
    
    let css = '';
    Object.entries(userSettings.colors).forEach(([type, simpleHex]) => {
      let tNorm = type.toLowerCase();
      const cls = '.mac-course-' + tNorm;
      
      let r = 142, g = 142, b = 147; // Default gray
      if (simpleHex && simpleHex.length === 7) {
        r = parseInt(simpleHex.slice(1,3), 16);
        g = parseInt(simpleHex.slice(3,5), 16);
        b = parseInt(simpleHex.slice(5,7), 16);
      }
      
      const lightBg = `rgba(${r}, ${g}, ${b}, 0.12)`;
      const hoverBg = `rgba(${Math.max(0, r - 10)}, ${Math.max(0, g - 10)}, ${Math.max(0, b - 10)}, 0.2)`;
      
      css += `
        ${cls} .mac-cal-event-inner {
          background-color: ${lightBg} !important;
          border-left-color: ${simpleHex} !important;
        }
        ${cls}:hover .mac-cal-event-inner {
          background-color: ${hoverBg} !important;
        }
        ${cls} .mac-cal-event-title {
          color: ${simpleHex} !important;
        }
        ${cls} .mac-cal-month-event-inner {
          border-left-color: ${simpleHex} !important;
        }
        ${cls} .mac-cal-month-event-time, ${cls} .mac-cal-month-event-title {
          color: ${simpleHex} !important;
        }
        ${cls}:hover .mac-cal-month-event-inner {
          background-color: ${lightBg} !important;
        }
        .mac-cal-filter-item.type-${tNorm} {
          color: ${simpleHex} !important;
        }
        #mye-cd-${tNorm}-container .mye-cd-label {
          color: ${simpleHex} !important;
        }
        /* Dark mode overrides */
        .ultramoodle-dark ${cls} .mac-cal-event-inner {
          background-color: rgba(${r}, ${g}, ${b}, 0.22) !important;
          border-left-color: ${simpleHex} !important;
        }
        .ultramoodle-dark ${cls} .mac-cal-event-title {
          color: ${simpleHex} !important;
        }
      `;
    });
    styleTag.textContent = css;
  }

  function updateGauge() {
    let totalMinutes = 0;
    const { start, end } = getPeriodRange(state.currentDate, state.currentView);
    
    state.events.forEach(ev => {
      if (ev.start && ev.end) {
        if (ev.start >= start && ev.start <= end) {
          totalMinutes += (ev.end - ev.start) / 60000;
        }
      }
    });
    const hours = Math.round(totalMinutes / 60);
    const hoursEl = document.getElementById('mye-planning-hours');
    if (hoursEl) hoursEl.textContent = hours;

    const arc = document.getElementById('mye-planning-arc');
    if (arc) {
      let maxHours = 35;
      if (state.currentView === 'day') maxHours = 8;
      if (state.currentView === 'month') maxHours = 140;
      
      const ratio = Math.min(hours / maxHours, 1);
      const CIRCUMFERENCE = 502.654; // r=80 -> 2*PI*80
      const offset = CIRCUMFERENCE * (1 - ratio);
      arc.style.strokeDashoffset = offset;
    }
  }

  function fetchFutureEvents() {
    const now = new Date();
    const futureEnd = new Date(now);
    futureEnd.setDate(futureEnd.getDate() + 90);

    fetchMoodleCalendarEvents(now, futureEnd)
      .then(events => {
        let futureEvents = events.map(mapMoodleEvent).filter(ev => ev.start !== null);
        futureEvents.sort((a, b) => a.start - b.start);

        let nextCours = null;
        let nextDevoir = null;
        let nextQuiz = null;
        let nextAutre = null;
        const nowTime = now.getTime();

        for (const ev of futureEvents) {
          if (ev.start.getTime() < nowTime) continue;
          const typeKey = getEventFilterKey(ev.type);

          if (!nextCours && typeKey === 'cours') nextCours = ev;
          if (!nextDevoir && typeKey === 'devoir') nextDevoir = ev;
          if (!nextQuiz && typeKey === 'quiz') nextQuiz = ev;
          if (!nextAutre && (typeKey === 'evenement' || typeKey === 'site' || typeKey === 'personnel')) nextAutre = ev;

          if (nextCours && nextDevoir && nextQuiz && nextAutre) break;
        }

        const msInHour = 1000 * 60 * 60;
        const msInDay = msInHour * 24;

        const setLabel = (id, targetEv) => {
          const el = document.getElementById(id);
          if (!el) return;
          const parentItem = el.closest('.mye-countdown-item');
          if (!targetEv) {
            el.textContent = '> 90 j';
            if (parentItem) {
              parentItem.style.order = 999999999;
              parentItem.style.cursor = 'default';
              parentItem.onclick = null;
            }
          } else {
            const dateStr = targetEv.start;
            const diffMs = dateStr.getTime() - nowTime;
            if (parentItem) {
              parentItem.style.order = Math.max(0, Math.floor(diffMs / 1000));
              parentItem.style.cursor = 'pointer';
              parentItem.onclick = () => {
                state.currentDate = new Date(dateStr);
                if (state.currentView !== 'day' && state.currentView !== 'week') {
                  state.currentView = 'week';
                  document.querySelectorAll('.mac-cal-view-toggles .mac-cal-toggle-btn').forEach(b => b.classList.remove('active'));
                  const weekBtn = document.querySelector('.mac-cal-view-toggles .mac-cal-toggle-btn[data-view="week"]');
                  if (weekBtn) weekBtn.classList.add('active');
                }
                updatePeriodLabel();
                loadPlanningForPeriod(state.currentDate);
                
                state.targetOpenEventTime = dateStr.getTime();
                state.targetOpenEventTitle = targetEv.title;
              };
            }
            const diffHours = Math.ceil(diffMs / msInHour);
            if (diffHours < 72) {
              el.textContent = `${diffHours}h`;
            } else {
              const diffDays = Math.ceil(diffMs / msInDay);
              el.textContent = `J-${diffDays}`;
            }
          }
        };

        setLabel('mye-cd-cours', nextCours);
        setLabel('mye-cd-devoir', nextDevoir);
        setLabel('mye-cd-quiz', nextQuiz);
        setLabel('mye-cd-evenement', nextAutre);
      })
      .catch(err => {
        console.error('[myMoodle ULTRA] fetchFutureEvents failed:', err);
      });
  }

  // --- Date Math Helpers ---
  function getPeriodRange(date, view) {
    const current = new Date(date);
    let start, end;

    if (view === 'day') {
      start = new Date(current);
      start.setHours(0, 0, 0, 0);
      end = new Date(current);
      end.setHours(23, 59, 59, 999);
    } else if (view === 'week') {
      const day = current.getDay();
      const diff = current.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(current.setDate(diff));
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (view === 'month') {
      start = new Date(current.getFullYear(), current.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(current.getFullYear(), current.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    }
    return { start, end };
  }

  function formatDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatTime(date) {
    if (!date) return '—';
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  function getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  }

  // --- Moodle AJAX Core calendar events fetcher ---
  function fetchMoodleCalendarEvents(startTime, endTime) {
    const sesskey = window.isCoursePage ? null : getMoodleSesskey(); // Try fetching sesskey from DOM
    if (!sesskey) return Promise.resolve([]);

    // Call fetchMoodleCourses from courses.js (or fallback if empty)
    const coursesPromise = window.fetchMoodleCourses ? window.fetchMoodleCourses() : Promise.resolve(null);

    return coursesPromise.then(courses => {
      const courseIds = courses ? Object.keys(courses).map(Number) : [];

      const body = [
        {
          index: 0,
          methodname: 'core_calendar_get_calendar_events',
          args: {
            events: {
              courseids: courseIds
            },
            options: {
              userevents: true,
              siteevents: true,
              timestart: Math.floor(startTime.getTime() / 1000),
              timeend: Math.floor(endTime.getTime() / 1000),
              ignorehidden: true
            }
          }
        }
      ];

      return fetch(`/lib/ajax/service.php?sesskey=${sesskey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      .then(res => res.json())
      .then(data => {
        if (data && data[0] && data[0].error === false && data[0].data && data[0].data.events) {
          return data[0].data.events;
        }
        return [];
      })
      .catch(err => {
        console.error('[myMoodle ULTRA] fetchMoodleCalendarEvents failed:', err);
        return [];
      });
    });
  }

  // Map Moodle event to local structures
  function mapMoodleEvent(raw) {
    const title = raw.name || 'Événement';
    const start = raw.timestart ? new Date(raw.timestart * 1000) : null;
    const end = (raw.timestart && raw.timeduration)
      ? new Date((raw.timestart + raw.timeduration) * 1000)
      : (raw.timestart ? new Date((raw.timestart + 3600) * 1000) : null); // Default duration 1 hour
      
    let type = 'Cours';
    if (raw.eventtype === 'site') type = 'Site';
    else if (raw.eventtype === 'user') type = 'Personnel';
    else if (raw.modulename === 'assign') type = 'Devoir';
    else if (raw.modulename === 'quiz') type = 'Quiz';
    else if (raw.modulename) type = raw.modulename.charAt(0).toUpperCase() + raw.modulename.slice(1);

    const courseName = (raw.course && raw.course.fullname) ? raw.course.fullname : '';
    let displayTitle = title;
    if (courseName && !title.includes(courseName)) {
      displayTitle = `${courseName} - ${title}`;
    }

    const link = raw.url || '';
    const description = raw.description || '';

    // Extract location or room if possible from description
    let room = '';
    if (description) {
      const locMatch = description.match(/(?:Lieu|Salle|Location)\s*:\s*([^<>\n]+)/i);
      if (locMatch) room = locMatch[1].trim();
    }

    return {
      title: displayTitle,
      start,
      end,
      room,
      roomLong: room,
      teacher: '',
      type,
      link,
      moduleCode: (raw.course && raw.course.shortname) ? raw.course.shortname : '',
      modality: (raw.eventtype === 'site' || raw.eventtype === 'user') ? 'Événement' : 'Cours',
      groupNames: '',
      comments: description,
      raw
    };
  }

  // Fetch events for period and trigger render
  function loadPlanningForPeriod(date) {
    const { start, end } = getPeriodRange(date, state.currentView);
    let fetchStart = start;
    let fetchEnd = end;

    // Buffer dates for month view to display full boundary weeks
    if (state.currentView === 'month') {
      const startDay = start.getDay();
      const diffStart = start.getDate() - startDay + (startDay === 0 ? -6 : 1);
      fetchStart = new Date(start.setDate(diffStart));
      fetchStart.setHours(0, 0, 0, 0);

      const endDay = end.getDay();
      const diffEnd = end.getDate() + (endDay === 0 ? 0 : 7 - endDay);
      fetchEnd = new Date(end.setDate(diffEnd));
      fetchEnd.setHours(23, 59, 59, 999);
    }

    showSpinner();

    fetchMoodleCalendarEvents(fetchStart, fetchEnd)
      .then(events => {
        state.loading = false;
        state.events = events.map(mapMoodleEvent).filter(ev => ev.start !== null);
        state.events.sort((a, b) => a.start - b.start);
        renderPlanning();

        // Check if there is an event to auto-open
        if (state.targetOpenEventTime) {
          const targetTime = state.targetOpenEventTime;
          const targetTitle = state.targetOpenEventTitle;
          state.targetOpenEventTime = null;
          state.targetOpenEventTitle = null;
          const index = state.events.findIndex(e => e.start.getTime() === targetTime && e.title === targetTitle);
          if (index !== -1) {
            setTimeout(() => openEventModal(index), 100);
          }
        }
      })
      .catch(err => {
        console.error('[myMoodle ULTRA] loadPlanningForPeriod failed:', err);
        showError();
      });
  }

  // --- DOM Structure Builders ---
  function buildPageStructure() {
    const mainArea = document.querySelector('#region-main') || document.querySelector('.main-inner');
    if (!mainArea) return;

    if (document.getElementById('mye-calendars-container')) return;

    // Clear Moodle's native content in calendar area
    mainArea.innerHTML = '';

    const container = document.createElement('div');
    container.id = 'mye-calendars-container';

    container.innerHTML = `
      <div class="mac-cal-sidebar">
        <div class="mac-cal-sidebar-section">
          <div class="mye-sidebar-card" style="flex:1; display:flex; flex-direction:column; height:100%;">
            <!-- Workload Gauge -->
            <div class="mye-planning-stats">
              <div class="mye-planning-gauge-wrapper">
                <svg width="180" height="180" viewBox="0 0 180 180" class="mye-planning-gauge">
                  <circle cx="90" cy="90" r="80" class="mye-planning-gauge-bg"></circle>
                  <circle cx="90" cy="90" r="80" class="mye-planning-gauge-fill" id="mye-planning-arc"></circle>
                </svg>
                <div class="mye-planning-gauge-text">
                  <span id="mye-planning-hours">0</span>
                  <small>Heures</small>
                </div>
              </div>
              
              <!-- Countdown List -->
              <div class="mye-countdown-list">
                <div class="mye-countdown-item" id="mye-cd-cours-container">
                  <span class="mye-cd-label">Prochain Cours</span>
                  <span class="mye-cd-value" id="mye-cd-cours">...</span>
                </div>
                <div class="mye-countdown-item" id="mye-cd-devoir-container">
                  <span class="mye-cd-label">Prochain Devoir</span>
                  <span class="mye-cd-value" id="mye-cd-devoir">...</span>
                </div>
                <div class="mye-countdown-item" id="mye-cd-quiz-container">
                  <span class="mye-cd-label">Prochain Quiz</span>
                  <span class="mye-cd-value" id="mye-cd-quiz">...</span>
                </div>
                <div class="mye-countdown-item" id="mye-cd-evenement-container">
                  <span class="mye-cd-label">Autre Événement</span>
                  <span class="mye-cd-value" id="mye-cd-evenement">...</span>
                </div>
              </div>
            </div>

            <hr style="border:none; border-top:1px solid var(--ultra-border); margin:16px 0;">

            <!-- Filtres -->
            <div class="mac-cal-sidebar-title">Filtres</div>
            <div class="mac-cal-filter-list" style="display:flex; flex-direction:column; gap:8px;">
              <label class="mac-cal-filter-item type-cours" style="display:flex; align-items:center; font-size:12.5px; font-weight:600; cursor:pointer;">
                <input type="checkbox" class="mye-filter-cb" data-filter="cours" checked style="margin-right:8px;">
                Cours
              </label>
              <label class="mac-cal-filter-item type-devoir" style="display:flex; align-items:center; font-size:12.5px; font-weight:600; cursor:pointer;">
                <input type="checkbox" class="mye-filter-cb" data-filter="devoir" checked style="margin-right:8px;">
                Devoirs
              </label>
              <label class="mac-cal-filter-item type-quiz" style="display:flex; align-items:center; font-size:12.5px; font-weight:600; cursor:pointer;">
                <input type="checkbox" class="mye-filter-cb" data-filter="quiz" checked style="margin-right:8px;">
                Quiz
              </label>
              <label class="mac-cal-filter-item type-personnel" style="display:flex; align-items:center; font-size:12.5px; font-weight:600; cursor:pointer;">
                <input type="checkbox" class="mye-filter-cb" data-filter="personnel" checked style="margin-right:8px;">
                Personnel
              </label>
              <label class="mac-cal-filter-item type-site" style="display:flex; align-items:center; font-size:12.5px; font-weight:600; cursor:pointer;">
                <input type="checkbox" class="mye-filter-cb" data-filter="site" checked style="margin-right:8px;">
                Site
              </label>
              <label class="mac-cal-filter-item type-evenement" style="display:flex; align-items:center; font-size:12.5px; font-weight:600; cursor:pointer;">
                <input type="checkbox" class="mye-filter-cb" data-filter="evenement" checked style="margin-right:8px;">
                Autres
              </label>
            </div>

            <hr style="border:none; border-top:1px solid var(--ultra-border); margin:16px 0;">

            <!-- Mini Calendar -->
            <div class="mac-cal-minical" id="mac-cal-minical"></div>
            
            <div style="margin-top:auto; padding-top: 10px;">
              <button id="mye-settings-btn" class="mac-cal-today-btn" style="width:100%; display:flex; align-items:center; justify-content:center; gap:8px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                Paramètres
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="mac-cal-main">
        <div class="mac-cal-toolbar">
          <div class="mac-cal-toolbar-left">
            <div class="mac-cal-title" id="mye-period-label">Chargement…</div>
          </div>
          
          <div class="mac-cal-view-toggles">
            <button class="mac-cal-toggle-btn" data-view="day">Jour</button>
            <button class="mac-cal-toggle-btn active" data-view="week">Semaine</button>
            <button class="mac-cal-toggle-btn" data-view="month">Mois</button>
          </div>
          
          <div class="mac-cal-toolbar-right">
            <div class="mac-cal-nav">
              <button class="mac-cal-icon-btn" id="mye-period-prev">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <button class="mac-cal-today-btn" id="mye-period-today">Aujourd'hui</button>
              <button class="mac-cal-icon-btn" id="mye-period-next">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        </div>
        
        <div class="mac-cal-content" id="mye-planning-right"></div>
      </div>

      <!-- Settings Modal overlay -->
      <div id="mye-settings-modal" class="mye-modal-overlay" style="display: none;">
        <div class="mye-modal" style="max-width: 420px; width: 100%;">
          <div class="mye-modal-header">
            <h3>Paramètres</h3>
            <button id="mye-settings-close" class="mac-cal-icon-btn" style="border:none; background:none; font-size:20px;">&times;</button>
          </div>
          <div class="mye-modal-body" style="max-height: 70vh; overflow-y: auto;">
            <h4 style="font-size: 13px; font-weight: 700; color: var(--ultra-text-sub); text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 10px 0;">Couleurs des Catégories</h4>
            <div id="mye-settings-colors" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;"></div>

            <h4 style="font-size: 13px; font-weight: 700; color: var(--ultra-text-sub); text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 10px 0;">Amplitude Horaire</h4>
            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 8px;">
              <span>Début : <span id="mye-setting-start-val" style="color:var(--ultra-accent);">8h00</span></span>
              <span>Fin : <span id="mye-setting-end-val" style="color:var(--ultra-accent);">19h00</span></span>
            </div>
            
            <style>
              .mye-dual-slider-container { position: relative; width: 100%; height: 24px; display: flex; align-items: center; }
              .mye-dual-slider-track { position: absolute; top: 50%; left: 0; right: 0; height: 4px; background: var(--ultra-border); border-radius: 2px; transform: translateY(-50%); }
              .mye-dual-slider-range { position: absolute; top: 50%; height: 4px; background: var(--ultra-accent); border-radius: 2px; transform: translateY(-50%); pointer-events: none; }
              .mye-dual-slider-input { position: absolute !important; width: 100% !important; left: 0 !important; -webkit-appearance: none !important; appearance: none !important; background: transparent !important; pointer-events: none !important; margin: 0 !important; outline: none !important; }
              .mye-dual-slider-input::-webkit-slider-thumb { pointer-events: auto; -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: var(--ultra-surface); border: 1px solid var(--ultra-border); box-shadow: 0 1px 3px rgba(0,0,0,0.15); cursor: pointer; }
              .mye-dual-slider-input::-moz-range-thumb { pointer-events: auto; width: 18px; height: 18px; border-radius: 50%; background: var(--ultra-surface); border: 1px solid var(--ultra-border); box-shadow: 0 1px 3px rgba(0,0,0,0.15); cursor: pointer; }
            </style>
            <div class="mye-dual-slider-container">
              <div class="mye-dual-slider-track"></div>
              <div id="mye-dual-slider-range" class="mye-dual-slider-range"></div>
              <input type="range" id="mye-setting-start" class="mye-dual-slider-input" min="0" max="23" step="1" value="${userSettings.displayStart}" style="z-index: 4;">
              <input type="range" id="mye-setting-end" class="mye-dual-slider-input" min="1" max="24" step="1" value="${userSettings.displayEnd}" style="z-index: 5;">
            </div>
          </div>
          <div class="mye-modal-footer">
            <button class="mac-cal-today-btn" id="mye-settings-reset" style="background:transparent; border-color:var(--ultra-border);">Réinitialiser</button>
            <button class="mac-cal-today-btn" id="mye-settings-save" style="background:var(--ultra-text-main); color:var(--ultra-surface); border:none;">Sauvegarder</button>
          </div>
        </div>
      </div>

      <!-- Event Modal overlay -->
      <div id="mye-event-modal" class="mye-modal-overlay" style="display: none;">
        <div class="mye-modal" style="max-width: 480px; width: 100%;">
          <div class="mye-modal-header" style="background-color: var(--ultra-accent); border-bottom: none; color: #fff; padding: 18px 20px;">
            <div id="mye-em-header-text" style="display: flex; flex-direction: column; gap: 2px;">
              <!-- Title and type injected here -->
            </div>
            <button id="mye-event-close" class="mac-cal-icon-btn" style="background: rgba(255, 255, 255, 0.2); border: none; color: white; width: 28px; height: 28px; font-size: 20px; outline: none;">&times;</button>
          </div>
          <div class="mye-modal-body" id="mye-em-body">
            <!-- Content injected dynamically -->
          </div>
        </div>
      </div>
    `;

    mainArea.appendChild(container);

    // Filter toggles event binding
    document.querySelectorAll('.mye-filter-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const filterType = e.target.getAttribute('data-filter');
        state.activeFilters[filterType] = e.target.checked;
        renderPlanning();
      });
    });

    // View toggles events
    document.querySelectorAll('.mac-cal-view-toggles .mac-cal-toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.mac-cal-view-toggles .mac-cal-toggle-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        state.currentView = e.target.getAttribute('data-view');
        updatePeriodLabel();
        loadPlanningForPeriod(state.currentDate);
      });
    });

    // Navigation events
    document.getElementById('mye-period-prev').addEventListener('click', () => navigatePeriod(-1));
    document.getElementById('mye-period-next').addEventListener('click', () => navigatePeriod(1));
    document.getElementById('mye-period-today').addEventListener('click', () => {
      state.currentDate = new Date();
      updatePeriodLabel();
      loadPlanningForPeriod(state.currentDate);
    });

    // Mini calendar click events
    document.getElementById('mac-cal-minical').addEventListener('click', (e) => {
      const dayEl = e.target.closest('.mac-minical-day');
      if (dayEl && dayEl.dataset.date) {
        state.currentDate = new Date(dayEl.dataset.date);
        updatePeriodLabel();
        loadPlanningForPeriod(state.currentDate);
      }
    });

    // Settings logic
    const startInput = document.getElementById('mye-setting-start');
    const endInput = document.getElementById('mye-setting-end');
    const startValEl = document.getElementById('mye-setting-start-val');
    const endValEl = document.getElementById('mye-setting-end-val');
    const rangeBar = document.getElementById('mye-dual-slider-range');
    
    const updateDualSlider = () => {
      let start = parseInt(startInput.value);
      let end = parseInt(endInput.value);
      
      if (start >= end) {
        if (document.activeElement === startInput) {
          startInput.value = end - 1;
          start = end - 1;
        } else {
          endInput.value = start + 1;
          end = start + 1;
        }
      }
      
      startValEl.textContent = `${start}h00`;
      endValEl.textContent = `${end}h00`;
      
      const min = 0;
      const max = 24;
      const leftPercent = ((start - min) / (max - min)) * 100;
      const rightPercent = ((max - end) / (max - min)) * 100;
      
      rangeBar.style.left = leftPercent + '%';
      rangeBar.style.right = rightPercent + '%';
    };

    startInput.addEventListener('input', updateDualSlider);
    endInput.addEventListener('input', updateDualSlider);
    
    document.getElementById('mye-settings-btn').addEventListener('click', openSettingsModal);

    document.getElementById('mye-settings-close').addEventListener('click', () => {
      document.getElementById('mye-settings-modal').style.display = 'none';
    });

    document.getElementById('mye-settings-reset').addEventListener('click', () => {
      userSettings = { ...defaultSettings };
      userSettings.colors = { ...defaultSettings.colors };
      saveSettings();
      applyColors();
      document.getElementById('mye-settings-modal').style.display = 'none';
      renderPlanning();
    });

    document.getElementById('mye-settings-save').addEventListener('click', () => {
      userSettings.displayStart = parseInt(startInput.value) || 8.0;
      userSettings.displayEnd = parseInt(endInput.value) || 19.0;
      saveSettings();
      applyColors();
      document.getElementById('mye-settings-modal').style.display = 'none';
      renderPlanning();
    });

    // Modal Close
    document.getElementById('mye-event-close').addEventListener('click', () => {
      document.getElementById('mye-event-modal').style.display = 'none';
    });
    
    document.getElementById('mye-event-modal').addEventListener('click', (e) => {
      if (e.target.id === 'mye-event-modal') {
        e.target.style.display = 'none';
      }
    });

    updatePeriodLabel();
  }

  function navigatePeriod(direction) {
    const nextDate = new Date(state.currentDate);
    if (state.currentView === 'day') {
      nextDate.setDate(nextDate.getDate() + direction);
    } else if (state.currentView === 'week') {
      nextDate.setDate(nextDate.getDate() + (direction * 7));
    } else if (state.currentView === 'month') {
      nextDate.setMonth(nextDate.getMonth() + direction);
    }
    state.currentDate = nextDate;
    updatePeriodLabel();
    loadPlanningForPeriod(state.currentDate);
  }

  function updatePeriodLabel() {
    const { start, end } = getPeriodRange(state.currentDate, state.currentView);
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    let label = '';

    if (state.currentView === 'day') {
      const parts = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).formatToParts(state.currentDate);
      const str = cap(parts.map(p => p.value).join(''));
      label = `${str} <span class="year">${state.currentDate.getFullYear()}</span>`;
    } else {
      const startMonth = start.toLocaleDateString('fr-FR', { month: 'long' });
      const endMonth = end.toLocaleDateString('fr-FR', { month: 'long' });
      const startYear = start.getFullYear();
      const endYear = end.getFullYear();

      if (startMonth === endMonth && startYear === endYear) {
        label = `${cap(startMonth)} <span class="year">${startYear}</span>`;
      } else if (startYear === endYear) {
        label = `${cap(startMonth)} - ${cap(endMonth)} <span class="year">${startYear}</span>`;
      } else {
        label = `${cap(startMonth)} ${startYear} - ${cap(endMonth)} ${endYear}`;
      }
    }

    const labelEl = document.getElementById('mye-period-label');
    if (labelEl) labelEl.innerHTML = label;

    renderMiniCalendar(state.currentDate);
  }

  function renderMiniCalendar(refDate) {
    const container = document.getElementById('mac-cal-minical');
    if (!container) return;

    const year = refDate.getFullYear();
    const month = refDate.getMonth();
    const today = new Date();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startDayIdx = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // 0 = Monday, 6 = Sunday
    
    let html = `
      <div class="mac-minical-header">
        <div class="mac-minical-title">${firstDay.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase())}</div>
        <div class="mac-minical-nav">
          <button id="minical-prev">‹</button>
          <button id="minical-next">›</button>
        </div>
      </div>
      <div class="mac-minical-grid">
        <div class="mac-minical-dow">L</div>
        <div class="mac-minical-dow">M</div>
        <div class="mac-minical-dow">M</div>
        <div class="mac-minical-dow">J</div>
        <div class="mac-minical-dow">V</div>
        <div class="mac-minical-dow">S</div>
        <div class="mac-minical-dow">D</div>
    `;

    for (let i = 0; i < startDayIdx; i++) {
      html += `<div class="mac-minical-day empty"></div>`;
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const isToday = (d === today.getDate() && month === today.getMonth() && year === today.getFullYear());
      
      const dDate = new Date(year, month, d);
      const { start: pStart, end: pEnd } = getPeriodRange(refDate, state.currentView);
      const isSelectedPeriod = dDate >= pStart && dDate <= pEnd;

      let cls = 'mac-minical-day';
      if (isToday) cls += ' today';
      if (isSelectedPeriod && !isToday) cls += ' selected-week';

      const isoDate = new Date(Date.UTC(year, month, d, 12, 0, 0)).toISOString();
      html += `<div class="${cls}" data-date="${isoDate}" style="cursor: pointer;">${d}</div>`;
    }

    html += `</div>`;
    container.innerHTML = html;

    // Attach local navigation triggers on the mini calendar arrows
    container.querySelector('#minical-prev').addEventListener('click', (e) => {
      e.stopPropagation();
      navigatePeriod(-1);
    });
    container.querySelector('#minical-next').addEventListener('click', (e) => {
      e.stopPropagation();
      navigatePeriod(1);
    });
  }

  function showSpinner() {
    const panel = document.getElementById('mye-planning-right');
    if (!panel) return;
    panel.innerHTML = `
      <div class="mye-planning-loading">
        <div class="mye-planning-spinner"></div>
        <div class="mye-planning-loading-text">Chargement de votre calendrier...</div>
      </div>
    `;
  }

  function showError() {
    const panel = document.getElementById('mye-planning-right');
    if (!panel) return;
    panel.innerHTML = `
      <div class="mye-planning-error">
        <div class="mye-planning-error-icon">⚠️</div>
        <div class="mye-planning-error-text">Impossible de charger le calendrier Moodle. Veuillez rafraîchir.</div>
      </div>
    `;
  }

  // --- Filtering Helpers ---
  function getFilteredEvents() {
    return state.events.filter(ev => {
      const typeKey = getEventFilterKey(ev.type);
      return state.activeFilters[typeKey] !== false;
    });
  }

  function getEventFilterKey(type) {
    if (!type) return 'evenement';
    const t = type.toLowerCase();
    if (t.includes('cours') || t.includes('class')) return 'cours';
    if (t.includes('devoir') || t.includes('assign')) return 'devoir';
    if (t.includes('quiz') || t.includes('qcm')) return 'quiz';
    if (t.includes('personnel') || t.includes('user')) return 'personnel';
    if (t.includes('site')) return 'site';
    return 'evenement';
  }

  function getEventColorClass(type) {
    const filterKey = getEventFilterKey(type);
    return 'mac-course-' + filterKey;
  }

  // --- Overlapping Events Calculation Engine ---
  function computeEventLayout(events) {
    if (!events || !events.length) return;
    let columns = [];
    let lastEventEnding = null;
    
    events.sort((a, b) => a.start - b.start || b.end - a.end);
    
    function packEvents(cols) {
      const numCols = cols.length;
      cols.forEach((col, colIndex) => {
        col.forEach(ev => {
          ev.colIndex = colIndex;
          ev.numColumns = numCols;
        });
      });
    }

    events.forEach(ev => {
      if (lastEventEnding !== null && ev.start >= lastEventEnding) {
        packEvents(columns);
        columns = [];
        lastEventEnding = null;
      }
      let placed = false;
      for (let col of columns) {
        if (!col.length) continue;
        let lastInCol = col[col.length - 1];
        if (ev.start >= lastInCol.end) {
          col.push(ev);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([ev]);
      }
      if (lastEventEnding === null || ev.end > lastEventEnding) {
        lastEventEnding = ev.end;
      }
    });
    
    if (columns.length > 0) {
      packEvents(columns);
    }
  }

  // --- Rendering Functions ---
  function renderPlanning() {
    updateGauge();
    if (state.currentView === 'month') {
      renderMonthView();
    } else {
      renderGrid();
    }
    attachEventModalListeners();
  }

  function renderMonthView() {
    const panel = document.getElementById('mye-planning-right');
    if (!panel) return;

    const filtered = getFilteredEvents();
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    
    // Find the Monday of the first calendar cell week
    const startDay = firstDay.getDay();
    const diffStart = firstDay.getDate() - startDay + (startDay === 0 ? -6 : 1);
    let iterDate = new Date(firstDay.setDate(diffStart));
    iterDate.setHours(0, 0, 0, 0);

    let html = `
      <div class="mac-apple-calendar-month">
        <div class="mac-cal-month-header">
          <div>LUN</div><div>MAR</div><div>MER</div><div>JEU</div><div>VEN</div><div>SAM</div><div>DIM</div>
        </div>
        <div class="mac-cal-month-grid">
    `;

    for (let i = 0; i < 42; i++) {
      const dStr = formatDateISO(iterDate);
      const isCurrentMonth = iterDate.getMonth() === month;
      const isToday = dStr === formatDateISO(new Date());

      // Filter events occurring this day
      const dayEvents = filtered.filter(ev => formatDateISO(ev.start) === dStr);
      
      let eventsHTML = '';
      dayEvents.forEach(ev => {
        const classModifier = getEventColorClass(ev.type);
        const index = state.events.indexOf(ev); // Keep global index reference for details modal
        
        eventsHTML += `
          <div class="mac-cal-month-event ${classModifier} mye-open-modal-evt" data-index="${index}" title="${escapeHTML(ev.title)}">
            <div class="mac-cal-month-event-inner">
              <span class="mac-cal-month-event-time">${formatTime(ev.start)}</span>
              <span class="mac-cal-month-event-title">${escapeHTML(ev.title)}</span>
            </div>
          </div>
        `;
      });

      html += `
        <div class="mac-cal-month-cell ${isCurrentMonth ? '' : 'mac-cal-month-cell-dim'}">
          <div class="mac-cal-month-date ${isToday ? 'today' : ''}">${iterDate.getDate()}</div>
          <div class="mac-cal-month-events">${eventsHTML}</div>
        </div>
      `;

      iterDate.setDate(iterDate.getDate() + 1);
    }

    html += `
        </div>
      </div>
    `;

    panel.innerHTML = html;
  }

  function renderGrid() {
    const panel = document.getElementById('mye-planning-right');
    if (!panel) return;

    const filtered = getFilteredEvents();

    const daysMap = {
      1: { name: 'Lun', date: null, events: [] },
      2: { name: 'Mar', date: null, events: [] },
      3: { name: 'Mer', date: null, events: [] },
      4: { name: 'Jeu', date: null, events: [] },
      5: { name: 'Ven', date: null, events: [] },
      6: { name: 'Sam', date: null, events: [] },
      0: { name: 'Dim', date: null, events: [] }
    };

    const { start: pStart } = getPeriodRange(state.currentDate, 'week');
    
    // Map dates for the week
    for (let i = 0; i < 7; i++) {
      const d = new Date(pStart);
      d.setDate(pStart.getDate() + i);
      daysMap[d.getDay()].date = d;
    }

    const minHour = Math.floor(userSettings.displayStart);
    const maxHour = Math.ceil(userSettings.displayEnd) - 1;

    let daysOrder = [1, 2, 3, 4, 5, 6, 0];
    if (state.currentView === 'day') {
      const todayNum = state.currentDate.getDay();
      daysOrder = [todayNum];
      daysMap[todayNum].date = new Date(state.currentDate);
    }

    filtered.forEach(ev => {
      const dayNum = ev.start.getDay();
      if (daysMap[dayNum]) {
        if (state.currentView === 'day' && dayNum !== state.currentDate.getDay()) return;
        daysMap[dayNum].events.push(ev);
      }
    });

    // Clean up empty weekend columns in week view to maximize desktop area
    if (state.currentView === 'week') {
      const hasSunday = daysMap[0].events.length > 0;
      const hasSaturday = daysMap[6].events.length > 0;
      if (!hasSunday) daysOrder.pop();
      if (!hasSaturday && !hasSunday) daysOrder.pop();
    }
    
    const isMobile = window.innerWidth <= 768;
    
    let headerHTML = `<div class="mac-cal-header"><div class="mac-cal-time-col-header"></div>`;
    daysOrder.forEach(dayNum => {
      const dayData = daysMap[dayNum];
      const isToday = formatDateISO(dayData.date) === formatDateISO(new Date());
      const isWeek = state.currentView === 'week';
      const displayName = isMobile ? dayData.name.charAt(0) : dayData.name;
      
      headerHTML += `
        <div class="mac-cal-day-header ${isToday ? 'mac-cal-today' : ''} ${isWeek ? 'mye-clickable-day' : ''}" data-date="${dayData.date.toISOString()}">
          <div class="mac-cal-day-name">${displayName}</div>
          <div class="mac-cal-day-num">${dayData.date.getDate()}</div>
        </div>
      `;
    });
    headerHTML += `</div>`;

    let containerHeight = panel.clientHeight;
    if (containerHeight < 100) {
      containerHeight = 500;
    }

    const duration = (maxHour - minHour) + 1;
    const PIXELS_PER_HOUR = Math.max(50, (containerHeight - 50) / duration);
    const totalGridHeight = duration * PIXELS_PER_HOUR;

    let timeColHTML = `<div class="mac-cal-time-col">`;
    for (let h = minHour; h <= maxHour; h++) {
      timeColHTML += `<div class="mac-cal-time-slot" style="height:${PIXELS_PER_HOUR}px"><span>${h}:00</span></div>`;
    }
    timeColHTML += `</div>`;

    let daysColsHTML = `<div class="mac-cal-day-cols">`;
    daysOrder.forEach(dayNum => {
      const dayData = daysMap[dayNum];
      const isToday = formatDateISO(dayData.date) === formatDateISO(new Date());
      let eventsHTML = '';
      
      computeEventLayout(dayData.events);

      dayData.events.forEach(ev => {
        eventsHTML += buildEventCard(ev, minHour, maxHour, PIXELS_PER_HOUR);
      });
      
      daysColsHTML += `
        <div class="mac-cal-day-col ${isToday ? 'mac-cal-today-col' : ''}">
          ${eventsHTML}
          ${isToday ? buildCurrentTimeIndicator(minHour, maxHour, PIXELS_PER_HOUR) : ''}
        </div>
      `;
    });
    daysColsHTML += `</div>`;

    let gridLinesHTML = `<div class="mac-cal-grid-lines">`;
    for (let h = minHour; h <= maxHour; h++) {
      const topPx = (h - minHour) * PIXELS_PER_HOUR;
      gridLinesHTML += `<div class="mac-cal-grid-line" style="top:${topPx}px"></div>`;
    }
    gridLinesHTML += `</div>`;

    const calendarHTML = `
      <div class="mac-apple-calendar">
        ${headerHTML}
        <div class="mac-cal-scroll-area">
          <div class="mac-cal-body" style="height:${totalGridHeight}px">
            ${timeColHTML}
            <div class="mac-cal-grid">
              ${gridLinesHTML}
              ${daysColsHTML}
            </div>
          </div>
        </div>
      </div>
    `;

    panel.innerHTML = calendarHTML;
    
    // Day click trigger to switch view
    panel.querySelectorAll('.mye-clickable-day').forEach(header => {
      header.addEventListener('click', () => {
        if (state.currentView !== 'week') return;
        const dateStr = header.getAttribute('data-date');
        state.currentDate = new Date(dateStr);
        state.currentView = 'day';
        
        document.querySelectorAll('.mac-cal-view-toggles .mac-cal-toggle-btn').forEach(b => b.classList.remove('active'));
        const dayBtn = document.querySelector('.mac-cal-view-toggles .mac-cal-toggle-btn[data-view="day"]');
        if (dayBtn) dayBtn.classList.add('active');
        
        updatePeriodLabel();
        loadPlanningForPeriod(state.currentDate);
      });
    });
    
    const scrollArea = panel.querySelector('.mac-cal-scroll-area');
    if (scrollArea) {
      const now = new Date();
      const h = now.getHours();
      // Scroll to current hour if within amplitude range, otherwise scroll to displayStart
      const scrollHour = (h >= minHour && h <= maxHour) ? h - 1 : userSettings.displayStart;
      const targetScroll = (scrollHour - minHour) * PIXELS_PER_HOUR;
      scrollArea.scrollTop = targetScroll;
    }
  }

  function buildCurrentTimeIndicator(minHour, maxHour, pxPerHour) {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    if (h < minHour || h > maxHour) return '';
    const topPx = ((h - minHour) + (m / 60)) * pxPerHour;
    return `
      <div class="mac-cal-current-time" style="top:${topPx}px">
        <div class="mac-cal-current-time-dot"></div>
        <div class="mac-cal-current-time-line"></div>
      </div>
    `;
  }

  function buildEventCard(ev, minHour, maxHour, pxPerHour) {
    const classModifier = getEventColorClass(ev.type);
    const index = state.events.indexOf(ev);

    const startH = ev.start.getHours();
    const startM = ev.start.getMinutes();
    let topPx = ((startH - minHour) + (startM / 60)) * pxPerHour;
    
    let diffMs = ev.end - ev.start;
    let durationHours = (diffMs / 60000) / 60;
    
    if (topPx < 0) {
      durationHours += (topPx / pxPerHour);
      topPx = 0;
    }
    
    const maxGridHeight = ((maxHour - minHour) + 1) * pxPerHour;
    const bottomPx = topPx + (durationHours * pxPerHour);
    if (bottomPx > maxGridHeight) {
      durationHours -= ((bottomPx - maxGridHeight) / pxPerHour);
    }
    
    if (durationHours <= 0) return '';
    
    const heightPx = Math.max(18, (durationHours * pxPerHour) - 2);
    const isThin = heightPx < 50;

    let innerHTML = '';
    if (isThin) {
      innerHTML = `
        <div class="mac-cal-event-inner">
          <div style="display: flex; align-items: center; justify-content: space-between; height: 100%;">
            <div class="mac-cal-event-title" title="${escapeHTML(ev.title)}" style="-webkit-line-clamp: 1; margin-bottom: 0;">${escapeHTML(ev.title)}</div>
            <div class="mac-cal-event-time" style="margin-top: 0; padding-left: 6px;">${formatTime(ev.start)}</div>
          </div>
        </div>
      `;
    } else {
      innerHTML = `
        <div class="mac-cal-event-inner">
          <div class="mac-cal-event-title" title="${escapeHTML(ev.title)}">${escapeHTML(ev.title)}</div>
          <div class="mac-cal-event-time">${formatTime(ev.start)} - ${formatTime(ev.end)}</div>
          ${ev.room ? `<div class="mac-cal-event-room">📍 ${escapeHTML(ev.room)}</div>` : ''}
        </div>
      `;
    }

    const numColumns = ev.numColumns || 1;
    const colIndex = ev.colIndex || 0;
    
    let widthStr = 'calc(100% - 4px)';
    let leftStr = '2px';
    if (numColumns > 1) {
       widthStr = `calc(${100 / numColumns}% - 4px)`;
       leftStr = `calc(${(100 / numColumns) * colIndex}% + 2px)`;
    }

    return `
      <div class="mac-cal-event ${classModifier} mye-open-modal-evt" style="top:${topPx}px; height:${heightPx}px; width:${widthStr}; left:${leftStr};" data-index="${index}">
        ${innerHTML}
      </div>
    `;
  }

  function attachEventModalListeners() {
    document.querySelectorAll('.mye-open-modal-evt').forEach(el => {
      el.addEventListener('click', () => {
        const index = el.getAttribute('data-index');
        openEventModal(index);
      });
    });
  }

  function openEventModal(index) {
    const ev = state.events[index];
    if (!ev) return;
    
    const headerText = document.getElementById('mye-em-header-text');
    if (headerText) {
      headerText.innerHTML = `
        ${ev.moduleCode ? `<div style="font-size:11px; color:rgba(255,255,255,0.8); font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">${escapeHTML(ev.moduleCode)}</div>` : ''}
        <div style="font-size: 18px; font-weight: 750; color: white; margin: 0; line-height: 1.25; letter-spacing: -0.01em;">${escapeHTML(ev.title)}</div>
      `;
    }
    
    // Set Header color matches event type color
    const modalHeader = document.querySelector('#mye-event-modal .mye-modal-header');
    if (modalHeader) {
      const typeKey = getEventFilterKey(ev.type);
      modalHeader.style.backgroundColor = userSettings.colors[typeKey] || '#8e8e93';
    }
    
    const body = document.getElementById('mye-em-body');
    if (body) {
      let actionButtons = [];
      
      // Parse description for Teams / Zoom / Moodle links
      let linkFound = ev.link;
      const description = ev.comments || '';
      
      if (!linkFound && description) {
        const match = description.match(/https:\/\/(?:teams\.microsoft\.com|teams\.cloud\.microsoft|zoom\.us|meet\.google\.com)[^\s"'}\\]+/i);
        if (match) linkFound = match[0];
      }

      if (linkFound) {
        const linkLower = linkFound.toLowerCase();
        if (linkLower.includes('teams.microsoft') || linkLower.includes('teams.cloud')) {
          actionButtons.push(`<a href="${linkFound}" target="_blank" class="mye-event-action-btn btn-teams"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M21 15.46L14 18V13.8L21 16.36V15.46ZM14 10.2L21 12.76V11.86L14 9.3V10.2ZM12 8.44V15.56L3 18V6L12 8.44Z"/></svg> Rejoindre Teams</a>`);
        } else if (linkLower.includes('zoom.us')) {
          actionButtons.push(`<a href="${linkFound}" target="_blank" class="mye-event-action-btn btn-zoom"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z"/><rect x="3" y="6" width="12" height="12" rx="2" ry="2"/></svg> Rejoindre Zoom</a>`);
        } else {
          actionButtons.push(`<a href="${linkFound}" target="_blank" class="mye-event-action-btn btn-link"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg> Lien externe</a>`);
        }
      }

      // Add course link if present
      if (ev.raw && ev.raw.courseid) {
        actionButtons.push(`<a href="/course/view.php?id=${ev.raw.courseid}" class="mye-event-action-btn btn-moodle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg> Accéder au cours</a>`);
      }
      
      const dateStr = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(ev.start);
      const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
      
      body.innerHTML = `
        <div class="mye-event-info-grid">
          <div class="mye-event-info-card-primary">
            <div class="card-label">Date et Heure</div>
            <div class="card-value">${cap(dateStr)}</div>
            <div class="card-subvalue">${formatTime(ev.start)} - ${formatTime(ev.end)}</div>
          </div>
          
          <div class="mye-event-info-card-primary" style="background-color: var(--ultra-surface-hover); color: var(--ultra-text-main); border: 1px solid var(--ultra-border); box-shadow: none;">
            <div class="card-label" style="color: var(--ultra-text-sub);">Catégorie</div>
            <div class="card-value" style="font-size: 16px;">${escapeHTML(ev.type)}</div>
          </div>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 4px;">
          ${ev.room ? `
          <div class="mye-event-info-card-secondary">
            <div class="card-icon">📍</div>
            <div class="card-details">
              <span class="label">Localisation</span>
              <span class="value" title="${escapeHTML(ev.room)}">${escapeHTML(ev.room)}</span>
            </div>
          </div>` : ''}

          ${ev.moduleCode ? `
          <div class="mye-event-info-card-secondary">
            <div class="card-icon">📚</div>
            <div class="card-details">
              <span class="label">Code Matière</span>
              <span class="value">${escapeHTML(ev.moduleCode)}</span>
            </div>
          </div>` : ''}
        </div>
        
        ${description ? `
        <div style="background: var(--ultra-surface-hover); border-radius: 12px; padding: 12px 16px; display: flex; flex-direction: column; gap: 6px; border: 1px solid var(--ultra-border); margin-top: 4px;">
          <span style="font-size: 9.5px; font-weight: 700; color: var(--ultra-text-sub); text-transform: uppercase; letter-spacing: 0.05em;">Description / Notes</span>
          <div style="font-size: 13px; color: var(--ultra-text-main); line-height: 1.4; word-break: break-word;">${description}</div>
        </div>` : ''}
        
        ${actionButtons.length > 0 ? `
        <div style="display:flex; gap: 8px; flex-wrap: wrap; margin-top: 4px;">
          ${actionButtons.join('')}
        </div>` : ''}
      `;
    }
    
    document.getElementById('mye-event-modal').style.display = 'flex';
  }

  function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Initialize and Run ---
  function initMoodleCalendar() {
    console.log('[myMoodle ULTRA] Initializing Apple-Style Moodle Calendar...');
    loadSettings(() => {
      buildPageStructure();
      applyColors();
      loadPlanningForPeriod(state.currentDate);
      fetchFutureEvents();
    });
  }

  // Bind to window so main.js can access
  window.isCalendarPage = isCalendarPage;
  window.initMoodleCalendar = initMoodleCalendar;

  // Add click handlers outside modal to close it
  document.addEventListener('click', (e) => {
    const settingsModal = document.getElementById('mye-settings-modal');
    if (settingsModal && settingsModal.style.display === 'flex') {
      if (e.target === settingsModal) {
        settingsModal.style.display = 'none';
      }
    }
  });

})();
