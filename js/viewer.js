/* myMoodle ULTRA - Document Viewer Core Logic */

(function () {
  'use strict';

  // State variables for PPTX/DOCX viewer modal
  let activePptxRenderer = null;
  let isFullscreen = false;
  let activeDocumentBuffer = null;
  let textModeParsed = false;
  let documentFileUrl = null;
  let documentFileName = null;
  let documentFileType = null;

  /**
   * Clean memory and close viewer modal
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

    // Reset state
    activeDocumentBuffer = null;
    textModeParsed = false;
    documentFileUrl = null;
    documentFileName = null;
    documentFileType = null;

    // Remove event listeners
    document.removeEventListener('keydown', handleGlobalKeydown);

    // Remove from DOM after transition
    backdrop.addEventListener('transitionend', () => {
      backdrop.remove();
    }, { once: true });
  }

  /**
   * Global keydown navigation listener for the modal
   */
  function handleGlobalKeydown(e) {
    const backdrop = document.getElementById('ultramoodle-doc-viewer');
    if (!backdrop) return;

    if (e.key === 'Escape') {
      closeDocumentViewer();
      e.preventDefault();
      return;
    }

    // T key to switch from Text Mode modal to Office Online (new tab)
    if (activeDocumentBuffer && (e.key === 't' || e.key === 'T')) {
      const fileUrl = documentFileUrl;
      const fileName = documentFileName;
      const fileType = documentFileType;
      closeDocumentViewer();
      window.openDocumentViewer(fileUrl, fileName, fileType, 'office');
      e.preventDefault();
    }

    // F key to toggle fullscreen
    if (e.key === 'f' || e.key === 'F') {
      toggleFullscreen();
      e.preventDefault();
    }
  }

  /**
   * Toggle fullscreen mode for the modal
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
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"></path>
        </svg>
      `;
      btn.title = "Quitter le plein écran (F)";
    } else {
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"></path>
        </svg>
      `;
      btn.title = "Plein écran (F)";
    }
  }

  // Handle browser's native fullscreen changes
  document.addEventListener('fullscreenchange', () => {
    updateFullscreenButtonIcon();
  });

  /**
   * Launch Office Online viewer in a new tab with background upload
   */
  function launchOfficeOnlineNewTab(fileUrl, fileName, fileType) {
    const isPptx = fileType === 'powerpoint';
    const mimeType = isPptx 
      ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const uploadFileName = isPptx ? 'presentation.pptx' : 'document.docx';
    const officeServiceLabel = isPptx ? 'PowerPoint Online' : 'Word Online';
    const docLabel = isPptx ? 'le diaporama' : 'le document';

    const newTab = window.open('', '_blank');
    if (newTab) {
      newTab.document.open();
      newTab.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Chargement myMoodle ULTRA...</title>
          <style>
            body {
              background-color: #0a0d14;
              color: #ffffff;
              font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
            }
            .spinner {
              width: 50px;
              height: 50px;
              border: 4px solid rgba(255, 138, 0, 0.08);
              border-left-color: #ff8a00;
              border-radius: 50%;
              animation: spin 0.8s cubic-bezier(0.5, 0.1, 0.4, 0.9) infinite;
              margin-bottom: 24px;
              box-shadow: 0 4px 10px rgba(255, 138, 0, 0.15);
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .status-text {
              font-size: 16px;
              font-weight: 500;
              letter-spacing: 0.25px;
              margin-bottom: 4px;
            }
            .sub-text {
              font-size: 12px;
              color: #8b95a5;
            }
            .btn {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              padding: 10px 22px;
              border-radius: 10px;
              border: 1px solid rgba(255, 255, 255, 0.1);
              background: rgba(255, 255, 255, 0.06);
              color: #ffffff;
              font-size: 13px;
              font-weight: 600;
              text-decoration: none;
              cursor: pointer;
              margin-top: 20px;
              transition: all 0.2s ease;
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
            }
            .btn:hover {
              background: rgba(255, 138, 0, 0.15);
              border-color: rgba(255, 138, 0, 0.4);
              color: #ff8a00;
            }
          </style>
        </head>
        <body>
          <div class="spinner" id="spinner"></div>
          <div class="status-text" id="status">Téléchargement du document depuis Moodle...</div>
          <div class="sub-text">myMoodle ULTRA Reader</div>
        </body>
        </html>
      `);
      newTab.document.close();
    }

    // Start background file fetch
    fetch(fileUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Erreur réseau : ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then(async (arrayBuffer) => {
        if (newTab) {
          const statusEl = newTab.document.getElementById('status');
          if (statusEl) statusEl.textContent = "Téléversement sécurisé (tmpfiles)...";
        }

        const blob = new Blob([arrayBuffer], { type: mimeType });
        const formData = new FormData();
        formData.append('file', blob, uploadFileName);

        const response = await fetch('https://tmpfiles.org/api/v1/upload', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error(`Erreur réseau : ${response.status}`);
        }

        const data = await response.json();
        if (data.status === 'success' && data.data && data.data.url) {
          const uploadUrl = data.data.url;
          const directUrl = uploadUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
          const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(directUrl)}`;
          
          if (newTab) {
            newTab.location.href = officeUrl;
          }
        } else {
          throw new Error(data.message || "Réponse invalide du serveur");
        }
      })
      .catch(err => {
        console.error('[myMoodle ULTRA] Error uploading document to tmpfiles.org:', err);
        if (newTab) {
          const body = newTab.document.body;
          body.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 20px;">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <div class="status-text" style="color:#ef4444; font-weight:600; font-size:18px;">Échec du visualiseur Office</div>
            <p style="font-size:13px; color:#8b95a5; margin: 8px 0 0 0; max-width: 380px; text-align: center; line-height: 1.5;">Le service n'a pas pu héberger temporairement ${docLabel}. Veuillez réessayer ou télécharger le fichier directement.</p>
            <a href="${fileUrl}" class="btn" download="${fileName}">Télécharger le document</a>
          `;
        }
      });
  }

  /**
   * Start extracting and rendering slide text locally in the modal
   */
  async function startTextModeView() {
    const loader = document.getElementById('ultramoodle-viewer-loader');
    const textContainer = document.getElementById('ultramoodle-viewer-pptx-textmode-container');
    const controls = document.getElementById('ultramoodle-viewer-pptx-controls');

    // Display text container
    if (textContainer) textContainer.style.display = 'block';

    try {
      if (typeof PptxCanvasRenderer === 'undefined') {
        throw new Error("Bibliothèque PptxCanvasRenderer non trouvée.");
      }

      if (!activePptxRenderer) {
        const renderer = new PptxCanvasRenderer.PptxRenderer();
        activePptxRenderer = renderer;
        await renderer.load(activeDocumentBuffer);
      }

      const allSlides = await activePptxRenderer.extractAll();
      
      let html = '';
      allSlides.forEach((slideData, idx) => {
        html += `
          <div class="ultramoodle-viewer-textmode-slide" id="slide-${idx}">
            <div class="ultramoodle-viewer-textmode-slide-header">Diapositive ${idx + 1}</div>
            ${formatSlideTextHtml(slideData)}
          </div>
        `;
      });

      textContainer.innerHTML = html;
      textModeParsed = true;

      if (loader) loader.style.display = 'none';
      if (controls) controls.classList.add('visible');
    } catch (err) {
      console.error('[myMoodle ULTRA] Error extracting presentation text:', err);
      textContainer.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--ultra-text-sub); display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <div style="font-size:15px; font-weight:600; color:#ef4444;">Échec de l'extraction</div>
          <p style="font-size:12px; margin-top:8px;">Nous n'avons pas pu extraire le texte de cette présentation.</p>
        </div>
      `;
      if (loader) loader.style.display = 'none';
      if (controls) controls.classList.add('visible');
    }
  }

  /**
   * Format slide contents as semantic styled HTML
   */
  function formatSlideTextHtml(slideData) {
    let html = '';
    
    // Slide title
    if (slideData.title) {
      html += `<h2 class="ultramoodle-viewer-textmode-title">${escapeHtml(slideData.title)}</h2>`;
    }
    
    // Slide subtitle
    if (slideData.subtitle) {
      html += `<h3 class="ultramoodle-viewer-textmode-subtitle">${escapeHtml(slideData.subtitle)}</h3>`;
    }
    
    // Slide text shapes
    const mainShapes = slideData.textShapes.filter(s => s.type !== 'title' && s.type !== 'subtitle');
    
    if (mainShapes.length > 0) {
      mainShapes.forEach(shape => {
        html += `<div class="ultramoodle-viewer-textmode-shape">`;
        shape.paragraphs.forEach(p => {
          const style = [];
          if (p.align === 'ctr') style.push('text-align: center');
          else if (p.align === 'r') style.push('text-align: right');
          else if (p.align === 'just') style.push('text-align: justify');
          
          let indent = (p.level || 0) * 20;
          if (indent > 0) style.push(`margin-left: ${indent}px`);
          
          const styleAttr = style.length ? ` style="${style.join('; ')}"` : '';
          
          html += `<p${styleAttr}>`;
          if (p.bullet && p.bullet !== '{auto}') {
            html += `<span class="ultramoodle-viewer-textmode-bullet">${escapeHtml(p.bullet)} </span>`;
          }
          
          p.runs.forEach(run => {
            let text = escapeHtml(run.text);
            if (run.bold) text = `<strong>${text}</strong>`;
            if (run.italic) text = `<em>${text}</em>`;
            if (run.underline) text = `<u>${text}</u>`;
            if (run.color && run.color !== '#000000' && run.color !== '#000' && run.color !== '#ffffff' && run.color !== '#fff') {
              text = `<span style="color: ${run.color}">${text}</span>`;
            }
            html += text;
          });
          html += `</p>`;
        });
        html += `</div>`;
      });
    }
    
    // Slide tables
    if (slideData.tables && slideData.tables.length > 0) {
      slideData.tables.forEach(table => {
        html += `<div class="ultramoodle-viewer-textmode-table-wrapper">`;
        html += `<table class="ultramoodle-viewer-textmode-table">`;
        table.rows.forEach(row => {
          html += `<tr>`;
          row.forEach(cell => {
            const tdAttr = [];
            if (cell.rowSpan > 1) tdAttr.push(`rowspan="${cell.rowSpan}"`);
            if (cell.colSpan > 1) tdAttr.push(`colspan="${cell.colSpan}"`);
            const tdAttrStr = tdAttr.length ? ' ' + tdAttr.join(' ') : '';
            
            html += `<td${tdAttrStr}>`;
            if (cell.paragraphs && cell.paragraphs.length > 0) {
              cell.paragraphs.forEach(p => {
                html += `<p>`;
                p.runs.forEach(run => {
                  let text = escapeHtml(run.text);
                  if (run.bold) text = `<strong>${text}</strong>`;
                  if (run.italic) text = `<em>${text}</em>`;
                  if (run.underline) text = `<u>${text}</u>`;
                  html += text;
                });
                html += `</p>`;
              });
            } else {
              html += escapeHtml(cell.text).replace(/\n/g, '<br>');
            }
            html += `</td>`;
          });
          html += `</tr>`;
        });
        html += `</table>`;
        html += `</div>`;
      });
    }
    
    // Speaker notes
    if (slideData.notes && slideData.notes.trim()) {
      html += `
        <div class="ultramoodle-viewer-textmode-notes">
          <div class="ultramoodle-viewer-textmode-notes-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            Notes de présentation
          </div>
          <div class="ultramoodle-viewer-textmode-notes-content">
            ${escapeHtml(slideData.notes).replace(/\n/g, '<br>')}
          </div>
        </div>
      `;
    }

    if (!html) {
      html = `
        <div style="padding: 16px 0; text-align: center; color: var(--ultra-text-sub); font-size: 13px;">
          Diapositive sans texte.
        </div>
      `;
    }
    
    return html;
  }
  
  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Word (DOCX) Renderer using docx-preview
   */
  async function renderWord(arrayBuffer) {
    const container = document.getElementById('ultramoodle-viewer-container-docx');
    const loader = document.getElementById('ultramoodle-viewer-loader');
    const controls = document.getElementById('ultramoodle-viewer-pptx-controls');

    if (!container) return;

    try {
      container.innerHTML = '';
      if (typeof docx === 'undefined') {
        throw new Error("Bibliothèque docx-preview non trouvée.");
      }
      await docx.renderAsync(arrayBuffer, container);
      if (loader) loader.style.display = 'none';
      if (controls) controls.classList.add('visible');
    } catch (err) {
      throw err;
    }
  }

  /**
   * Main global entry point to open overlay document viewer or launch a new tab
   */
  window.openDocumentViewer = function (fileUrl, fileName, fileType, initialMode = 'office') {
    console.log('[myMoodle ULTRA] openDocumentViewer:', fileUrl, fileName, fileType, initialMode);
    
    // If the user wants visuel (Office Online), open in a new tab and exit
    if (initialMode === 'office') {
      launchOfficeOnlineNewTab(fileUrl, fileName, fileType);
      return;
    }

    // Otherwise (Word or PPTX Text Mode), open in overlay modal
    closeDocumentViewer();

    // Cache local arguments
    documentFileUrl = fileUrl;
    documentFileName = fileName;
    documentFileType = fileType;

    // Create modal backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'ultramoodle-doc-viewer';
    backdrop.className = 'ultramoodle-viewer-backdrop';

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

        <!-- Document rendering target -->
        <div class="ultramoodle-viewer-content" id="ultramoodle-viewer-content">
          ${isPptx ? `
            <div class="ultramoodle-viewer-pptx-textmode-container" id="ultramoodle-viewer-pptx-textmode-container" style="display: none;"></div>
          ` : `
            <div class="ultramoodle-viewer-docx-scrollable" id="ultramoodle-viewer-docx-scrollable">
              <div class="ultramoodle-viewer-container-docx" id="ultramoodle-viewer-container-docx"></div>
            </div>
          `}
          
          <!-- Floating control toolbar -->
          <div class="ultramoodle-viewer-pptx-controls" id="ultramoodle-viewer-pptx-controls">
            <button class="ultramoodle-viewer-control-btn active" id="ultramoodle-viewer-btn-toggle-mode" title="Ouvrir dans Office Online (Office 365)" style="padding: 6px 12px !important; border-radius: 20px !important; display: inline-flex !important; align-items: center; gap: 8px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              <span id="ultramoodle-viewer-toggle-btn-text" style="font-size: 12px; font-weight: 600;">Visualiseur Office</span>
            </button>
            
            <div class="ultramoodle-viewer-divider"></div>
            
            <button class="ultramoodle-viewer-control-btn" id="ultramoodle-viewer-btn-fullscreen" title="Plein écran (F)">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    
    // Force browser reflow to display modal transitions
    setTimeout(() => {
      backdrop.classList.add('visible');
    }, 10);

    // Bind header control elements
    document.getElementById('ultramoodle-viewer-close-btn').addEventListener('click', closeDocumentViewer);
    document.addEventListener('keydown', handleGlobalKeydown);

    // Click backdrop to close (except when clicking viewer contents)
    backdrop.addEventListener('click', (e) => {
      const target = e.target;
      const isBackdrop = target === backdrop;
      const isBody = target.classList.contains('ultramoodle-viewer-body');
      const isContent = target.classList.contains('ultramoodle-viewer-content');
      const isScrollable = target.classList.contains('ultramoodle-viewer-docx-scrollable');
      
      if (isBackdrop || isBody || isContent || isScrollable) {
        closeDocumentViewer();
      }
    });

    // Start fetching file
    fetch(fileUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Erreur réseau : ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then(async (arrayBuffer) => {
        activeDocumentBuffer = arrayBuffer;
        
        // Bind toolbar buttons for the modal
        const toggleBtn = document.getElementById('ultramoodle-viewer-btn-toggle-mode');
        if (toggleBtn) {
          toggleBtn.addEventListener('click', () => {
            // Close modal and open in a new tab
            closeDocumentViewer();
            window.openDocumentViewer(fileUrl, fileName, fileType, 'office');
          });
        }
        const fsBtn = document.getElementById('ultramoodle-viewer-btn-fullscreen');
        if (fsBtn) {
          fsBtn.addEventListener('click', toggleFullscreen);
        }

        if (isPptx) {
          // Render local Text Mode
          const loaderText = document.getElementById('ultramoodle-viewer-loader-text');
          if (loaderText) loaderText.textContent = "Extraction du texte en cours (local)...";
          await startTextModeView();
        } else {
          const loaderText = document.getElementById('ultramoodle-viewer-loader-text');
          if (loaderText) loaderText.textContent = "Rendu du document Word...";
          await renderWord(arrayBuffer);
        }
      })
      .catch(err => {
        console.error('[myMoodle ULTRA] Error loading document:', err);
        const loader = document.getElementById('ultramoodle-viewer-loader');
        if (loader) {
          loader.innerHTML = `
            <div style="text-align: center; max-width: 400px; padding: 20px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px;">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <div class="ultramoodle-viewer-loader-text" style="color:#ef4444; font-weight:600;">Échec de la liseuse</div>
              <p style="font-size:12px; color:var(--ultra-text-sub); margin-top:8px;">Nous n'avons pas pu charger le fichier. Le document nécessite peut-être une authentification active ou est indisponible.</p>
              <a href="${fileUrl}" class="ultramoodle-viewer-btn ultramoodle-viewer-btn-primary" style="margin-top:16px; width: 100%; padding: 8px 16px;" download="${fileName}">
                Télécharger le document
              </a>
            </div>
          `;
        }
      });
  };

})();
