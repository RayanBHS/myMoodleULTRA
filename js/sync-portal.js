(function() {
    'use strict';

    // Verify this is a RACYWAMA portal page
    const isRacywama = window.location.pathname.toLowerCase().includes('racywama') || 
                       window.location.pathname.toLowerCase().includes('mon-compte') ||
                       document.title.toLowerCase().includes('racywama') || 
                       document.getElementById('sidebar-logo') !== null ||
                       document.querySelector('.sidebar-logo-img') !== null;

    if (!isRacywama) return;

    // Set installation flag on document element so portal can detect extension is installed
    document.documentElement.dataset.mymoodleUltraInstalled = "true";

    console.log('[myMoodle ULTRA Sync] Content script active on portal page.');

    const portalKeys = [
        'mymoodle_user_enabled',
        'mymoodle_user_theme',
        'mymoodle_layout_pref',
        'mymoodle_course_header',
        'mymoodle_quick_filters',
        'mymoodle_user_viewer',
        'mymoodle_user_oneui',
        'mymoodle_user_handshake'
    ];

    // Read extension storage and sync to page localStorage
    function syncFromExtensionToPortal() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get({
                mymoodle_user_enabled: true,
                theme: 'light',
                layout: 'grid',
                courseHeader: true,
                quickFilters: true,
                viewer: true,
                oneui: true,
                handshake: true
            }, (data) => {
                if (chrome.runtime.lastError) {
                    console.error('[myMoodle ULTRA Sync] Error reading extension storage:', chrome.runtime.lastError);
                    return;
                }

                let changed = false;

                // 1. mymoodle_user_enabled
                if (data.mymoodle_user_enabled !== undefined && data.mymoodle_user_enabled !== null) {
                    const valStr = String(data.mymoodle_user_enabled);
                    if (localStorage.getItem('mymoodle_user_enabled') !== valStr) {
                        localStorage.setItem('mymoodle_user_enabled', valStr);
                        changed = true;
                    }
                }

                // 2. mymoodle_user_theme (mapped to theme)
                if (data.theme !== undefined && data.theme !== null) {
                    const valStr = String(data.theme);
                    if (localStorage.getItem('mymoodle_user_theme') !== valStr) {
                        localStorage.setItem('mymoodle_user_theme', valStr);
                        changed = true;
                    }
                }

                // 3. mymoodle_layout_pref (mapped to layout)
                if (data.layout !== undefined && data.layout !== null) {
                    const valStr = String(data.layout);
                    if (localStorage.getItem('mymoodle_layout_pref') !== valStr) {
                        localStorage.setItem('mymoodle_layout_pref', valStr);
                        changed = true;
                    }
                }

                // 4. mymoodle_course_header (mapped to courseHeader)
                if (data.courseHeader !== undefined && data.courseHeader !== null) {
                    const valStr = String(data.courseHeader);
                    if (localStorage.getItem('mymoodle_course_header') !== valStr) {
                        localStorage.setItem('mymoodle_course_header', valStr);
                        changed = true;
                    }
                }

                // 5. mymoodle_quick_filters (mapped to quickFilters)
                if (data.quickFilters !== undefined && data.quickFilters !== null) {
                    const valStr = String(data.quickFilters);
                    if (localStorage.getItem('mymoodle_quick_filters') !== valStr) {
                        localStorage.setItem('mymoodle_quick_filters', valStr);
                        changed = true;
                    }
                }

                // 6. mymoodle_user_viewer (mapped to viewer)
                if (data.viewer !== undefined && data.viewer !== null) {
                    const valStr = String(data.viewer);
                    if (localStorage.getItem('mymoodle_user_viewer') !== valStr) {
                        localStorage.setItem('mymoodle_user_viewer', valStr);
                        changed = true;
                    }
                }

                // 7. mymoodle_user_oneui (mapped to oneui)
                if (data.oneui !== undefined && data.oneui !== null) {
                    const valStr = String(data.oneui);
                    if (localStorage.getItem('mymoodle_user_oneui') !== valStr) {
                        localStorage.setItem('mymoodle_user_oneui', valStr);
                        changed = true;
                    }
                }

                // 8. mymoodle_user_handshake (mapped to handshake)
                if (data.handshake !== undefined && data.handshake !== null) {
                    const valStr = String(data.handshake);
                    if (localStorage.getItem('mymoodle_user_handshake') !== valStr) {
                        localStorage.setItem('mymoodle_user_handshake', valStr);
                        changed = true;
                    }
                }

                if (changed) {
                    console.log('[myMoodle ULTRA Sync] Local storage updated from extension.');
                    window.dispatchEvent(new CustomEvent('mye-sync-data'));
                }
            });
        }
    }

    // Run initial sync
    syncFromExtensionToPortal();

    // Listen for storage changes in the extension (real-time sync)
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local') {
                let changed = false;

                if (changes.mymoodle_user_enabled) {
                    const valStr = String(changes.mymoodle_user_enabled.newValue);
                    if (localStorage.getItem('mymoodle_user_enabled') !== valStr) {
                        localStorage.setItem('mymoodle_user_enabled', valStr);
                        changed = true;
                    }
                }

                if (changes.theme) {
                    const valStr = String(changes.theme.newValue);
                    if (localStorage.getItem('mymoodle_user_theme') !== valStr) {
                        localStorage.setItem('mymoodle_user_theme', valStr);
                        changed = true;
                    }
                }

                if (changes.layout) {
                    const valStr = String(changes.layout.newValue);
                    if (localStorage.getItem('mymoodle_layout_pref') !== valStr) {
                        localStorage.setItem('mymoodle_layout_pref', valStr);
                        changed = true;
                    }
                }

                if (changes.courseHeader) {
                    const valStr = String(changes.courseHeader.newValue);
                    if (localStorage.getItem('mymoodle_course_header') !== valStr) {
                        localStorage.setItem('mymoodle_course_header', valStr);
                        changed = true;
                    }
                }

                if (changes.quickFilters) {
                    const valStr = String(changes.quickFilters.newValue);
                    if (localStorage.getItem('mymoodle_quick_filters') !== valStr) {
                        localStorage.setItem('mymoodle_quick_filters', valStr);
                        changed = true;
                    }
                }

                if (changes.viewer) {
                    const valStr = String(changes.viewer.newValue);
                    if (localStorage.getItem('mymoodle_user_viewer') !== valStr) {
                        localStorage.setItem('mymoodle_user_viewer', valStr);
                        changed = true;
                    }
                }

                if (changes.oneui) {
                    const valStr = String(changes.oneui.newValue);
                    if (localStorage.getItem('mymoodle_user_oneui') !== valStr) {
                        localStorage.setItem('mymoodle_user_oneui', valStr);
                        changed = true;
                    }
                }

                if (changes.handshake) {
                    const valStr = String(changes.handshake.newValue);
                    if (localStorage.getItem('mymoodle_user_handshake') !== valStr) {
                        localStorage.setItem('mymoodle_user_handshake', valStr);
                        changed = true;
                    }
                }

                if (changed) {
                    console.log('[myMoodle ULTRA Sync] Real-time storage update from extension changes.');
                    window.dispatchEvent(new CustomEvent('mye-sync-data'));
                }
            }
        });
    }

    // Listen for saves from the portal to sync back to the extension
    window.addEventListener('mye-portal-save', (e) => {
        const { key, value } = e.detail || {};
        if (key && portalKeys.includes(key)) {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                const updateObj = {};
                const isBool = value === 'true' || value === 'false';
                const parsedValue = isBool ? (value === 'true') : value;

                if (key === 'mymoodle_user_enabled') {
                    updateObj['mymoodle_user_enabled'] = parsedValue;
                } else if (key === 'mymoodle_user_theme') {
                    updateObj['theme'] = parsedValue;
                } else if (key === 'mymoodle_layout_pref') {
                    updateObj['layout'] = parsedValue;
                } else if (key === 'mymoodle_course_header') {
                    updateObj['courseHeader'] = parsedValue;
                } else if (key === 'mymoodle_quick_filters') {
                    updateObj['quickFilters'] = parsedValue;
                } else if (key === 'mymoodle_user_viewer') {
                    updateObj['viewer'] = parsedValue;
                } else if (key === 'mymoodle_user_oneui') {
                    updateObj['oneui'] = parsedValue;
                } else if (key === 'mymoodle_user_handshake') {
                    updateObj['handshake'] = parsedValue;
                }

                chrome.storage.local.set(updateObj, () => {
                    console.log(`[myMoodle ULTRA Sync] Preferences synced back to extension: ${key} = ${value}`);
                });
            }
        }
    });

    // Handle clear/reset event
    window.addEventListener('mye-portal-reset', () => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.remove([
                'theme',
                'layout',
                'courseHeader',
                'quickFilters',
                'viewer',
                'oneui',
                'handshake'
            ], () => {
                console.log('[myMoodle ULTRA Sync] Settings reset in extension storage.');
            });
        }
    });
})();
