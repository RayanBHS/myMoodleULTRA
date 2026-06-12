/* myMoodle ULTRA - Document Viewer Core Logic */

(function () {
  'use strict';

  // State variable to track active PPTX rendering instance
  let activePptxRenderer = null;
  let currentSlideIndex = 0;
  let totalSlides = 0;
  let zoomScale = 1.0;
  let isFullscreen = false;

  /**
   * Helper to clean memory and close viewer
   */
  function closeDocumentViewer() {
    const backdrop = document.getElementById('ultramoodle-doc-viewer');
    if (!backdrop) return;

    // Fade out animation
    backdrop.classList.remove('visible');
    
    // Exit fullscreen if active
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    // Clean up active PPTX renderer
    if (activePptxRenderer) {
      try {
        activePptxRenderer.destroy();
      } catch (err) {
        console.error('[myMoodle ULTRA] Error destroying pptx renderer:', err);
      }
      activePptxRenderer = null;
    }

    // Remove event listeners
    document.removeEventListener('keydown', handleGlobalKeydown);

    // Remove from DOM after transition
    backdrop.addEventListener('transitionend', () => {
      backdrop.remove();
    }, { once: true });
  }

  /**
   * Global keydown navigation listener for PPTX
   */
  function handleGlobalKeydown(e) {
    const backdrop = document.getElementById('ultramoodle-doc-viewer');
    if (!backdrop) return;

    if (e.key === 'Escape') {
      closeDocumentViewer();
      e.preventDefault();
      return;
    }

    // PPTX Controls
    if (activePptxRenderer) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
        navigateSlide(1);
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        navigateSlide(-1);
        e.preventDefault();
      } else if (e.key === 'Home') {
        goToSlide(0);
        e.preventDefault();
      } else if (e.key === 'End') {
        goToSlide(totalSlides - 1);
        e.preventDefault();
      } else if (e.key === '+' || e.key === '=') {
        adjustZoom(0.1);
        e.preventDefault();
      } else if (e.key === '-') {
        adjustZoom(-0.1);
        e.preventDefault();
      } else if (e.key === '0') {
        resetZoom();
        e.preventDefault();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
        e.preventDefault();
      }
    }
  }

  /**
   * Navigate PPTX slides relative
   */
  function navigateSlide(direction) {
    const nextIndex = currentSlideIndex + direction;
    if (nextIndex >= 0 && nextIndex < totalSlides) {
      goToSlide(nextIndex);
    }
  }

  /**
   * Go to specific PPTX slide index
   */
  async function goToSlide(index) {
    if (!activePptxRenderer) return;
    
    currentSlideIndex = index;
    
    // Update main slide canvas
    const mainCanvas = document.getElementById('ultramoodle-viewer-pptx-canvas');
    if (mainCanvas) {
      // Show mini slide loader inside the container if needed
      try {
        await activePptxRenderer.renderSlide(currentSlideIndex, mainCanvas, 1280);
      } catch (err) {
        console.error('[myMoodle ULTRA] Error rendering slide:', currentSlideIndex, err);
      }
    }

    // Update active thumb classes
    const thumbs = document.querySelectorAll('.ultramoodle-viewer-thumb-wrapper');
    thumbs.forEach((thumb, idx) => {
      if (idx === index) {
        thumb.classList.add('active');
        // Scroll active thumb into view inside sidebar
        thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        thumb.classList.remove('active');
      }
    });

    // Update bottom page counter
    const pageIndicator = document.getElementById('ultramoodle-viewer-page-indicator');
    if (pageIndicator) {
      pageIndicator.textContent = `${currentSlideIndex + 1} / ${totalSlides}`;
    }

    // Update buttons disabled status
    const prevBtn = document.getElementById('ultramoodle-viewer-btn-prev');
    const nextBtn = document.getElementById('ultramoodle-viewer-btn-next');
    if (prevBtn) prevBtn.disabled = (currentSlideIndex === 0);
    if (nextBtn) nextBtn.disabled = (currentSlideIndex === totalSlides - 1);
  }

  /**
   * Adjust zoom scale of PPTX view
   */
  function adjustZoom(amount) {
    zoomScale = Math.max(0.5, Math.min(2.5, zoomScale + amount));
    applyZoom();
  }

  function resetZoom() {
    zoomScale = 1.0;
    applyZoom();
  }

  function applyZoom() {
    const canvas = document.getElementById('ultramoodle-viewer-pptx-canvas');
    if (canvas) {
      canvas.style.transform = `scale(${zoomScale})`;
      canvas.style.transformOrigin = 'center center';
      canvas.style.transition = 'transform 0.15s ease-out';
    }
  }

  /**
   * Toggle fullscreen mode
   */
  function toggleFullscreen() {
    const backdrop = document.getElementById('ultramoodle-doc-viewer');
    if (!backdrop) return;

    if (!document.fullscreenElement) {
      backdrop.requestFullscreen()
        .then(() => {
          isFullscreen = true;
          updateFullscreenButtonIcon();
        })
        .catch(err => {
          console.error('[myMoodle ULTRA] Fullscreen request error:', err);
        });
    } else {
      document.exitFullscreen()
        .then(() => {
          isFullscreen = false;
          updateFullscreenButtonIcon();
        });
    }
  }

  function updateFullscreenButtonIcon() {
    const btn = document.getElementById('ultramoodle-viewer-btn-fullscreen');
    if (!btn) return;
    
    if (document.fullscreenElement) {
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"></path>
        </svg>
      `;
      btn.title = "Quitter le plein écran (F)";
    } else {
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"></path>
        </svg>
      `;
      btn.title = "Plein écran (F)";
    }
  }

  // Handle browser's native fullscreen changes (e.g. if user presses ESC)
  document.addEventListener('fullscreenchange', () => {
    updateFullscreenButtonIcon();
  });

  /**
   * Core function to open document in overlay
   */
  window.openDocumentViewer = function (fileUrl, fileName, fileType) {
    console.log('[myMoodle ULTRA] openDocumentViewer:', fileUrl, fileName, fileType);
    
    // Close existing if any
    closeDocumentViewer();

    // Create container
    const backdrop = document.createElement('div');
    backdrop.id = 'ultramoodle-doc-viewer';
    backdrop.className = 'ultramoodle-viewer-backdrop';

    // Build base HTML structure
    const isPptx = fileType === 'powerpoint';
    const iconSrc = isPptx ? chrome.runtime.getURL('img/powerpointIcone.png') : chrome.runtime.getURL('img/wordIcone.png');

    backdrop.innerHTML = `
      <div class="ultramoodle-viewer-header">
        <div class="ultramoodle-viewer-title-group">
          <img class="ultramoodle-viewer-icon" src="${iconSrc}" alt="" />
          <h2 class="ultramoodle-viewer-title" title="${fileName}">${fileName}</h2>
        </div>
        <div class="ultramoodle-viewer-actions">
          <a href="${fileUrl}" class="ultramoodle-viewer-btn" download="${fileName}" id="ultramoodle-viewer-download-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3v12M12 15l-4-4M12 15l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"></path>
            </svg>
            Télécharger
          </a>
          <button class="ultramoodle-viewer-btn-close" id="ultramoodle-viewer-close-btn" aria-label="Fermer le lecteur">&times;</button>
        </div>
      </div>
      <div class="ultramoodle-viewer-body">
        <!-- Loader -->
        <div class="ultramoodle-viewer-loader" id="ultramoodle-viewer-loader">
          <div class="ultramoodle-viewer-spinner"></div>
          <div class="ultramoodle-viewer-loader-text" id="ultramoodle-viewer-loader-text">Téléchargement du document...</div>
          <div class="ultramoodle-viewer-loader-sub" id="ultramoodle-viewer-loader-sub">myMoodle ULTRA Reader</div>
        </div>

        <!-- Left sidebar for slides thumbs (PPTX only, hidden initially) -->
        ${isPptx ? `
        <div class="ultramoodle-viewer-sidebar" id="ultramoodle-viewer-sidebar" style="display: none;">
          <div class="ultramoodle-viewer-sidebar-title">Diapositives</div>
          <div id="ultramoodle-viewer-thumbs-list" style="display: flex; flex-direction: column; gap: 14px;"></div>
        </div>
        ` : ''}

        <!-- Document rendering target -->
        <div class="ultramoodle-viewer-content" id="ultramoodle-viewer-content">
          ${isPptx ? `
            <div class="ultramoodle-viewer-container-pptx" id="ultramoodle-viewer-container-pptx">
              <canvas class="ultramoodle-viewer-pptx-canvas" id="ultramoodle-viewer-pptx-canvas"></canvas>
            </div>
            
            <!-- Floating control toolbar -->
            <div class="ultramoodle-viewer-pptx-controls" id="ultramoodle-viewer-pptx-controls">
              <button class="ultramoodle-viewer-control-btn" id="ultramoodle-viewer-btn-prev" title="Diapositive précédente (← / PageUp)" disabled>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
              
              <span class="ultramoodle-viewer-page-indicator" id="ultramoodle-viewer-page-indicator">0 / 0</span>
              
              <button class="ultramoodle-viewer-control-btn" id="ultramoodle-viewer-btn-next" title="Diapositive suivante (→ / Espace / PageDown)">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
              
              <div class="ultramoodle-viewer-divider"></div>
              
              <button class="ultramoodle-viewer-control-btn" id="ultramoodle-viewer-btn-zoomout" title="Zoom arrière (-)">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
              </button>
              
              <button class="ultramoodle-viewer-control-btn" id="ultramoodle-viewer-btn-zoomin" title="Zoom avant (+)">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  <line x1="11" y1="8" x2="11" y2="14"></line>
                  <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
              </button>
              
              <button class="ultramoodle-viewer-control-btn" id="ultramoodle-viewer-btn-zoomreset" title="Taille réelle (0)">
                <span style="font-size: 10px; font-weight: 700;">100%</span>
              </button>
              
              <div class="ultramoodle-viewer-divider"></div>
              
              <button class="ultramoodle-viewer-control-btn" id="ultramoodle-viewer-btn-fullscreen" title="Plein écran (F)">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"></path>
                </svg>
              </button>
            </div>
          ` : `
            <div class="ultramoodle-viewer-docx-scrollable" id="ultramoodle-viewer-docx-scrollable">
              <div class="ultramoodle-viewer-container-docx" id="ultramoodle-viewer-container-docx"></div>
            </div>
          `}
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    
    // Force browser reflow and show modal
    setTimeout(() => {
      backdrop.classList.add('visible');
    }, 10);

    // Bind basic layout buttons
    document.getElementById('ultramoodle-viewer-close-btn').addEventListener('click', closeDocumentViewer);
    document.addEventListener('keydown', handleGlobalKeydown);

    // Click-outside-to-close: clicking the backdrop area (not header, sidebar, or document content) closes the viewer
    backdrop.addEventListener('click', (e) => {
      const target = e.target;
      
      // Close if clicking on the backdrop itself, the body, or the content area background
      const isBackdrop = target === backdrop;
      const isBody = target.classList.contains('ultramoodle-viewer-body');
      const isContent = target.classList.contains('ultramoodle-viewer-content');
      const isScrollable = target.classList.contains('ultramoodle-viewer-docx-scrollable');
      
      if (isBackdrop || isBody || isContent || isScrollable) {
        closeDocumentViewer();
      }
    });

    // Start fetch
    fetch(fileUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Erreur réseau : ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then(async (arrayBuffer) => {
        const loaderText = document.getElementById('ultramoodle-viewer-loader-text');
        if (loaderText) loaderText.textContent = "Rendu du document...";

        if (isPptx) {
          await renderPowerPoint(arrayBuffer);
        } else {
          await renderWord(arrayBuffer);
        }
      })
      .catch(err => {
        console.error('[myMoodle ULTRA] Error loading document:', err);
        const loader = document.getElementById('ultramoodle-viewer-loader');
        if (loader) {
          loader.innerHTML = `
            <div style="text-align: center; max-width: 400px; padding: 20px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px;">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <div class="ultramoodle-viewer-loader-text" style="color:#ef4444; font-weight:600;">Échec de l'affichage</div>
              <p style="font-size:12px; color:var(--ultra-text-sub); margin-top:8px;">Nous n'avons pas pu charger le fichier. Il est peut-être corrompu ou nécessite une authentification expirée.</p>
              <a href="${fileUrl}" class="ultramoodle-viewer-btn ultramoodle-viewer-btn-primary" style="margin-top:16px; width: 100%;" download="${fileName}">
                Télécharger le document
              </a>
            </div>
          `;
        }
      });
  };

  /**
   * Word (DOCX) Renderer using docx-preview
   */
  async function renderWord(arrayBuffer) {
    const container = document.getElementById('ultramoodle-viewer-container-docx');
    const loader = document.getElementById('ultramoodle-viewer-loader');

    if (!container) return;

    try {
      // Clear native docx-preview elements just in case
      container.innerHTML = '';
      
      // Global variable "docx" injected via docx-preview.js
      if (typeof docx === 'undefined') {
        throw new Error("Bibliothèque docx-preview non trouvée.");
      }

      await docx.renderAsync(arrayBuffer, container);
      
      // Remove loading indicator
      if (loader) loader.remove();
    } catch (err) {
      throw err;
    }
  }

  /**
   * PowerPoint (PPTX) Renderer using pptx-browser (PptxCanvasRenderer)
   */
  async function renderPowerPoint(arrayBuffer) {
    const loader = document.getElementById('ultramoodle-viewer-loader');
    const loaderText = document.getElementById('ultramoodle-viewer-loader-text');
    const sidebar = document.getElementById('ultramoodle-viewer-sidebar');
    const thumbsList = document.getElementById('ultramoodle-viewer-thumbs-list');
    const pptxContainer = document.getElementById('ultramoodle-viewer-container-pptx');
    const controls = document.getElementById('ultramoodle-viewer-pptx-controls');

    try {
      if (typeof PptxCanvasRenderer === 'undefined') {
        throw new Error("Bibliothèque PptxCanvasRenderer non trouvée.");
      }

      const renderer = new PptxCanvasRenderer.PptxRenderer();
      activePptxRenderer = renderer;

      // Load PPTX content (updates progress)
      await renderer.load(arrayBuffer, (progress, message) => {
        if (loaderText) {
          loaderText.textContent = `Chargement des diapos : ${Math.round(progress * 100)}%`;
        }
      });

      totalSlides = renderer.slideCount;
      if (totalSlides === 0) {
        throw new Error("Ce PowerPoint ne contient aucune diapositive.");
      }

      // 1. Show layout areas
      if (sidebar) sidebar.style.display = 'flex';
      if (pptxContainer) pptxContainer.classList.add('loaded');
      if (controls) controls.classList.add('visible');

      // 2. Bind floating controls
      document.getElementById('ultramoodle-viewer-btn-prev').addEventListener('click', () => navigateSlide(-1));
      document.getElementById('ultramoodle-viewer-btn-next').addEventListener('click', () => navigateSlide(1));
      document.getElementById('ultramoodle-viewer-btn-zoomin').addEventListener('click', () => adjustZoom(0.15));
      document.getElementById('ultramoodle-viewer-btn-zoomout').addEventListener('click', () => adjustZoom(-0.15));
      document.getElementById('ultramoodle-viewer-btn-zoomreset').addEventListener('click', resetZoom);
      document.getElementById('ultramoodle-viewer-btn-fullscreen').addEventListener('click', toggleFullscreen);

      // 3. Render slide index 0 in main view
      await goToSlide(0);

      // Remove loading indicator
      if (loader) loader.remove();

      // 4. Generate sidebar thumbnails progressively to avoid UI freezing
      generateThumbnails(renderer, thumbsList);

    } catch (err) {
      throw err;
    }
  }

  /**
   * Helper to progressively generate slide thumbnails in sidebar
   */
  async function generateThumbnails(renderer, container) {
    if (!container || !renderer) return;
    
    container.innerHTML = '';
    
    // Draw empty shell items first
    for (let i = 0; i < totalSlides; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = `ultramoodle-viewer-thumb-wrapper ${i === 0 ? 'active' : ''}`;
      wrapper.dataset.index = i;
      
      const canvas = document.createElement('canvas');
      canvas.className = 'ultramoodle-viewer-thumb-canvas';
      wrapper.appendChild(canvas);
      
      const numLabel = document.createElement('div');
      numLabel.className = 'ultramoodle-viewer-thumb-number';
      numLabel.textContent = i + 1;
      wrapper.appendChild(numLabel);

      wrapper.addEventListener('click', () => {
        goToSlide(i);
      });

      container.appendChild(wrapper);
    }

    // Progressively render canvas content for thumbs
    for (let i = 0; i < totalSlides; i++) {
      // Stop rendering if user closed the viewer
      if (activePptxRenderer !== renderer) break;
      
      const wrapper = container.children[i];
      if (wrapper) {
        const canvas = wrapper.querySelector('canvas');
        if (canvas) {
          try {
            // Render small thumbnail (200px width is perfect for performance)
            await renderer.renderSlide(i, canvas, 200);
          } catch (err) {
            console.error('[myMoodle ULTRA] Error rendering thumb:', i, err);
          }
        }
      }
      
      // Let the browser breathe between renders
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  }

})();
