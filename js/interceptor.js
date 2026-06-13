// myMoodle ULTRA - Event Interceptor (Runs in MAIN world)
(function () {
  'use strict';

  console.log('[myMoodle ULTRA Interceptor] Injected in MAIN world. Location:', window.location.href);

  // Export Moodle config keys to document.documentElement synchronously
  const exportMoodleConfig = () => {
    try {
      if (window.M && window.M.cfg) {
        const sesskey = window.M.cfg.sesskey || '';
        const userid = window.M.cfg.userid || '';
        if (sesskey || userid) {
          console.log('[myMoodle ULTRA Interceptor] Found M.cfg keys:', { sesskey, userid });
          if (sesskey) {
            document.documentElement.setAttribute('data-moodle-sesskey', sesskey);
            sessionStorage.setItem('moodle_sesskey', sesskey);
          }
          if (userid) {
            document.documentElement.setAttribute('data-moodle-userid', userid);
            sessionStorage.setItem('moodle_userid', userid);
          }
        }
      }
    } catch (e) {
      console.error('[myMoodle ULTRA] Error exporting config:', e);
    }
  };

  const hookMConfig = (M_obj) => {
    if (!M_obj) return;
    
    let configObj = M_obj.cfg;
    
    const exportAndHookCfg = (cfg) => {
      if (!cfg) return;
      exportMoodleConfig();
      
      let sesskeyVal = cfg.sesskey;
      let useridVal = cfg.userid;
      
      try {
        Object.defineProperty(cfg, 'sesskey', {
          configurable: true,
          enumerable: true,
          get: () => sesskeyVal,
          set: (v) => {
            sesskeyVal = v;
            exportMoodleConfig();
          }
        });
      } catch (e) {
        console.warn('[myMoodle ULTRA Interceptor] Failed to define getter/setter for sesskey:', e);
      }
      
      try {
        Object.defineProperty(cfg, 'userid', {
          configurable: true,
          enumerable: true,
          get: () => useridVal,
          set: (v) => {
            useridVal = v;
            exportMoodleConfig();
          }
        });
      } catch (e) {
        console.warn('[myMoodle ULTRA Interceptor] Failed to define getter/setter for userid:', e);
      }
    };

    if (configObj) {
      exportAndHookCfg(configObj);
    }

    try {
      Object.defineProperty(M_obj, 'cfg', {
        configurable: true,
        enumerable: true,
        get: () => configObj,
        set: (val) => {
          configObj = val;
          exportAndHookCfg(configObj);
        }
      });
    } catch (e) {
      console.warn('[myMoodle ULTRA Interceptor] Failed to define getter/setter for M.cfg:', e);
    }
  };

  // Set up the window.M interceptor
  try {
    let moodleObj = window.M;
    if (moodleObj) {
      hookMConfig(moodleObj);
    }
    Object.defineProperty(window, 'M', {
      configurable: true,
      enumerable: true,
      get: () => moodleObj,
      set: (val) => {
        moodleObj = val;
        if (moodleObj) {
          hookMConfig(moodleObj);
        }
      }
    });
  } catch (e) {
    console.warn('[myMoodle ULTRA Interceptor] Failed to define getter/setter for window.M:', e);
  }

  // Run immediately
  exportMoodleConfig();

  // Run on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', exportMoodleConfig);

  // Run on window load
  window.addEventListener('load', exportMoodleConfig);

  // Interval check as a fallback (runs for 30 seconds)
  let checks = 0;
  const intervalId = setInterval(() => {
    checks++;
    exportMoodleConfig();
    if (window.M && window.M.cfg && window.M.cfg.sesskey && window.M.cfg.userid) {
      clearInterval(intervalId);
    } else if (checks > 300) {
      clearInterval(intervalId);
    }
  }, 100);

  const stopEvents = ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend'];
  
  stopEvents.forEach(evt => {
    window.addEventListener(evt, (e) => {
      let target = e.target;
      if (!target) return;

      // Resolve text nodes to parent element
      if (target.nodeType === 3) { // Node.TEXT_NODE
        target = target.parentElement;
      }
      if (!target || !target.closest) return;

      // 1. Intercept custom course preview buttons (.ultramoodle-btn-preview)
      const previewBtn = target.closest('.ultramoodle-btn-preview');
      if (previewBtn) {
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();

        if (evt === 'click') {
          window.dispatchEvent(new CustomEvent('ultramoodle-preview-click', {
            detail: {
              fileUrl: previewBtn.dataset.fileUrl,
              fileName: previewBtn.dataset.fileName,
              fileType: previewBtn.dataset.fileType,
              mode: previewBtn.dataset.mode
            }
          }));
        }
        return;
      }

      // 2. Intercept download links inside our modal (#ultramoodle-doc-viewer a[download])
      const downloadLink = target.closest('#ultramoodle-doc-viewer a[download]');
      if (downloadLink) {
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();

        if (evt === 'click') {
          window.dispatchEvent(new CustomEvent('ultramoodle-download-click', {
            detail: {
              fileUrl: downloadLink.href,
              fileName: downloadLink.download || downloadLink.getAttribute('download') || 'document'
            }
          }));
        }
        return;
      }

      // 3. Intercept toggle visualizer button inside our modal (#ultramoodle-viewer-btn-toggle-mode)
      const toggleBtn = target.closest('#ultramoodle-viewer-btn-toggle-mode');
      if (toggleBtn) {
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();

        if (evt === 'click') {
          window.dispatchEvent(new CustomEvent('ultramoodle-toggle-click', {
            detail: {
              fileUrl: toggleBtn.dataset.fileUrl,
              fileName: toggleBtn.dataset.fileName,
              fileType: toggleBtn.dataset.fileType
            }
          }));
        }
        return;
      }
    }, { capture: true, passive: false });
  });
})();
