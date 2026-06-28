(function () {
  console.log('[myMoodle ULTRA] AI uploader content script loaded.');

  const base64ToFile = (base64, fileName, mimeType) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new File([bytes], fileName, { type: mimeType });
  };

  // Helper to find elements inside Shadow DOMs recursively
  const querySelectorDeep = (selector, root = document) => {
    const el = root.querySelector(selector);
    if (el) return el;
    
    const all = root.querySelectorAll('*');
    for (let i = 0; i < all.length; i++) {
      if (all[i].shadowRoot) {
        const found = querySelectorDeep(selector, all[i].shadowRoot);
        if (found) return found;
      }
    }
    return null;
  };

  const querySelectorAllDeep = (selector, root = document) => {
    let elements = Array.from(root.querySelectorAll(selector));
    
    const all = root.querySelectorAll('*');
    for (let i = 0; i < all.length; i++) {
      if (all[i].shadowRoot) {
        elements = elements.concat(querySelectorAllDeep(selector, all[i].shadowRoot));
      }
    }
    return elements;
  };

  chrome.storage.local.get('pendingAiShare', (data) => {
    const share = data.pendingAiShare;
    if (!share) return;

    // Check if the share has expired (older than 2 minutes)
    const now = Date.now();
    if (now - share.timestamp > 120000) {
      chrome.storage.local.remove('pendingAiShare');
      return;
    }

    const currentUrl = window.location.href;
    if (!currentUrl.includes(share.targetDomain)) {
      return;
    }

    // Clear storage so we don't repeat on reload
    chrome.storage.local.remove('pendingAiShare');

    // Reconstruct all files in the pending list
    let files = [];
    if (share.files && share.files.length > 0) {
      share.files.forEach(f => {
        if (f.base64 && f.base64.length > 0) {
          try {
            files.push(base64ToFile(f.base64, f.fileName, f.mimeType));
          } catch (err) {
            console.error('[myMoodle ULTRA] Failed to reconstruct file:', err);
          }
        }
      });
    } else if (share.base64 && share.base64.length > 0) {
      try {
        files.push(base64ToFile(share.base64, share.fileName, share.mimeType));
      } catch (err) {
        console.error('[myMoodle ULTRA] Failed to reconstruct single file:', err);
      }
    }

    console.log('[myMoodle ULTRA] Found pending files sharing count:', files.length);

    // Wait for elements to appear in DOM
    const maxAttempts = 80; // 24 seconds max
    let attempts = 0;

    const tryInject = () => {
      attempts++;
      
      const fileInput = querySelectorDeep('input[type="file"]');
      
      // Look for any text inputs (cross Shadow DOM borders for Gemini)
      const textInput = querySelectorDeep('#prompt-textarea') || 
                        querySelectorDeep('textarea') || 
                        querySelectorDeep('rich-textarea div[contenteditable="true"]') ||
                        querySelectorDeep('div[contenteditable="true"]') ||
                        querySelectorDeep('div[role="textbox"]');

      const isGemini = window.location.href.includes('gemini.google.com');
      const isReady = isGemini ? textInput : (fileInput && textInput);

      if (textInput && (files.length === 0 || isReady)) {
        console.log('[myMoodle ULTRA] Input elements ready. Injecting...');

        // 1. Inject Files via inputs if present
        let filesInjectedViaInput = false;
        if (fileInput && files.length > 0) {
          const fileInputs = querySelectorAllDeep('input[type="file"]');
          fileInputs.forEach(input => {
            try {
              input.removeAttribute('accept');
              const dataTransfer = new DataTransfer();
              files.forEach(f => dataTransfer.items.add(f));
              input.files = dataTransfer.files;
              input.dispatchEvent(new Event('change', { bubbles: true }));
              fileInjectedViaInput = true;
            } catch (e) {
              console.error('[myMoodle ULTRA] File input change injection failed:', e);
            }
          });
        }

        // 2. Inject Files via Drop & Paste simulation (primarily for Gemini)
        if (files.length > 0 && (!fileInjectedViaInput || isGemini)) {
          try {
            const dropTarget = querySelectorDeep('rich-textarea') || 
                               querySelectorDeep('form') || 
                               textInput;
            
            const dataTransfer = new DataTransfer();
            files.forEach(f => dataTransfer.items.add(f));
            
            // Drop simulation
            const events = ['dragenter', 'dragover', 'drop'];
            const targets = [dropTarget, document.body, window];
            targets.forEach(target => {
              if (!target) return;
              events.forEach(eventName => {
                const dragEvent = new DragEvent(eventName, {
                  bubbles: true,
                  cancelable: true
                });
                Object.defineProperty(dragEvent, 'dataTransfer', {
                  value: dataTransfer,
                  writable: false
                });
                target.dispatchEvent(dragEvent);
              });
            });

            // Paste simulation
            const pasteEvent = new ClipboardEvent('paste', {
              bubbles: true,
              cancelable: true
            });
            Object.defineProperty(pasteEvent, 'clipboardData', {
              value: dataTransfer,
              writable: false
            });
            textInput.dispatchEvent(pasteEvent);

            console.log('[myMoodle ULTRA] Simulated file drop and paste events for multiple files.');
          } catch (e) {
            console.error('[myMoodle ULTRA] Drop/paste simulation failed:', e);
          }
        }

        // 3. Inject Prompt text
        textInput.focus();
        
        if (textInput.tagName === 'DIV') {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(textInput);
          range.collapse(false); // Collapse to end
          selection.removeAllRanges();
          selection.addRange(range);
          
          document.execCommand('insertText', false, share.prompt);
          
          // Trigger events
          textInput.dispatchEvent(new Event('input', { bubbles: true }));
          textInput.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          textInput.value = share.prompt;
          textInput.dispatchEvent(new Event('input', { bubbles: true }));
          textInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        console.log('[myMoodle ULTRA] Attachment and prompt injected successfully!');
      } else {
        if (attempts < maxAttempts) {
          setTimeout(tryInject, 300);
        } else {
          console.warn('[myMoodle ULTRA] Required input fields not found deep in DOM after timeout.');
        }
      }
    };

    tryInject();
  });
})();
