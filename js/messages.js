// myMoodle ULTRA - Samsung One UI Messages Redesign (Pure Custom Client)
(function() {
  'use strict';

  let currentUserId = 0;
  let currentSesskey = '';
  let activeConversationId = null;
  let activeOtherUserId = 0;
  let pollTimeout = null;
  let lastMessageCount = 0;
  let allConversations = [];
  let entertosendEnabled = true;
  let enabledProcessors = ['popup'];

  let ultraConversations = {};
  let activeReplyMessage = null;
  let activeConversationMessages = [];
  let handshakeSentThisSession = {};
  let _oneuiEnabled = localStorage.getItem('mymoodle_user_oneui') !== 'false';
  let _handshakeEnabled = localStorage.getItem('mymoodle_user_handshake') !== 'false';

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        if (changes.oneui) {
          _oneuiEnabled = changes.oneui.newValue !== false && changes.oneui.newValue !== 'false';
        }
        if (changes.handshake) {
          _handshakeEnabled = changes.handshake.newValue !== false && changes.handshake.newValue !== 'false';
        }
      }
    });
  }

  const loadUltraConversations = () => {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get('ultra_conversations', (res) => {
          ultraConversations = res.ultra_conversations || {};
          resolve(ultraConversations);
        });
      } else {
        resolve({});
      }
    });
  };

  const saveUltraConversations = () => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ 'ultra_conversations': ultraConversations });
    }
  };

  const detectAndProcessHandshake = async (messages, convid, otherUserId) => {
    if (!_handshakeEnabled) return;
    if (!messages || messages.length === 0) return;
    
    const otherSentCode = messages.some(msg => msg.useridfrom !== currentUserId && msg.text && msg.text.includes('ULTRA-xvfdgiencuuabusbbdubdeu-ULTRA'));
    const weSentCode = messages.some(msg => msg.useridfrom === currentUserId && msg.text && msg.text.includes('ULTRA-xvfdgiencuuabusbbdubdeu-ULTRA'));

    if (otherSentCode && weSentCode) {
      // BOTH have sent the code: mark conversation as ULTRA
      let changed = false;
      if (convid && !ultraConversations[convid]) {
        ultraConversations[convid] = true;
        changed = true;
      }
      if (otherUserId && !ultraConversations['user_' + otherUserId]) {
        ultraConversations['user_' + otherUserId] = true;
        changed = true;
      }
      if (changed) {
        saveUltraConversations();
        console.log('[myMoodle ULTRA] Handshake completed successfully! Conversation/User marked as ULTRA.', { convid, otherUserId });
      }
    } else {
      // Not both have sent the code: ensure it is NOT marked as ULTRA in storage (self-healing)
      let changed = false;
      if (convid && ultraConversations[convid]) {
        delete ultraConversations[convid];
        changed = true;
      }
      if (otherUserId && ultraConversations['user_' + otherUserId]) {
        delete ultraConversations['user_' + otherUserId];
        changed = true;
      }
      if (changed) {
        saveUltraConversations();
        console.log('[myMoodle ULTRA] Corrected conversation state: handshake not complete.', { convid, otherUserId });
      }

      // If other sent the code but we haven't: automatically send our code response
      if (otherSentCode && !weSentCode && convid) {
        try {
          if (!detectAndProcessHandshake.sendingResponse) {
            detectAndProcessHandshake.sendingResponse = true;
            await callMoodleAjax('core_message_send_messages_to_conversation', {
              conversationid: convid,
              messages: [
                {
                  text: '<span class="um-handshake-meta" style="display:none;">ULTRA-xvfdgiencuuabusbbdubdeu-ULTRA</span>',
                  textformat: 1
                }
              ]
            });
            console.log('[myMoodle ULTRA] Sent auto-handshake response.');
            detectAndProcessHandshake.sendingResponse = false;
          }
        } catch (e) {
          detectAndProcessHandshake.sendingResponse = false;
          console.warn('[myMoodle ULTRA] Failed to send auto-handshake response:', e);
        }
      }
    }
  };

  const sendReadReceipt = async (convId) => {
    if (!convId || !ultraConversations[convId]) return;
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      await callMoodleAjax('core_message_send_messages_to_conversation', {
        conversationid: convId,
        messages: [
          {
            text: `Ce message a été envoyé via mymoodle ultra. Ainsi, vous n'avez pas acces a la fonctionalitée utilisé par votre collègue - ULTRA-bbzbegcgdehzh-${timestamp}`,
            textformat: 1
          }
        ]
      });
      console.log('[myMoodle ULTRA] Sent read receipt for conversation', convId, 'at', timestamp);
    } catch (e) {
      console.warn('[myMoodle ULTRA] Failed to send read receipt:', e);
    }
  };

  const isControlMessage = (text) => {
    if (!text) return false;
    const plainText = text.replace(/<[^>]*>/g, '').trim();
    if (plainText === 'ULTRA-xvfdgiencuuabusbbdubdeu-ULTRA') return true;
    if (plainText.includes("Ce message a été envoyé via mymoodle ultra. Ainsi, vous n'avez pas acces a la fonctionalitée utilisé par votre collègue - ULTRA-bbzbegcgdehzh")) return true;
    return false;
  };

  const cleanMessageText = (text) => {
    if (!text) return '';
    let clean = text.replace(/<span[^>]*class="[^"]*um-handshake-meta[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '');
    clean = clean.replace(/<span[^>]*style="display:\s*none;?"[^>]*>ULTRA-xvfdgiencuuabusbbdubdeu-ULTRA<\/span>/gi, '');
    clean = clean.replace(/ULTRA-xvfdgiencuuabusbbdubdeu-ULTRA/g, '');
    
    clean = clean.replace(/<span[^>]*class="[^"]*um-reply-meta[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '');
    clean = clean.replace(/<span[^>]*style="display:\s*none;?"[^>]*>UM_REPLY:[A-Za-z0-9\+\/=]*<\/span>/gi, '');
    clean = clean.replace(/UM_REPLY:[A-Za-z0-9\+\/=]*/g, '');
    return clean.trim();
  };

  const setReplyToMessage = (msgId, text, senderId) => {
    const firstnameEl = document.querySelector('.oneui-chat-header-name');
    const lastnameEl = document.querySelector('.oneui-chat-header-lastname');
    const senderName = (senderId === currentUserId) 
      ? 'Vous' 
      : ((firstnameEl ? firstnameEl.textContent : '') + ' ' + (lastnameEl ? lastnameEl.textContent : '')).trim() || 'Collaborateur';
    
    const cleanText = text.replace(/<[^>]*>/g, '').replace(/UM_REPLY:[A-Za-z0-9\+\/=]*/gi, '').trim();
    const snippet = cleanText.length > 60 ? cleanText.substring(0, 60) + '...' : cleanText;
    
    activeReplyMessage = {
      id: msgId,
      sender: senderName,
      text: snippet
    };

    const replyBar = document.querySelector('.oneui-reply-preview-bar');
    const replySender = document.querySelector('.oneui-reply-preview-sender');
    const replyText = document.querySelector('.oneui-reply-preview-text');
    if (replyBar && replySender && replyText) {
      replySender.textContent = `Répondre à ${senderName}`;
      replyText.textContent = snippet;
      replyBar.style.display = 'flex';
    }

    const inputField = document.querySelector('.oneui-input-field');
    if (inputField) inputField.focus();
  };

  const cancelReply = () => {
    activeReplyMessage = null;
    const replyBar = document.querySelector('.oneui-reply-preview-bar');
    if (replyBar) replyBar.style.display = 'none';
  };

  // Helper to check Moodle message page
  const isMessagePage = () => {
    return window.location.pathname.includes('/message/index.php') || document.body.classList.contains('path-message') || document.getElementById('page-message-index') !== null;
  };

  // Safe Moodle AJAX call wrapper
  const callMoodleAjax = async (methodname, args) => {
    if (!currentSesskey || !currentUserId) {
      const config = extractMoodleConfig();
      if (config.sesskey) currentSesskey = config.sesskey;
      if (config.userid) currentUserId = config.userid;
    }
    if (!currentSesskey) {
      throw new Error('Moodle session key not loaded.');
    }
    const url = `${window.location.origin}/lib/ajax/service.php?sesskey=${currentSesskey}&info=${methodname}`;
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

  // Synchronously extracts the Moodle configuration from document attributes or fallback storage
  const extractMoodleConfig = () => {
    let sesskey = document.documentElement.getAttribute('data-moodle-sesskey');
    let userid = document.documentElement.getAttribute('data-moodle-userid');

    // Prioritize body class user ID above sessionStorage/attributes because body class is generated fresh by the server and is 100% immune to stale storage values!
    if (!userid || userid === '0') {
      const body = document.body;
      if (body) {
        const bodyClass = body.className || '';
        const m = bodyClass.match(/\buser-(\d+)\b/);
        if (m) userid = m[1];
      }
    }

    try {
      if (!sesskey) sesskey = sessionStorage.getItem('moodle_sesskey');
      if (!userid) userid = sessionStorage.getItem('moodle_userid');
    } catch (e) {
      console.warn('[myMoodle ULTRA] sessionStorage access blocked or unavailable:', e);
    }

    // 1. Try extracting from script tags text content (critical when main DOM is clearing/loading)
    if (!sesskey || !userid || userid === '0') {
      const scripts = document.getElementsByTagName('script');
      for (let i = 0; i < scripts.length; i++) {
        const content = scripts[i].textContent || '';
        
        // Prioritize parsing the M.cfg block specifically
        const cfgMatch = content.match(/M\.cfg\s*=\s*(\{[\s\S]*?\})/i);
        if (cfgMatch) {
          try {
            const parsed = JSON.parse(cfgMatch[1]);
            if (parsed.sesskey && !sesskey) sesskey = parsed.sesskey;
            if (parsed.userid && (!userid || userid === '0')) userid = String(parsed.userid);
          } catch (e) {
            // Fallback inside M.cfg block if JSON parsing fails
            const block = cfgMatch[1];
            if (!sesskey) {
              const m = block.match(/sesskey['"]?\s*[:=]\s*['"]([^'"]+)['"]/i);
              if (m) sesskey = m[1];
            }
            if (!userid || userid === '0') {
              const m = block.match(/userid['"]?\s*[:=]\s*['"]?(\d+)['"]?/i);
              if (m) userid = m[1];
            }
          }
        }
        
        // General fallback scan if still not resolved
        if (!sesskey) {
          const m = content.match(/sesskey['"]?\s*[:=]\s*['"]([^'"]+)['"]/i);
          if (m) sesskey = m[1];
        }
        if (!userid || userid === '0') {
          const m = content.match(/userid['"]?\s*[:=]\s*['"]?(\d+)['"]?/i);
          if (m) userid = m[1];
        }
      }
    }

    // 2. Try hidden input elements
    if (!sesskey) {
      const form = document.querySelector('input[name="sesskey"]');
      if (form) sesskey = form.value;
    }

    // 3. Try links containing sesskey
    if (!sesskey) {
      const link = document.querySelector('a[href*="sesskey="]');
      if (link) {
        const m = link.href.match(/sesskey=([^&"'\s>]+)/);
        if (m) sesskey = m[1];
      }
    }

    // Try logout links containing sesskey
    if (!sesskey) {
      const logoutLink = document.querySelector('a[href*="logout.php?sesskey="]');
      if (logoutLink) {
        const m = logoutLink.href.match(/sesskey=([^&"'\s>]+)/);
        if (m) sesskey = m[1];
      }
    }

    // Try body classes for userid (Moodle standard adds user-XXXX to body class)
    if (!userid || userid === '0') {
      const body = document.body;
      if (body) {
        const bodyClass = body.className || '';
        const m = bodyClass.match(/\buser-(\d+)\b/);
        if (m) userid = m[1];
      }
    }

    // Try extracting user ID from the user avatar image in the top-right menu (very robust as it is always present and specific to the logged-in user)
    if (!userid || userid === '0') {
      const avatarImg = document.querySelector('#usernavigation img.userpicture, .usermenu img.userpicture, #user-menu-toggle img.userpicture, .user_menu img.userpicture, .userpicture');
      if (avatarImg && avatarImg.src) {
        const m = avatarImg.src.match(/\/pix\.php\/(\d+)/);
        if (m) userid = m[1];
      }
    }

    // Try user menu links with userid= or id= query parameters (e.g. Preferences or Grades links)
    if (!userid || userid === '0') {
      const menuLink = document.querySelector([
        '#usernavigation a[href*="userid="]',
        '.usermenu a[href*="userid="]',
        '#user-menu-toggle a[href*="userid="]',
        '.user_menu a[href*="userid="]',
        '#usernavigation a[href*="/user/"][href*="id="]',
        '.usermenu a[href*="/user/"][href*="id="]',
        '#user-menu-toggle a[href*="/user/"][href*="id="]',
        '.user_menu a[href*="/user/"][href*="id="]',
        '#usernavigation a[href*="/grade/"][href*="id="]',
        '.usermenu a[href*="/grade/"][href*="id="]'
      ].join(', '));
      if (menuLink) {
        const m = menuLink.href.match(/(?:userid|id)=(\d+)/);
        if (m) userid = m[1];
      }
    }

    // 4. Try user profile/view links inside user menu for userid
    if (!userid || userid === '0') {
      const userLink = document.querySelector('#usernavigation a[href*="/user/profile.php"], .usermenu a[href*="/user/profile.php"], #user-menu-toggle a[href*="/user/profile.php"], .user_menu a[href*="/user/profile.php"]');
      if (userLink) {
        const m = userLink.href.match(/id=(\d+)/);
        if (m) userid = m[1];
      }
    }

    // Clean up literal string values if they were saved incorrectly
    if (sesskey === 'null' || sesskey === 'undefined') sesskey = '';
    if (userid === 'null' || userid === 'undefined') userid = '0';

    // Save back the verified correct values to sessionStorage and attributes as a cache/repair mechanism
    try {
      if (sesskey) {
        document.documentElement.setAttribute('data-moodle-sesskey', sesskey);
        sessionStorage.setItem('moodle_sesskey', sesskey);
      }
      if (userid && userid !== '0') {
        document.documentElement.setAttribute('data-moodle-userid', userid);
        sessionStorage.setItem('moodle_userid', userid);
      }
    } catch (e) {}

    return {
      sesskey: sesskey || '',
      userid: userid ? parseInt(userid, 10) : 0
    };
  };

  // Formatting timestamp helper
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    const now = new Date();
    
    // Check if today
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    
    // Check if yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Hier';
    }
    
    // Default format
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  // Helper to detect default Moodle avatars
  const isDefaultAvatar = (url) => {
    if (!url) return true;
    if (url.includes('/theme/') && (url.includes('/u/f1') || url.includes('/u/f2') || url.includes('/u/f'))) {
      return true;
    }
    if (url.includes('f1.png') || url.includes('f2.png')) {
      return true;
    }
    return false;
  };

  // Render conversation list helper
  const renderConversations = (conversations, filter = 'all', searchQuery = '', searchResult = null, isSearching = false) => {
    const listContainer = document.querySelector('.oneui-conv-list');
    if (!listContainer) return;

    let filtered = conversations || [];

    // Filter by tab
    if (filter === 'unread') {
      filtered = filtered.filter(c => (c.unreadcount || 0) > 0);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(c => {
        const members = c.members || [];
        const otherMember = members.find(m => m.id !== currentUserId) || members[0];
        const name = otherMember ? (otherMember.fullname || '') : (c.name || '');
        return name.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }

    if (filtered.length === 0 && !searchResult) {
      if (isSearching) {
        listContainer.innerHTML = `
          <div class="oneui-search-loading">
            <div class="oneui-spinner"></div>
            <span>Recherche dans l'annuaire...</span>
          </div>
        `;
      } else {
        listContainer.innerHTML = `<div class="oneui-empty-convs">Aucune conversation</div>`;
      }
      return;
    }

    listContainer.innerHTML = '';

    // Prepend AI conversation if the Chat extension is enabled and query matches
    const chatEnabled = document.documentElement.hasAttribute('data-myefrei-chat-enabled');
    const showAiConv = chatEnabled && (filter === 'all') && (!searchQuery || 'mymoodle ai'.includes(searchQuery.toLowerCase()) || 'moodle'.includes(searchQuery.toLowerCase()) || 'ai'.includes(searchQuery.toLowerCase()));
    
    if (showAiConv) {
      const aiItem = document.createElement('div');
      aiItem.className = `oneui-conv-item ${activeConversationId === 'ai' ? 'active' : ''}`;
      aiItem.dataset.id = 'ai';
      aiItem.dataset.name = 'myMoodle AI';
      
      const avatarHTML = `<img src="${chrome.runtime.getURL('img/logoMyHub.png')}" class="oneui-conv-avatar" alt="myMoodle AI">`;
      
      aiItem.innerHTML = `
        <div class="oneui-conv-avatar-wrapper">
          ${avatarHTML}
        </div>
        <div class="oneui-conv-details">
          <div class="oneui-conv-top-row">
            <div class="oneui-conv-name">myMoodle AI</div>
            <div class="oneui-conv-time"><span style="color: #4285f4; font-weight: bold; font-size: 11px;">✨ IA</span></div>
          </div>
          <div class="oneui-conv-bottom-row">
            <div class="oneui-conv-preview">Recherche intelligente Moodle...</div>
          </div>
        </div>
      `;
      
      aiItem.addEventListener('click', () => {
        selectConversation('ai', 'myMoodle AI', avatarHTML, 0);
      });
      
      listContainer.appendChild(aiItem);
    }
    
    // Render local conversations
    filtered.forEach(conv => {
      const members = conv.members || [];
      const otherMember = members.find(m => m.id !== currentUserId) || members[0];
      const name = otherMember ? (otherMember.fullname || 'Utilisateur Moodle') : (conv.name || 'Discussion');
      const avatarUrl = otherMember ? otherMember.profileimageurl : conv.imageurl;
      
      const lastMsg = conv.messages && conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;
      let lastMsgText = 'Pas de message';
      if (lastMsg && lastMsg.text) {
        lastMsgText = lastMsg.text.replace(/<[^>]*>/g, '');
        try {
          const doc = new DOMParser().parseFromString(lastMsgText, 'text/html');
          lastMsgText = doc.body.textContent || lastMsgText;
        } catch (e) {
          console.warn('[myMoodle ULTRA] Failed to parse HTML entities in last message:', e);
        }
      }
      const lastMsgTime = lastMsg ? formatTime(lastMsg.timecreated) : '';
      
      const isUnread = (conv.unreadcount || 0) > 0;
      const initials = name
        ? name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
        : 'U';

      const item = document.createElement('div');
      item.className = `oneui-conv-item ${activeConversationId === conv.id ? 'active' : ''} ${isUnread ? 'unread' : ''}`;
      item.dataset.id = conv.id;
      item.dataset.name = name;
      
      let avatarHTML = '';
      if (avatarUrl && !isDefaultAvatar(avatarUrl)) {
        avatarHTML = `<img src="${avatarUrl}" class="oneui-conv-avatar" alt="Avatar">`;
      } else {
        avatarHTML = `<div class="oneui-conv-avatar-initials">${initials}</div>`;
      }

      const statusBadgeHTML = isUnread ? `<span class="oneui-conv-status-badge"></span>` : '';

      item.innerHTML = `
        <div class="oneui-conv-avatar-wrapper">
          ${avatarHTML}
          ${statusBadgeHTML}
        </div>
        <div class="oneui-conv-details">
          <div class="oneui-conv-top-row">
            <div class="oneui-conv-name">${name}</div>
            <div class="oneui-conv-time">${lastMsgTime}</div>
          </div>
          <div class="oneui-conv-bottom-row">
            <div class="oneui-conv-preview">${lastMsgText}</div>
          </div>
        </div>
      `;

      item.addEventListener('click', () => {
        selectConversation(conv.id, name, avatarHTML, otherMember ? otherMember.id : 0);
      });

      listContainer.appendChild(item);
    });

    // If local results are displayed and we are actively querying the global directory
    if (isSearching && !searchResult) {
      const inlineLoader = document.createElement('div');
      inlineLoader.className = 'oneui-search-loading-inline';
      inlineLoader.innerHTML = `
        <div class="oneui-spinner small"></div>
        <span>Recherche globale...</span>
      `;
      listContainer.appendChild(inlineLoader);
    }

    // Render global search results if any
    const globalUsers = [];
    if (searchResult) {
      if (searchResult.contacts) globalUsers.push(...searchResult.contacts);
      if (searchResult.noncontacts) globalUsers.push(...searchResult.noncontacts);
    }

    if (globalUsers.length > 0) {
      // Get set of existing user IDs in local list to avoid duplicates
      const existingUserIds = new Set();
      conversations.forEach(c => {
        const members = c.members || [];
        const other = members.find(m => m.id !== currentUserId) || members[0];
        if (other) existingUserIds.add(other.id);
      });

      const uniqueGlobalUsers = globalUsers.filter(u => u.id !== currentUserId && !existingUserIds.has(u.id));

      if (uniqueGlobalUsers.length > 0) {
        const header = document.createElement('div');
        header.className = 'oneui-conv-section-header';
        header.textContent = 'Résultats de la recherche';
        listContainer.appendChild(header);

        uniqueGlobalUsers.forEach(user => {
          const name = user.fullname || 'Utilisateur Moodle';
          const initials = name
            ? name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
            : 'U';

          const item = document.createElement('div');
          item.className = `oneui-conv-item ${activeConversationId === null && activeOtherUserId === user.id ? 'active' : ''}`;
          item.dataset.userId = user.id;
          item.dataset.name = name;

          let avatarHTML = '';
          if (user.profileimageurl && !isDefaultAvatar(user.profileimageurl)) {
            avatarHTML = `<img src="${user.profileimageurl}" class="oneui-conv-avatar" alt="Avatar">`;
          } else {
            avatarHTML = `<div class="oneui-conv-avatar-initials">${initials}</div>`;
          }

          item.innerHTML = `
            <div class="oneui-conv-avatar-wrapper">
              ${avatarHTML}
            </div>
            <div class="oneui-conv-details">
              <div class="oneui-conv-top-row">
                <div class="oneui-conv-name">${name}</div>
                <div class="oneui-conv-time"></div>
              </div>
              <div class="oneui-conv-bottom-row">
                <div class="oneui-conv-preview">${user.iscontact ? 'Contact Moodle' : 'Annuaire Moodle'}</div>
              </div>
            </div>
          `;

          item.addEventListener('click', () => {
            selectConversation(null, name, avatarHTML, user.id);
          });

          listContainer.appendChild(item);
        });
      }
    }

    // If both local and global unique lists are empty
    if (listContainer.children.length === 0) {
      listContainer.innerHTML = `<div class="oneui-empty-convs">Aucune conversation</div>`;
    }
  };

  const updateSubtitle = (header, conversations) => {
    const subtitle = header.querySelector('.oneui-message-subtitle');
    if (!subtitle) return;
    
    const unreadCount = conversations.filter(c => c.unreadcount > 0).length;
    if (unreadCount > 0) {
      subtitle.textContent = `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`;
      subtitle.classList.add('has-unread');
    } else {
      subtitle.textContent = 'Tous les messages lus';
      subtitle.classList.remove('has-unread');
    }
  };

  const extractEmbedCards = (text) => {
    if (!text || !text.includes('#um-embed=')) {
      return { text, cardsHtml: '' };
    }
    
    try {
      // Strip bullet points preceding embed links (compatibility with messages already in database)
      let cleanTextStr = text
        .replace(/•\s*(?=<a[^>]*href="[^"]*#um-embed=)/g, '')
        .replace(/&bull;\s*(?=<a[^>]*href="[^"]*#um-embed=)/g, '')
        .replace(/•\s*(?=<span[^>]*>\s*<a[^>]*href="[^"]*#um-embed=)/g, '')
        .replace(/&bull;\s*(?=<span[^>]*>\s*<a[^>]*href="[^"]*#um-embed=)/g, '')
        .replace(/<br>\s*•\s*/g, '<br>')
        .replace(/<br>\s*&bull;\s*/g, '<br>');

      const parser = new DOMParser();
      const doc = parser.parseFromString(cleanTextStr, 'text/html');
      const links = doc.querySelectorAll('a[href*="#um-embed="]');
      
      if (links.length === 0) {
        return { text, cardsHtml: '' };
      }
      
      let cardsHtmlList = [];
      
      links.forEach(link => {
        try {
          const href = link.href;
          const hashMatch = href.match(/#um-embed=([A-Za-z0-9+/=]+)/);
          if (!hashMatch) return;
          
          const base64Data = hashMatch[1];
          const jsonStr = decodeURIComponent(escape(atob(base64Data)));
          const data = JSON.parse(jsonStr);
          
          if (!data || !data.name) return;
          
          let iconSvg = '';
          let iconBg = 'rgba(100, 116, 139, 0.1)';
          let iconColor = '#64748b';
          
          if (data.type === 'pdf') {
            iconSvg = `
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            `;
            iconBg = 'rgba(239, 68, 68, 0.12)';
            iconColor = '#ef4444';
          } else if (data.type === 'word') {
            iconSvg = `
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            `;
            iconBg = 'rgba(59, 130, 246, 0.12)';
            iconColor = '#3b82f6';
          } else if (data.type === 'excel') {
            iconSvg = `
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            `;
            iconBg = 'rgba(34, 197, 94, 0.12)';
            iconColor = '#22c55e';
          } else if (data.type === 'powerpoint') {
            iconSvg = `
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            `;
            iconBg = 'rgba(234, 88, 12, 0.12)';
            iconColor = '#ea580c';
          } else {
            iconSvg = `
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
            `;
            iconBg = 'rgba(100, 116, 139, 0.1)';
            iconColor = '#64748b';
          }
          
          const cleanFileUrl = href.split('#')[0];
          
          const cardHtml = `
            <div class="ultramoodle-message-embed-card" style="
              display: flex;
              align-items: center;
              gap: 12px;
              border-radius: 16px;
              padding: 12px;
              margin: 4px 0;
              width: 280px;
              max-width: 100%;
              cursor: pointer;
              box-sizing: border-box;
              transition: transform 0.2s, box-shadow 0.2s;
              text-align: left;
            " onmouseover="this.style.transform='translateY(-1px)';" onmouseout="this.style.transform='none';" onclick="window.open('${cleanFileUrl}', '_blank')">
              <div class="um-card-icon" style="
                width: 42px;
                height: 42px;
                border-radius: 12px;
                background-color: ${iconBg};
                color: ${iconColor};
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
              ">
                ${iconSvg}
              </div>
              <div style="
                display: flex;
                flex-direction: column;
                gap: 2px;
                min-width: 0;
                flex: 1;
              ">
                <div class="um-card-title" style="
                  font-weight: 700;
                  font-size: 13.5px;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  line-height: 1.3;
                " title="${data.name}">${data.name}</div>
                <div class="um-card-subtitle" style="
                  font-size: 11px;
                  font-weight: 600;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  opacity: 0.85;
                ">${data.subject || 'Fichier de cours'}</div>
              </div>
            </div>
          `;
          
          cardsHtmlList.push(cardHtml);
          link.parentNode.removeChild(link);
        } catch (innerErr) {
          console.warn('[myMoodle ULTRA] Error parsing link details:', innerErr);
        }
      });
      
      let cleanText = doc.body.innerHTML;
      cleanText = cleanText
        .replace(/<div>\s*<\/div>/g, '')
        .replace(/<p>\s*<\/p>/g, '')
        .replace(/(\s*<br>\s*)+$/g, '')
        .trim();

      return {
        text: cleanText,
        cardsHtml: `<div class="um-chat-cards-container" style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px;">` + cardsHtmlList.join('') + `</div>`
      };
    } catch (err) {
      console.warn('[myMoodle ULTRA] extractEmbedCards failed:', err);
      return { text, cardsHtml: '' };
    }
  };

  const renderMessages = (messages) => {
    const history = document.querySelector('.oneui-chat-history');
    if (!history) return;

    history.innerHTML = '';
    let lastDateStr = '';

    // Calculate last seen timestamp
    let lastSeenTimestamp = 0;
    messages.forEach(msg => {
      const isFromOther = msg.useridfrom !== currentUserId;
      if (isFromOther && msg.text) {
        if (msg.text.includes("Ce message a été envoyé via mymoodle ultra. Ainsi, vous n'avez pas acces a la fonctionalitée utilisé par votre collègue - ULTRA-bbzbegcgdehzh")) {
          const match = msg.text.match(/ULTRA-bbzbegcgdehzh-(\d+)/);
          if (match) {
            const ts = parseInt(match[1], 10);
            if (ts > lastSeenTimestamp) {
              lastSeenTimestamp = ts;
            }
          }
        }
      }
    });

    const isUltra = activeConversationId && ultraConversations[activeConversationId];

    messages.forEach(msg => {
      if (isControlMessage(msg.text)) return;

      const isSelf = msg.useridfrom === currentUserId;
      const cleanedText = cleanMessageText(msg.text);
      const { text, cardsHtml } = extractEmbedCards(cleanedText);
      
      const date = new Date(msg.timecreated * 1000);
      const dateStr = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      
      if (dateStr !== lastDateStr) {
        const dateHeader = document.createElement('div');
        dateHeader.className = 'oneui-chat-day-header';
        dateHeader.textContent = dateStr;
        history.appendChild(dateHeader);
        lastDateStr = dateStr;
      }

      const wrapper = document.createElement('div');
      wrapper.className = `oneui-message-wrapper ${isSelf ? 'self' : 'other'} ${isUltra ? 'ultra' : ''}`;
      
      const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

      // Detect if message is a pure GIF/image URL (Tenor CDN)
      const gifPattern = /^https?:\/\/(media\.tenor\.com|media1?\.giphy\.com|i\.giphy\.com)[^\s]+(\.gif|\/gif)[^\s]*$/i;
      const plainUrl = text.replace(/<[^>]+>/g, '').trim();
      let bubbleContent = '';
      if (gifPattern.test(plainUrl)) {
        bubbleContent = `<img src="${plainUrl}" class="oneui-message-gif" alt="GIF" loading="lazy">`;
      } else {
        bubbleContent = `<div class="oneui-message-text">${text}</div>`;
      }

      const hasText = text.replace(/&nbsp;/g, '').replace(/<br\s*\/?>/gi, '').trim().length > 0;

      let statusHTML = '';
      if (isSelf && isUltra) {
        if (msg.timecreated <= lastSeenTimestamp) {
          statusHTML = `
            <span class="oneui-message-status seen" title="Vu" style="margin-left: 4px; display: inline-flex; align-items: center; color: #1a73e8; vertical-align: middle;">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin: 0; vertical-align: middle;">
                <path d="M2 12l5.25 5 11.25-11"/>
                <path d="M8 12l5.25 5 11.25-11" style="transform: translateX(4px);"/>
              </svg>
            </span>
          `;
        } else {
          statusHTML = `
            <span class="oneui-message-status sent" title="Envoyé" style="margin-left: 4px; display: inline-flex; align-items: center; color: #8e8e93; vertical-align: middle;">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin: 0; vertical-align: middle;">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
          `;
        }
      }

      wrapper.id = `oneui-msg-${msg.id}`;

      let replyCardHtml = '';
      if (msg.text && msg.text.includes('UM_REPLY:')) {
        const match = msg.text.match(/UM_REPLY:([A-Za-z0-9\+\/=]+)/);
        if (match) {
          try {
            const base64Data = match[1];
            const jsonStr = decodeURIComponent(escape(atob(base64Data)));
            const replyData = JSON.parse(jsonStr);
            if (replyData && replyData.sender) {
              replyCardHtml = `
                <div class="oneui-message-reply-card" data-reply-to-id="${replyData.id}" style="
                  display: flex;
                  flex-direction: column;
                  gap: 2px;
                  padding: 6px 10px;
                  background-color: var(--ultra-surface);
                  border-left: 3px solid var(--ultra-accent);
                  border-radius: 8px;
                  margin-bottom: 4px;
                  font-size: 11px;
                  cursor: pointer;
                  opacity: 0.85;
                  transition: opacity 0.15s;
                  max-width: 250px;
                  text-align: left;
                " onmouseover="this.style.opacity='1';" onmouseout="this.style.opacity='0.85';">
                  <span style="font-weight: 700; color: var(--ultra-accent);">${replyData.sender}</span>
                  <span style="color: var(--ultra-text-sub); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${replyData.text}</span>
                </div>
              `;
            }
          } catch (e) {
            console.warn('[myMoodle ULTRA] Failed to parse reply metadata:', e);
          }
        }
      }

      const replyButtonHtml = `
        <button class="oneui-message-reply-btn" title="Répondre" style="
          background: none;
          border: none;
          color: var(--ultra-text-sub);
          cursor: pointer;
          padding: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.15s, color 0.15s;
          border-radius: 50%;
        " onmouseover="this.style.color='var(--ultra-accent)'; this.style.backgroundColor='var(--ultra-surface)';" onmouseout="this.style.color='var(--ultra-text-sub)'; this.style.backgroundColor='transparent';">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="margin: 0; transform: scaleX(-1);">
            <path d="M9 14L4 9l5-5"/>
            <path d="M4 9h10c3.87 0 7 3.13 7 7v1"/>
          </svg>
        </button>
      `;

      wrapper.innerHTML = `
        ${replyCardHtml}
        ${cardsHtml}
        <div class="oneui-message-bubble-row" style="display: flex; align-items: center; gap: 8px; width: 100%; justify-content: ${isSelf ? 'flex-end' : 'flex-start'};">
          ${isSelf ? replyButtonHtml : ''}
          ${hasText ? `
            <div class="oneui-message-bubble${gifPattern.test(plainUrl) ? ' oneui-bubble-gif' : ''}" style="margin: 0;">
              ${bubbleContent}
            </div>
          ` : ''}
          ${!isSelf ? replyButtonHtml : ''}
        </div>
        <div class="oneui-message-time" style="display: inline-flex; align-items: center; gap: 4px;">${timeStr}${statusHTML}</div>
      `;

      history.appendChild(wrapper);

      const replyBtn = wrapper.querySelector('.oneui-message-reply-btn');
      if (replyBtn) {
        replyBtn.addEventListener('click', () => {
          setReplyToMessage(msg.id, cleanedText, msg.useridfrom);
        });
      }

      const replyCard = wrapper.querySelector('.oneui-message-reply-card');
      if (replyCard) {
        replyCard.addEventListener('click', () => {
          const targetId = replyCard.dataset.replyToId;
          const targetEl = document.getElementById(`oneui-msg-${targetId}`);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetEl.classList.remove('flash-highlight');
            void targetEl.offsetWidth; // trigger reflow
            targetEl.classList.add('flash-highlight');
          }
        });
      }
    });

    history.scrollTop = history.scrollHeight;
  };

  const fetchAndRenderMessages = async () => {
    if (!activeConversationId) return;

    try {
      const result = await callMoodleAjax('core_message_get_conversation_messages', {
        currentuserid: currentUserId,
        convid: activeConversationId,
        limitnum: 50,
        limitfrom: 0,
        newest: false
      });

      if (!activeConversationId) return; // switched conversation

      const history = document.querySelector('.oneui-chat-history');
      if (!history) return;

      const messages = result.messages || [];
      activeConversationMessages = messages;

      if (activeConversationId) {
        await detectAndProcessHandshake(messages, activeConversationId, activeOtherUserId);
      }

      if (messages.length !== lastMessageCount || history.querySelector('.oneui-loading-messages')) {
        if (lastMessageCount > 0 && messages.length > lastMessageCount) {
          const lastMsg = messages[messages.length - 1];
          if (lastMsg && lastMsg.useridfrom !== currentUserId && ultraConversations[activeConversationId]) {
            sendReadReceipt(activeConversationId);
          }
        }
        renderMessages(messages);
        lastMessageCount = messages.length;
      }
    } catch (e) {
      console.error('Failed to fetch messages:', e);
    }

    if (activeConversationId) {
      pollTimeout = setTimeout(fetchAndRenderMessages, 4000);
    }
  };

  // AI chat rendering functions are now handled by the MyEfrei ULTRA - Chat extension.

  const selectConversation = async (convId, name, avatarHTML, otherUserId) => {
    activeConversationId = convId;
    activeOtherUserId = otherUserId;
    lastMessageCount = 0;
    activeConversationMessages = [];

    // Set highlight in list
    const items = document.querySelectorAll('.oneui-conv-item');
    items.forEach(item => {
      const rawId = item.dataset.id;
      const itemConvId = rawId === 'ai' ? 'ai' : (rawId ? parseInt(rawId, 10) : null);
      const itemUserId = item.dataset.userId ? parseInt(item.dataset.userId, 10) : null;

      if (convId === 'ai' && itemConvId === 'ai') {
        item.classList.add('active');
      } else if (convId && convId !== 'ai' && itemConvId === convId) {
        item.classList.add('active');
        const badge = item.querySelector('.oneui-conv-unread');
        if (badge) badge.remove();
      } else if (!convId && otherUserId && itemUserId === otherUserId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Handle mobile screen layout toggle
    if (window.innerWidth <= 768) {
      document.querySelector('.oneui-left-panel').style.display = 'none';
      document.querySelector('.oneui-right-panel').style.display = 'flex';
    }

    // Toggle layouts via class on the right panel parent
    const rightPanel = document.querySelector('.oneui-right-panel');
    if (rightPanel) {
      rightPanel.classList.add('oneui-chat-active');
    }

    // Update Header - split name into firstname/lastname
    const chatView = document.querySelector('.oneui-chat-view');
    const headerAvatar = chatView.querySelector('.oneui-chat-header-avatar');
    const headerName = chatView.querySelector('.oneui-chat-header-name');
    const headerLastname = chatView.querySelector('.oneui-chat-header-lastname');
    if (headerAvatar) headerAvatar.innerHTML = avatarHTML;

    // AI suggestions panel toggle and style adaptation
    const footer = chatView.querySelector('.oneui-chat-footer');
    const suggestionsContainer = chatView.querySelector('.ia-chatbot-suggestions');
    if (footer) {
      if (convId === 'ai') {
        footer.classList.add('oneui-ai-mode');
      } else {
        footer.classList.remove('oneui-ai-mode');
      }
    }
    if (suggestionsContainer) {
      if (convId === 'ai') {
        suggestionsContainer.style.setProperty('display', 'flex', 'important');
      } else {
        suggestionsContainer.style.setProperty('display', 'none', 'important');
      }
    }

    if (convId === 'ai') {
      if (headerName) headerName.textContent = 'myMoodle AI';
      if (headerLastname) headerLastname.textContent = '';
      if (pollTimeout) clearTimeout(pollTimeout);
      // Delegate AI rendering to the MyEfrei ULTRA - Chat extension via CustomEvent
      window.dispatchEvent(new CustomEvent('ultramoodle-ai-selected'));
      return;
    }

    // Moodle typically returns "LASTNAME Firstname" — split on first space
    if (headerName || headerLastname) {
      const parts = name.trim().split(' ');
      const firstname = parts.length > 1 ? parts.slice(1).join(' ') : name;
      const lastname = parts.length > 1 ? parts[0] : '';
      if (headerName) headerName.textContent = firstname;
      if (headerLastname) headerLastname.textContent = lastname;
    }

    const history = chatView.querySelector('.oneui-chat-history');
    if (history) {
      history.innerHTML = '<div class="oneui-loading-messages">Chargement des messages...</div>';
    }

    if (pollTimeout) clearTimeout(pollTimeout);

    if (convId) {
      fetchAndRenderMessages();

      // Mark as read in Moodle
      try {
        const conv = allConversations.find(c => c.id === convId);
        const wasUnread = conv && (conv.unreadcount > 0);
        if (wasUnread && ultraConversations[convId]) {
          sendReadReceipt(convId);
        }

        await callMoodleAjax('core_message_mark_all_conversation_messages_as_read', {
          userid: currentUserId,
          conversationid: convId
        });
        // Decrement unread local counts
        if (conv) {
          conv.unreadcount = 0;
          updateSubtitle(document.querySelector('.oneui-message-header'), allConversations);
        }
      } catch (e) {
        console.warn('Failed to mark conversation read:', e);
      }
    } else if (otherUserId) {
      // Try resolving conversation ID from otherUserId
      try {
        const result = await callMoodleAjax('core_message_get_conversation_between_users', {
          userid: currentUserId,
          otheruserid: otherUserId,
          includecontactrequests: true,
          includeprivacyinfo: true
        });
        if (result && result.id) {
          activeConversationId = result.id;
          fetchAndRenderMessages();
          return;
        }
      } catch (e) {
        console.log('[myMoodle ULTRA] No existing conversation with user, showing empty state:', e);
      }

      if (history) {
        history.innerHTML = '<div class="oneui-loading-messages">Aucun message. Envoyez un message pour démarrer la discussion.</div>';
      }
    }
  };

  const sendMessage = async () => {
    const input = document.querySelector('.oneui-input-field');
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    input.style.height = 'auto';

    if (activeConversationId === 'ai') {
      // Delegate message handling to the MyEfrei ULTRA - Chat extension via CustomEvent
      window.dispatchEvent(new CustomEvent('ultramoodle-ai-send-message', { detail: { text } }));
      return;
    }

    try {
      const isUltra = (activeConversationId && ultraConversations[activeConversationId]) || (activeOtherUserId && ultraConversations['user_' + activeOtherUserId]);
      
      const weAlreadySentHandshake = (activeConversationId && handshakeSentThisSession[activeConversationId]) || activeConversationMessages.some(msg => 
        msg.useridfrom === currentUserId && 
        msg.text && 
        msg.text.includes('ULTRA-xvfdgiencuuabusbbdubdeu-ULTRA')
      );

      let textWithHandshake = text;
      if (_handshakeEnabled && !isUltra && !weAlreadySentHandshake) {
        textWithHandshake += ' <span class="um-handshake-meta" style="display:none;">ULTRA-xvfdgiencuuabusbbdubdeu-ULTRA</span>';
        if (activeConversationId) {
          handshakeSentThisSession[activeConversationId] = true;
        }
      }

      if (activeReplyMessage) {
        try {
          const jsonStr = JSON.stringify({
            id: activeReplyMessage.id,
            sender: activeReplyMessage.sender,
            text: activeReplyMessage.text
          });
          const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
          textWithHandshake += ` <span class="um-reply-meta" style="display:none;">UM_REPLY:${base64}</span>`;
        } catch (err) {
          console.warn('[myMoodle ULTRA] Failed to construct reply metadata:', err);
        }
        cancelReply();
      }

      if (activeConversationId) {
        await callMoodleAjax('core_message_send_messages_to_conversation', {
          conversationid: activeConversationId,
          messages: [
            {
              text: textWithHandshake,
              textformat: 1 // HTML
            }
          ]
        });

        // Instantly load new messages
        if (pollTimeout) clearTimeout(pollTimeout);
        fetchAndRenderMessages();
      } else if (activeOtherUserId) {
        // Send initial message to user directly (which creates the conversation)
        await callMoodleAjax('core_message_send_instant_messages', {
          messages: [
            {
              touserid: activeOtherUserId,
              text: textWithHandshake,
              textformat: 1 // HTML
            }
          ]
        });

        // Wait a brief moment for Moodle to process, then query the newly created conversation ID
        setTimeout(async () => {
          try {
            const result = await callMoodleAjax('core_message_get_conversation_between_users', {
              userid: currentUserId,
              otheruserid: activeOtherUserId,
              includecontactrequests: true,
              includeprivacyinfo: true
            });
            if (result && result.id) {
              activeConversationId = result.id;
              
              // Refresh local conversations
              const conversationsResult = await callMoodleAjax('core_message_get_conversations', {
                userid: currentUserId,
                limitnum: 40,
                limitfrom: 0
              });
              allConversations = conversationsResult.conversations || [];
              
              // Re-render conversation list with search text if any
              const searchInput = document.querySelector('.oneui-search-input');
              const q = searchInput ? searchInput.value : '';
              renderConversations(allConversations, 'all', q);
              updateSubtitle(document.querySelector('.oneui-message-header'), allConversations);

              if (pollTimeout) clearTimeout(pollTimeout);
              fetchAndRenderMessages();
            }
          } catch (e) {
            console.error('Failed to resolve new conversation after sending message:', e);
          }
        }, 500);
      }
    } catch (e) {
      console.error('Failed to send message:', e);
      alert('Erreur lors de l\'envoi du message.');
    }
  };

  const customizeMoodleMessaging = async () => {
    if (!_oneuiEnabled) return;
    if (!isMessagePage()) return;
    if (document.querySelector('.oneui-messaging-app')) return;

    const mainRegion = document.querySelector('#region-main');
    if (!mainRegion) {
      return;
    }

    console.log('[myMoodle ULTRA] Performing complete One UI redesign...');

    // 1. Inject App Structure immediately (prepend to keep Moodle's native elements in DOM but hidden via CSS)
    const appContainer = document.createElement('div');
    appContainer.className = 'oneui-messaging-app';
    appContainer.innerHTML = `
      <div class="oneui-left-panel">
        <div class="oneui-top-navigation-pills">
          <a href="${window.location.origin}/my/" class="nav-pill pill-moodle">myMoodle</a>
          <a href="https://www.myefrei.fr/portal/student/home" target="_blank" class="nav-pill pill-efrei">myEfrei</a>
        </div>
        <div class="oneui-message-header">
          <div class="oneui-message-title-container">
            <h1 class="oneui-messages-title">Messages</h1>
          </div>
          <div class="oneui-search-bar-wrapper" style="display: none !important;">
            <span class="search-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </span>
            <input type="text" class="oneui-search-input" placeholder="Rechercher">
          </div>
          <div class="oneui-message-tabs-row">
            <div class="oneui-message-tabs">
              <button class="oneui-tab active" data-tab="all">Tout</button>
              <button class="oneui-tab" data-tab="unread">Non lus</button>
            </div>
            <div class="oneui-header-right-actions">
              <button class="oneui-search-toggle-btn" title="Rechercher">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </button>
              <div class="oneui-user-profile-btn" title="Profil">
                <div class="oneui-profile-inner">U</div>
              </div>
            </div>
          </div>
        </div>
        <div class="oneui-conv-list">
          <div class="oneui-loading-convs">Chargement des conversations...</div>
        </div>
        <div class="oneui-fab-container">
          ${document.documentElement.hasAttribute('data-myefrei-chat-enabled') ? `
          <button class="oneui-fab fab-ai" title="Recherche IA Moodle">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <path d="M11 8a3 3 0 0 1 3 3" stroke-width="2.5"/>
            </svg>
          </button>` : ''}
          <button class="oneui-fab fab-chat" title="Nouvelle discussion">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </button>
        </div>
      </div>
      <div class="oneui-right-panel">
        <div class="oneui-chat-placeholder">
          <img src="${chrome.runtime.getURL('img/myMessage.png')}" class="oneui-placeholder-logo" alt="myMessage">
          <h2>Message - myMoodle ULTRA</h2>
          <p>Sélectionnez une conversation pour commencer à envoyer des messages.</p>
        </div>
        <div class="oneui-chat-view" style="display: none;">
          <button class="oneui-back-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12,19 5,12 12,5"></polyline>
            </svg>
          </button>
          <div class="oneui-chat-header">
            <div class="oneui-chat-header-avatar"></div>
            <div class="oneui-chat-header-info">
              <div class="oneui-chat-header-name">Prénom</div>
              <div class="oneui-chat-header-lastname">Nom</div>
            </div>
          </div>
          <div class="oneui-chat-history"></div>
          <!-- Emoji / GIF Picker Popup -->
          <div class="oneui-picker-popup" style="display:none;">
            <div class="oneui-picker-tabs">
              <button class="oneui-picker-tab active" data-tab="emoji">😊 Emojis</button>
              <button class="oneui-picker-tab" data-tab="gif">GIF</button>
            </div>
            <div class="oneui-emoji-panel">
              <div class="oneui-emoji-categories"></div>
              <div class="oneui-emoji-grid"></div>
            </div>
            <div class="oneui-gif-panel" style="display:none;">
              <input class="oneui-gif-search" type="text" placeholder="Rechercher des GIFs…">
              <div class="oneui-gif-grid"></div>
            </div>
          </div>
          <div class="oneui-chat-footer" style="flex-direction: column !important; align-items: stretch !important;">
            <div class="ia-chatbot-suggestions" style="display: none; margin-bottom: 12px; width: 100%;"></div>
            <div class="oneui-reply-preview-bar" style="display: none; width: 100%; align-items: center; justify-content: space-between; padding: 8px 16px; background-color: var(--ultra-surface); border-radius: 14px; border: 1px solid var(--ultra-border); margin-bottom: 8px; box-sizing: border-box;">
              <div class="oneui-reply-preview-content" style="display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; text-align: left;">
                <span class="oneui-reply-preview-sender" style="font-size: 12px; font-weight: 700; color: var(--ultra-accent);">Répondre à ...</span>
                <span class="oneui-reply-preview-text" style="font-size: 12px; color: var(--ultra-text-sub); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Message snippet</span>
              </div>
              <button class="oneui-reply-preview-close" style="background: none; border: none; color: var(--ultra-text-sub); cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; transition: color 0.15s;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="margin: 0;">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div class="oneui-input-pill" style="display: flex; width: 100%; box-sizing: border-box;">
              <textarea class="oneui-input-field" placeholder="Message" rows="1"></textarea>
              <div class="oneui-input-icons">
                <span class="oneui-input-icon emoji" title="Emojis &amp; GIFs">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                    <line x1="9" y1="9" x2="9.01" y2="9"></line>
                    <line x1="15" y1="9" x2="15.01" y2="9"></line>
                  </svg>
                </span>
              </div>
              <button class="oneui-send-btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polyline points="22 2 15 22 11 13 2 9 22 2"></polyline>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- User Profile Settings Overlay Modal -->
      <div class="oneui-settings-overlay" style="display: none !important;">
        <div class="oneui-settings-card">
          <div class="oneui-settings-card-header">
            <h2 class="oneui-settings-card-title">Paramètres de messagerie</h2>
            <button class="oneui-settings-close-btn" title="Fermer">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          
          <div class="oneui-settings-card-body">
            <div class="oneui-settings-loading">
              <div class="oneui-spinner"></div>
              <span>Chargement des paramètres...</span>
            </div>

            <div class="oneui-settings-content" style="display: none;">
              <!-- Demandes de contact section -->
              <div class="oneui-settings-section">
                <h3>Demandes de contact</h3>
                <div class="oneui-contact-requests-list">
                  <!-- filled dynamically -->
                </div>
              </div>

              <!-- Confidentialité section -->
              <div class="oneui-settings-section">
                <h3>Confidentialité</h3>
                <p class="section-desc">Vous pouvez choisir qui peut vous envoyer un message personnel</p>
                <div class="oneui-radio-group">
                  <label class="oneui-radio-label">
                    <input type="radio" name="blocknoncontacts" value="1" class="oneui-privacy-radio">
                    <span>Mes contacts seulement</span>
                  </label>
                  <label class="oneui-radio-label">
                    <input type="radio" name="blocknoncontacts" value="2" class="oneui-privacy-radio">
                    <span>Mes contacts et tout le monde dans mes cours</span>
                  </label>
                </div>
              </div>

              <!-- Préférences de notification section -->
              <div class="oneui-settings-section">
                <h3>Préférences de notification</h3>
                <div class="oneui-toggle-row">
                  <span>Courriel</span>
                  <label class="oneui-switch">
                    <input type="checkbox" class="oneui-email-checkbox">
                    <span class="slider"></span>
                  </label>
                </div>
              </div>

              <!-- Général section -->
              <div class="oneui-settings-section">
                <h3>Général</h3>
                <div class="oneui-toggle-row">
                  <span>Taper entrée pour envoyer</span>
                  <label class="oneui-switch">
                    <input type="checkbox" class="oneui-enter-checkbox">
                    <span class="slider"></span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Chatbot overlay integrated natively into the One UI messaging page -->
    `;

    mainRegion.insertBefore(appContainer, mainRegion.firstChild);
    document.body.classList.add('oneui-message-page-active');

    // 1b. Resolve current user details for the top right profile button
    const avatarImg = document.querySelector('#usernavigation img.userpicture, .usermenu img.userpicture, #user-menu-toggle img.userpicture, .user_menu img.userpicture, .userpicture');
    let currentUserFullname = 'Utilisateur Moodle';
    let currentUserAvatarUrl = '';
    if (avatarImg) {
      currentUserAvatarUrl = avatarImg.src;
      const altText = avatarImg.alt || '';
      const nameMatch = altText.match(/(?:Profil de|Profile of)\s+(.+)/i);
      if (nameMatch) {
        currentUserFullname = nameMatch[1];
      } else if (altText) {
        currentUserFullname = altText;
      }
    } else {
      const nameEl = document.querySelector('.usertext, .username, .user-name, #user-menu-toggle, .user-menu-toggle');
      if (nameEl) {
        const text = nameEl.textContent.trim();
        if (text && text.toLowerCase() !== 'notifications' && text.toLowerCase() !== 'messages') {
          currentUserFullname = text;
        }
      }
    }
    const currentUserInitials = currentUserFullname
      ? currentUserFullname.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
      : 'U';

    const profileInner = appContainer.querySelector('.oneui-profile-inner');
    if (profileInner) {
      if (currentUserAvatarUrl && !isDefaultAvatar(currentUserAvatarUrl)) {
        profileInner.innerHTML = `<img src="${currentUserAvatarUrl}" alt="Profil">`;
      } else {
        profileInner.textContent = currentUserInitials;
      }
    }

    // 1c. Toggling the search bar wrapper
    const searchToggleBtn = appContainer.querySelector('.oneui-search-toggle-btn');
    const searchBarWrapper = appContainer.querySelector('.oneui-search-bar-wrapper');
    if (searchToggleBtn && searchBarWrapper) {
      searchToggleBtn.addEventListener('click', () => {
        const isHidden = searchBarWrapper.style.display === 'none' || searchBarWrapper.style.display === '' || searchBarWrapper.style.getPropertyValue('display') === 'none';
        if (isHidden) {
          searchBarWrapper.style.setProperty('display', 'flex', 'important');
          const input = searchBarWrapper.querySelector('.oneui-search-input');
          if (input) input.focus();
        } else {
          searchBarWrapper.style.setProperty('display', 'none', 'important');
        }
      });
    }

    // 1d. Clicking on the FAB chat button
    const fabChat = appContainer.querySelector('.fab-chat');
    if (fabChat) {
      fabChat.addEventListener('click', () => {
        if (searchBarWrapper) {
          searchBarWrapper.style.setProperty('display', 'flex', 'important');
          const input = searchBarWrapper.querySelector('.oneui-search-input');
          if (input) input.focus();
        }
      });
    }

    // 1e. Clicking on the AI Spark FAB button — switches to AI chatbot conversation
    const fabAi = appContainer.querySelector('.fab-ai');

    // ── Non-AI helpers (used for conversation list / search) ─────────────
    const normalizeStr = (s) => {
      if (!s) return '';
      let norm = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      norm = norm.replace(/([a-z])\s+(\d)/g, '$1$2').replace(/(\d)\s+([a-z])/g, '$1$2');
      return norm.replace(/[^a-z0-9\s]/g, ' ').trim();
    };

    const cleanCourseTitle = (fullname) => {
      if (!fullname) return '';
      const cleanRegex = /^\s*\*?\s*([A-Z0-9]+(?:-[A-Z0-9]+)*)\s*(?:-|\u2013|\u2014)\s*/i;
      return fullname.replace(cleanRegex, '').replace(/\s*\([^)]*\)\s*$/g, '').trim() || fullname;
    };

    const levenshtein = (a, b) => {
      const m = a.length, n = b.length;
      const dp = Array.from({length: m + 1}, (_, i) => Array.from({length: n + 1}, (_, j) => i === 0 ? j : j === 0 ? i : 0));
      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
        }
      }
      return dp[m][n];
    };

    // Returns a score 0-1 (higher = better match). Tests substring + fuzzy token match.
    const fuzzyScore = (query, target) => {
      if (!query || !target) return 0;
      const q = normalizeStr(query);
      const t = normalizeStr(target);
      if (!q || !t) return 0;

      // Synonym / Acronym expansion mapping
      const synonymGroups = [
        ["ce", "controle ecrit"],
        ["de", "dst", "devoir ecrit", "devoir sur table"],
        ["qcm", "question a choix multiple", "questionnaire a choix multiples", "choix multiples"],
        ["cm", "cours magistral"],
        ["td", "travaux diriges", "travail dirige"],
        ["tp", "travaux pratiques", "experience"],
        ["cc", "controle continu"]
      ];

      const hasTerm = (str, term) => {
        let idx = -1;
        while ((idx = str.indexOf(term, idx + 1)) !== -1) {
          const before = idx === 0 || str[idx - 1] === ' ';
          if (before) {
            const nextChar = str[idx + term.length];
            const isEnd = nextChar === undefined;
            const isSpace = nextChar === ' ';
            const isDigit = nextChar >= '0' && nextChar <= '9';
            
            if (isEnd || isSpace || isDigit) {
              // Special protection for grammatical French words "de" and "ce"
              if (term === "de" || term === "ce") {
                const isStart = idx === 0;
                if (isStart || isEnd || isDigit) {
                  return true;
                }
              } else {
                return true;
              }
            }
          }
        }
        return false;
      };

      for (const group of synonymGroups) {
        let qMatched = null;
        let tMatched = null;
        for (const item of group) {
          if (!qMatched && hasTerm(q, item)) qMatched = item;
          if (!tMatched && hasTerm(t, item)) tMatched = item;
        }
        if (qMatched && tMatched && qMatched !== tMatched) {
          return 0.95;
        }
      }

      // Specific groups to resolve Montreal/Toronto conflict
      const montrealGroup = [
        "montreal", "concordia", "concordia university", 
        "quebec", "yul", "hec montreal", "mcgill", "uqam", "vieux montreal", 
        "plateau mont royal", "guy concordia", "loyola campus", "sgw campus"
      ];
      const torontoGroup = [
        "toronto", "ilac", 
        "ontario", "yyz", "gta", "greater toronto area", "ilac international college", 
        "cn tower", "north york", "downtown toronto"
      ];

      const qHasMontreal = montrealGroup.some(item => hasTerm(q, item));
      const tHasMontreal = montrealGroup.some(item => hasTerm(t, item));
      const qHasToronto = torontoGroup.some(item => hasTerm(q, item));
      const tHasToronto = torontoGroup.some(item => hasTerm(t, item));

      const hasConflict = (qHasMontreal && tHasToronto) || (qHasToronto && tHasMontreal);

      if (!hasConflict) {
        const canadaGroup = ["canada", ...montrealGroup, ...torontoGroup];
        let qHasCanada = canadaGroup.some(item => hasTerm(q, item));
        let tHasCanada = canadaGroup.some(item => hasTerm(t, item));
        if (qHasCanada && tHasCanada) {
          return 0.95;
        }
      }

      // Other Destination / Study Abroad association mapping (without Canada to prevent duplicates)
      const destinationGroups = [
        [
          "etats unis", "usa", "us", "united states", "irvine", "uci", "california", "californie", 
          "university of california irvine", "orange county", "oc", "socal", "southern california", 
          "los angeles", "lax", "anteaters"
        ],
        [
          "hongrie", "budapest", "essca", "hungary", 
          "bud", "danube", "bme", "corvinus", "essca school of management", 
          "pest", "buda", "europe centrale"
        ],
        [
          "pologne", "varsovie", "warsaw", "agh", "agh university", "poland", 
          "waw", "cracovie", "krakow", "malopolska", "mazovie", "vistule", 
          "agh university of science and technology"
        ],
        [
          "republique tcheque", "tchequie", "tcheque", "ostrava", "vsb", "tuo", "vsb tuo", "czech", "czech republic", 
          "czechia", "boheme", "moravie", "silesie", "prague", "prg", "moravian silesian", "poruba"
        ],
        [
          "malaisie", "kuala lumpur", "kuala lampur", "apu", "asia pacific university", "malaysia", 
          "kl", "kul", "klcc", "selangor", "bukit jalil", "petronas", "asie du sud est"
        ],
        [
          "afrique du sud", "south africa", "cput", "cape peninsula", 
          "za", "cpt", "cape town", "le cap", "western cape", "peninsule du cap", 
          "bellville", "district six"
        ],
        [
          "inde", "india", "mahe", "manipal", 
          "bom", "del", "karnataka", "manipal academy of higher education", 
          "udupi", "bangalore", "bengaluru"
        ],
        [
          "chine", "china", "seu", "southeast university", 
          "nanjing", "nankin", "jiangsu", "pkin", "shanghai", "pvg", "nkg"
        ],
        [
          "angleterre", "uk", "royaume uni", "united kingdom", "staffordshire", "england", 
          "gb", "great britain", "stoke on trent", "midlands", "west midlands", "lhr", "london"
        ]
      ];

      for (const group of destinationGroups) {
        let qHas = false;
        let tHas = false;
        for (const item of group) {
          if (!qHas && hasTerm(q, item)) qHas = true;
          if (!tHas && hasTerm(t, item)) tHas = true;
        }
        if (qHas && tHas) {
          return 0.95;
        }
      }

      // Exact or contains (with word boundary / length protection for short queries)
      if (t === q) return 1;
      const isShort = q.length <= 3;
      const matchesSafeSubstring = isShort
        ? t.split(/\s+/).some(w => w.startsWith(q))
        : t.includes(q);
      if (matchesSafeSubstring) return 0.95;

      // Space-insensitive matching (strict equality when stripped to avoid false positives)
      const qStripped = q.replace(/\s+/g, '');
      const tStripped = t.replace(/\s+/g, '');
      if (qStripped && tStripped && qStripped === tStripped) {
        return 0.90;
      }

      // Word-level match
      const stopWords = new Set(['quand', 'est', 'ce', 'que', 'je', 'j', 'aurais', 'ai', 'un', 'une', 'des', 'le', 'la', 'les', 'du', 'de', 'en', 'pour', 'mes', 'mon', 'ma', 'ta', 'tes', 'son', 'ses', 'nous', 'vous', 'ils', 'elles', 'sont', 'ont', 'y', 'a', 't', 'il', 'elle', 'dans', 'avec', 'par', 'sur', 'pour', 'qui', 'quoi', 'dont', 'ou', 'comment', 'pourquoi', 'quel', 'quels', 'quelle', 'quelles', 'c', 'd', 'l', 's', 'm', 't', 'n']);
      const qWordsRaw = q.split(/\s+/).filter(Boolean);
      const qWordsFiltered = qWordsRaw.filter(w => !stopWords.has(w));
      const qWords = qWordsFiltered.length > 0 ? qWordsFiltered : qWordsRaw;
      const tWords = t.split(/\s+/).filter(Boolean);
      let wordHits = 0;
      for (const qw of qWords) {
        for (const tw of tWords) {
          const maxLen = Math.max(qw.length, tw.length);
          if (maxLen === 0) continue;
          const dist = levenshtein(qw, tw);
          // Protect short acronyms/words from false positive typo matching
          const threshold = qw.length <= 3 ? 0 : qw.length <= 5 ? 1 : qw.length <= 8 ? 2 : 3;
          
          // Prevent short grammatical words (like "de" and "ce" of length 2) in target from matching longer query words (like "devoir")
          const isPrefixMatch = qw.length >= 2 && tw.length >= 2 && (tw.startsWith(qw) || (tw.length >= 3 && qw.startsWith(tw)));
          const isSubstrMatch = qw.length >= 4 && tw.length >= 4 && (tw.includes(qw) || qw.includes(tw));
          
          if (dist <= threshold || isPrefixMatch || isSubstrMatch) { wordHits++; break; }
        }
      }
      if (wordHits === qWords.length) return 0.8;
      if (wordHits > 0) return 0.4 + (wordHits / qWords.length) * 0.3;
      // Overall string levenshtein fallback
      const dist = levenshtein(q, t.substring(0, Math.min(t.length, q.length + 10)));
      const norm = dist / Math.max(q.length, 1);
      return norm <= 0.4 ? Math.max(0, 0.4 - norm) : 0;
    };

    // ── Ensure userId is resolved before API calls ────────────────────
    const waitForUserId = () => new Promise((resolve, reject) => {
      if (currentUserId && currentUserId !== 0) { resolve(currentUserId); return; }
      let tries = 0;
      const check = () => {
        const cfg = extractMoodleConfig();
        if (cfg.sesskey) currentSesskey = cfg.sesskey;
        if (cfg.userid && cfg.userid !== 0) { currentUserId = cfg.userid; resolve(currentUserId); return; }
        if (currentUserId && currentUserId !== 0) { resolve(currentUserId); return; }
        tries++;
        if (tries > 50) { reject(new Error('Session Moodle non disponible. Reconnecte-toi.')); return; }
        setTimeout(check, 100);
      };
      check();
    });

    if (fabAi) {
      fabAi.addEventListener('click', () => {
        const aiAvatarHTML = `<img src="${chrome.runtime.getURL('img/logoMyHub.png')}" class="oneui-conv-avatar" alt="myMoodle AI">`;
        selectConversation('ai', 'myMoodle AI', aiAvatarHTML, 0);
      });
    }

    // All AI search functions (deepSearchMoodle, iaRenderResults, getAdaptedSuggestions, etc.)
    // have been moved to the MyEfrei ULTRA - Chat extension (js/chat.js).

    // 1f. Profile settings modal logic
    const profileBtn = appContainer.querySelector('.oneui-user-profile-btn');
    const settingsOverlay = appContainer.querySelector('.oneui-settings-overlay');
    const settingsCloseBtn = appContainer.querySelector('.oneui-settings-close-btn');
    
    const savePreference = async (name, value) => {
      try {
        await callMoodleAjax('core_user_update_user_preferences', {
          userid: currentUserId,
          preferences: [
            {
              type: name,
              value: String(value)
            }
          ]
        });
        console.log(`[myMoodle ULTRA] Successfully saved preference ${name} = ${value}`);
      } catch (e) {
        console.error(`[myMoodle ULTRA] Failed to save preference ${name}:`, e);
      }
    };

    if (profileBtn && settingsOverlay) {
      profileBtn.addEventListener('click', async () => {
        // Toggle overlay visibility
        settingsOverlay.style.setProperty('display', 'flex', 'important');
        
        // Show loading spinner
        const loadingEl = settingsOverlay.querySelector('.oneui-settings-loading');
        const contentEl = settingsOverlay.querySelector('.oneui-settings-content');
        if (loadingEl) loadingEl.style.display = 'flex';
        if (contentEl) contentEl.style.display = 'none';

        // Fetch settings and requests
        let requests = [];
        let blocknoncontacts = 0;
        let emailEnabled = false;
        let enterToSend = true;

        try {
          const reqResult = await callMoodleAjax('core_message_get_contact_requests', {
            userid: currentUserId
          });
          requests = reqResult || [];
        } catch (e) {
          console.warn('Failed to fetch contact requests:', e);
        }

        try {
          const prefsResult = await callMoodleAjax('core_message_get_user_message_preferences', {
            userid: currentUserId
          });
          if (prefsResult && prefsResult.preferences) {
            blocknoncontacts = prefsResult.preferences.blocknoncontacts || 0;
            
            // Check legacy message_provider_settings
            const providers = prefsResult.preferences.message_provider_settings || [];
            let instantMsgProvider = null;
            if (providers.length > 0) {
              instantMsgProvider = providers.find(p => p.component === 'moodle' && p.name === 'instantmessage');
            }

            if (instantMsgProvider && instantMsgProvider.processors) {
              const emailProc = instantMsgProvider.processors.find(proc => proc.name === 'email');
              if (emailProc) {
                emailEnabled = emailProc.loggedinstate === 'enabled' || emailProc.loggedoffstate === 'enabled';
              }
              const activeProcs = instantMsgProvider.processors.filter(proc => proc.loggedinstate === 'enabled' || proc.loggedoffstate === 'enabled');
              enabledProcessors = activeProcs.map(proc => proc.name);
            } else {
              // Moodle 4.x components structure
              const components = prefsResult.preferences.components || [];
              for (const comp of components) {
                if (comp.notifications) {
                  const notif = comp.notifications.find(n => n.preferencekey === 'message_provider_moodle_instantmessage');
                  if (notif && notif.processors) {
                    const emailProc = notif.processors.find(proc => proc.name === 'email');
                    if (emailProc) {
                      emailEnabled = emailProc.loggedinstate === 'enabled' || emailProc.loggedoffstate === 'enabled';
                    }
                    const activeProcs = notif.processors.filter(proc => proc.loggedinstate === 'enabled' || proc.loggedoffstate === 'enabled');
                    enabledProcessors = activeProcs.map(proc => proc.name);
                    break;
                  }
                }
              }
            }
          }
        } catch (e) {
          console.warn('Failed to fetch message preferences:', e);
        }

        try {
          const userPrefs = await callMoodleAjax('core_user_get_user_preferences', {
            userid: currentUserId
          });
          if (userPrefs && userPrefs.preferences) {
            const entertosendPref = userPrefs.preferences.find(p => p.name === 'message_entertosend');
            if (entertosendPref) {
              enterToSend = entertosendPref.value === '1';
            }
            
            // Fallbacks if blocknoncontacts was not resolved or default
            const blockPref = userPrefs.preferences.find(p => p.name === 'message_blocknoncontacts');
            if (blockPref && blocknoncontacts === 0) {
              blocknoncontacts = parseInt(blockPref.value, 10) || 0;
            }
            
            // Moodle 4.x flat list lookup for unified enabled processors
            const enabledPref = userPrefs.preferences.find(p => p.name === 'message_provider_moodle_instantmessage_enabled');
            if (enabledPref) {
              enabledProcessors = enabledPref.value.split(',').map(x => x.trim()).filter(Boolean);
              emailEnabled = enabledProcessors.includes('email');
            } else {
              // Fallback if emailEnabled was not resolved
              const emailLoggedinPref = userPrefs.preferences.find(p => p.name === 'message_provider_moodle_instantmessage_loggedin');
              if (emailLoggedinPref) {
                emailEnabled = emailLoggedinPref.value.includes('email');
                if (emailEnabled && !enabledProcessors.includes('email')) {
                  enabledProcessors.push('email');
                }
              }
            }
          }
        } catch (e) {
          console.warn('Failed to fetch user preferences:', e);
        }

        // Render contact requests
        const requestsContainer = settingsOverlay.querySelector('.oneui-contact-requests-list');
        if (requestsContainer) {
          requestsContainer.innerHTML = '';
          if (requests.length === 0) {
            requestsContainer.innerHTML = '<div class="oneui-no-requests">Aucune demande de contact</div>';
          } else {
            requests.forEach(req => {
              const div = document.createElement('div');
              div.className = 'oneui-request-item';
              const otherUser = req.user || req || {};
              const name = otherUser.fullname || 'Utilisateur';
              const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
              const avatarHTML = otherUser.profileimageurl && !isDefaultAvatar(otherUser.profileimageurl)
                ? `<img src="${otherUser.profileimageurl}" class="req-avatar" alt="Avatar">`
                : `<div class="req-avatar-initials">${initials}</div>`;
                
              div.innerHTML = `
                <div class="req-user-info">
                  ${avatarHTML}
                  <span class="req-fullname">${name}</span>
                </div>
                <div class="req-actions">
                  <button class="req-btn accept-btn" data-userid="${otherUser.id}">Accepter</button>
                  <button class="req-btn decline-btn" data-userid="${otherUser.id}">Décliner</button>
                </div>
              `;
              
              div.querySelector('.accept-btn').addEventListener('click', async () => {
                try {
                  await callMoodleAjax('core_message_confirm_contact_request', {
                    userid: currentUserId,
                    requesteduserid: otherUser.id
                  });
                  div.remove();
                  if (requestsContainer.children.length === 0) {
                    requestsContainer.innerHTML = '<div class="oneui-no-requests">Aucune demande de contact</div>';
                  }
                } catch (e) {
                  alert('Erreur lors de l\'acceptation de la demande : ' + e.message);
                }
              });
              
              div.querySelector('.decline-btn').addEventListener('click', async () => {
                try {
                  await callMoodleAjax('core_message_decline_contact_request', {
                    userid: currentUserId,
                    requesteduserid: otherUser.id
                  });
                  div.remove();
                  if (requestsContainer.children.length === 0) {
                    requestsContainer.innerHTML = '<div class="oneui-no-requests">Aucune demande de contact</div>';
                  }
                } catch (e) {
                  alert('Erreur lors du refus de la demande : ' + e.message);
                }
              });
              
              requestsContainer.appendChild(div);
            });
          }
        }

        // Set Privacy values
        const privacyRadios = settingsOverlay.querySelectorAll('.oneui-privacy-radio');
        privacyRadios.forEach(radio => {
          radio.checked = false;
          const val = parseInt(radio.value, 10);
          if (val === blocknoncontacts) {
            radio.checked = true;
          } else if (blocknoncontacts !== 1 && val === 2) {
            // Treat 0 or other course member codes as 2
            radio.checked = true;
          }
        });

        // Set Email values
        const emailCheckbox = settingsOverlay.querySelector('.oneui-email-checkbox');
        if (emailCheckbox) emailCheckbox.checked = emailEnabled;

        // Set Enter values
        const enterCheckbox = settingsOverlay.querySelector('.oneui-enter-checkbox');
        if (enterCheckbox) enterCheckbox.checked = enterToSend;

        // Display contents
        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';
      });
    }

    // Close button click
    if (settingsCloseBtn && settingsOverlay) {
      settingsCloseBtn.addEventListener('click', () => {
        settingsOverlay.style.setProperty('display', 'none', 'important');
      });
    }
    
    // Close when clicking overlay backdrop
    if (settingsOverlay) {
      settingsOverlay.addEventListener('click', (e) => {
        if (e.target === settingsOverlay) {
          settingsOverlay.style.setProperty('display', 'none', 'important');
        }
      });
    }

    // Listeners for setting updates
    if (settingsOverlay) {
      const privacyRadios = settingsOverlay.querySelectorAll('.oneui-privacy-radio');
      privacyRadios.forEach(radio => {
        radio.addEventListener('change', async () => {
          if (radio.checked) {
            const val = parseInt(radio.value, 10);
            await savePreference('message_blocknoncontacts', val);
          }
        });
      });

      const emailCheckbox = settingsOverlay.querySelector('.oneui-email-checkbox');
      if (emailCheckbox) {
        emailCheckbox.addEventListener('change', async () => {
          if (emailCheckbox.checked) {
            if (!enabledProcessors.includes('email')) {
              enabledProcessors.push('email');
            }
          } else {
            enabledProcessors = enabledProcessors.filter(p => p !== 'email');
          }
          // Filter out duplicates, defaults, and format
          const activeProcs = enabledProcessors.filter(p => p && p !== 'none');
          const val = activeProcs.length > 0 ? activeProcs.join(',') : 'none';
          
          // Save for Moodle 4.0+ (unified key)
          await savePreference('message_provider_moodle_instantmessage_enabled', val);
          // Save for legacy/Moodle 3.x (loggedin/loggedoff keys)
          await savePreference('message_provider_moodle_instantmessage_loggedin', val);
          await savePreference('message_provider_moodle_instantmessage_loggedoff', val);
        });
      }

      const enterCheckbox = settingsOverlay.querySelector('.oneui-enter-checkbox');
      if (enterCheckbox) {
        enterCheckbox.addEventListener('change', async () => {
          const val = enterCheckbox.checked ? '1' : '0';
          await savePreference('message_entertosend', val);
          entertosendEnabled = enterCheckbox.checked;
        });
      }
    }

    // 2. Setup scroll collapsible header listener
    const convListEl = appContainer.querySelector('.oneui-conv-list');
    if (convListEl) {
      convListEl.addEventListener('scroll', () => {
        const header = appContainer.querySelector('.oneui-message-header');
        if (header) {
          if (convListEl.scrollTop > 15) {
            header.classList.add('oneui-header-collapsed');
          } else {
            header.classList.remove('oneui-header-collapsed');
          }
        }
      }, { passive: true });
    }

    // 3. Attach search events
    const searchInput = appContainer.querySelector('.oneui-search-input');
    let searchDebounceTimeout = null;
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const q = searchInput.value;
        const activeTabEl = appContainer.querySelector('.oneui-tab.active');
        const activeTab = activeTabEl ? activeTabEl.dataset.tab : 'all';
        
        console.log('[myMoodle ULTRA] Search input changed to:', q);
        
        const showGlobalSearch = q.trim().length >= 2;
        // Render local results first for instant feedback, with loader if searching globally
        renderConversations(allConversations, activeTab, q, null, showGlobalSearch);

        if (searchDebounceTimeout) clearTimeout(searchDebounceTimeout);
        if (showGlobalSearch) {
          console.log('[myMoodle ULTRA] Debouncing search request for:', q.trim());
          searchDebounceTimeout = setTimeout(async () => {
            if (!currentUserId) {
              console.warn('[myMoodle ULTRA] Cannot perform global search because currentUserId is 0.');
              return;
            }
            try {
              console.log('[myMoodle ULTRA] Calling Moodle AJAX search APIs...');
              
              let usersResult = { contacts: [], noncontacts: [] };
              try {
                usersResult = await callMoodleAjax('core_message_message_search_users', {
                  userid: currentUserId,
                  search: q.trim(),
                  limitnum: 100
                });
              } catch (usersError) {
                console.warn('[myMoodle ULTRA] core_message_message_search_users failed:', usersError);
              }

              let messagesResult = { contacts: [] };
              try {
                messagesResult = await callMoodleAjax('core_message_data_for_messagearea_search_messages', {
                  userid: currentUserId,
                  search: q.trim(),
                  limitfrom: 0,
                  limitnum: 100
                });
              } catch (messagesError) {
                console.warn('[myMoodle ULTRA] core_message_data_for_messagearea_search_messages failed:', messagesError);
              }

              // Merge results
              const mergedContacts = [...(usersResult.contacts || [])];
              const mergedNonContacts = [...(usersResult.noncontacts || [])];

              if (messagesResult && messagesResult.contacts) {
                messagesResult.contacts.forEach(c => {
                  const id = c.userid || c.id;
                  const inContacts = mergedContacts.some(mc => (mc.id === id || mc.userid === id));
                  const inNonContacts = mergedNonContacts.some(mnc => (mnc.id === id || mnc.userid === id));
                  if (!inContacts && !inNonContacts) {
                    mergedNonContacts.push({
                      id: id,
                      fullname: c.fullname,
                      profileimageurl: c.profileimageurl,
                      profileimageurlsmall: c.profileimageurlsmall,
                      isonline: c.isonline,
                      showonlinestatus: c.showonlinestatus,
                      isblocked: c.isblocked,
                      iscontact: c.iscontact,
                      isdeleted: c.isdeleted
                    });
                  }
                });
              }
              // Check if query has changed during the API calls
              if (searchInput.value.trim() !== q.trim()) {
                console.log('[myMoodle ULTRA] Discarding search results because query has changed.');
                return;
              }

              const combinedResult = {
                contacts: mergedContacts,
                noncontacts: mergedNonContacts
              };

              console.log('[myMoodle ULTRA] Combined search results:', combinedResult);
              renderConversations(allConversations, activeTab, q.trim(), combinedResult, false);
            } catch (e) {
              console.error('[myMoodle ULTRA] Global user search failed:', e, 'currentUserId:', currentUserId, 'currentSesskey:', currentSesskey);
              renderConversations(allConversations, activeTab, q.trim(), null, false);
            }
          }, 400);
        }
      });
    }

    // 4. Attach tabs click events
    const tabs = appContainer.querySelectorAll('.oneui-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const filter = tab.dataset.tab;
        const q = searchInput ? searchInput.value : '';
        renderConversations(allConversations, filter, q);
      });
    });

    // 5. Attach input resizing and messaging buttons
    const inputField = appContainer.querySelector('.oneui-input-field');
    const sendBtn = appContainer.querySelector('.oneui-send-btn');
    if (inputField) {
      inputField.addEventListener('input', () => {
        inputField.style.height = 'auto';
        inputField.style.height = (inputField.scrollHeight - 4) + 'px';
      });
      inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          if (entertosendEnabled) {
            e.preventDefault();
            sendMessage();
          }
        }
      });
    }
    if (sendBtn) {
      sendBtn.addEventListener('click', sendMessage);
    }

    // 6. Emoji & GIF Picker
    const TENOR_KEY = 'LIVDSRZULELA';
    const EMOJI_DATA = {
      '😀': 'Smileys', '😃': 'Smileys', '😄': 'Smileys', '😁': 'Smileys', '😆': 'Smileys',
      '😅': 'Smileys', '🤣': 'Smileys', '😂': 'Smileys', '🙂': 'Smileys', '🙃': 'Smileys',
      '😉': 'Smileys', '😊': 'Smileys', '😇': 'Smileys', '🥰': 'Smileys', '😍': 'Smileys',
      '🤩': 'Smileys', '😘': 'Smileys', '😗': 'Smileys', '😋': 'Smileys', '😛': 'Smileys',
      '😜': 'Smileys', '🤪': 'Smileys', '😝': 'Smileys', '🤑': 'Smileys', '🤗': 'Smileys',
      '🤔': 'Smileys', '🤐': 'Smileys', '😐': 'Smileys', '😑': 'Smileys', '😶': 'Smileys',
      '😏': 'Smileys', '😒': 'Smileys', '🙄': 'Smileys', '😬': 'Smileys', '😌': 'Smileys',
      '😔': 'Smileys', '😪': 'Smileys', '😴': 'Smileys', '😷': 'Smileys', '🤒': 'Smileys',
      '🤕': 'Smileys', '🤢': 'Smileys', '🤮': 'Smileys', '🤧': 'Smileys', '🥵': 'Smileys',
      '🥶': 'Smileys', '🥴': 'Smileys', '😵': 'Smileys', '🤯': 'Smileys', '🤠': 'Smileys',
      '🥳': 'Smileys', '🥸': 'Smileys', '😎': 'Smileys', '🤓': 'Smileys', '🧐': 'Smileys',
      '😕': 'Smileys', '😟': 'Smileys', '🙁': 'Smileys', '☹️': 'Smileys', '😮': 'Smileys',
      '😯': 'Smileys', '😲': 'Smileys', '😳': 'Smileys', '🥺': 'Smileys', '😦': 'Smileys',
      '😧': 'Smileys', '😨': 'Smileys', '😰': 'Smileys', '😥': 'Smileys', '😢': 'Smileys',
      '😭': 'Smileys', '😱': 'Smileys', '😖': 'Smileys', '😣': 'Smileys', '😞': 'Smileys',
      '😓': 'Smileys', '😩': 'Smileys', '😫': 'Smileys', '🥱': 'Smileys', '😤': 'Smileys',
      '😡': 'Smileys', '😠': 'Smileys', '🤬': 'Smileys', '😈': 'Smileys', '👿': 'Smileys',
      '💀': 'Smileys', '☠️': 'Smileys', '💩': 'Smileys', '🤡': 'Smileys', '👻': 'Smileys',
      '👽': 'Smileys', '🤖': 'Smileys', '😺': 'Smileys', '😸': 'Smileys', '😹': 'Smileys',
      '😻': 'Smileys', '😼': 'Smileys', '😽': 'Smileys', '🙀': 'Smileys', '😿': 'Smileys',
      '👋': 'Gestes', '🤚': 'Gestes', '🖐': 'Gestes', '✋': 'Gestes', '🖖': 'Gestes',
      '👌': 'Gestes', '🤏': 'Gestes', '✌️': 'Gestes', '🤞': 'Gestes', '🤟': 'Gestes',
      '🤘': 'Gestes', '🤙': 'Gestes', '👈': 'Gestes', '👉': 'Gestes', '👆': 'Gestes',
      '👇': 'Gestes', '☝️': 'Gestes', '👍': 'Gestes', '👎': 'Gestes', '✊': 'Gestes',
      '👊': 'Gestes', '🤛': 'Gestes', '🤜': 'Gestes', '👏': 'Gestes', '🙌': 'Gestes',
      '🤝': 'Gestes', '🙏': 'Gestes', '💪': 'Gestes', '🦾': 'Gestes', '🫶': 'Gestes',
      '❤️': 'Cœurs', '🧡': 'Cœurs', '💛': 'Cœurs', '💚': 'Cœurs', '💙': 'Cœurs',
      '💜': 'Cœurs', '🖤': 'Cœurs', '🤍': 'Cœurs', '🤎': 'Cœurs', '💔': 'Cœurs',
      '❣️': 'Cœurs', '💕': 'Cœurs', '💞': 'Cœurs', '💓': 'Cœurs', '💗': 'Cœurs',
      '💖': 'Cœurs', '💘': 'Cœurs', '💝': 'Cœurs', '💟': 'Cœurs', '❤️‍🔥': 'Cœurs',
      '🐶': 'Animaux', '🐱': 'Animaux', '🐭': 'Animaux', '🐹': 'Animaux', '🐰': 'Animaux',
      '🦊': 'Animaux', '🐻': 'Animaux', '🐼': 'Animaux', '🐨': 'Animaux', '🐯': 'Animaux',
      '🦁': 'Animaux', '🐮': 'Animaux', '🐷': 'Animaux', '🐸': 'Animaux', '🐵': 'Animaux',
      '🙈': 'Animaux', '🙉': 'Animaux', '🙊': 'Animaux', '🐔': 'Animaux', '🐧': 'Animaux',
      '🦋': 'Animaux', '🐝': 'Animaux', '🐢': 'Animaux', '🦕': 'Animaux', '🦖': 'Animaux',
      '🍕': 'Nourriture', '🍔': 'Nourriture', '🌮': 'Nourriture', '🍜': 'Nourriture', '🍣': 'Nourriture',
      '🍩': 'Nourriture', '🎂': 'Nourriture', '🍰': 'Nourriture', '🍫': 'Nourriture', '🍿': 'Nourriture',
      '☕': 'Nourriture', '🧋': 'Nourriture', '🥤': 'Nourriture', '🍺': 'Nourriture', '🥂': 'Nourriture',
      '⚽': 'Sport', '🏀': 'Sport', '🏈': 'Sport', '⚾': 'Sport', '🎾': 'Sport',
      '🏐': 'Sport', '🎯': 'Sport', '🎮': 'Sport', '🕹': 'Sport', '🎲': 'Sport',
      '🚗': 'Voyage', '✈️': 'Voyage', '🚀': 'Voyage', '🛸': 'Voyage', '🏖': 'Voyage',
      '🌍': 'Voyage', '🌎': 'Voyage', '🌏': 'Voyage', '🗺': 'Voyage', '🏔': 'Voyage',
      '💯': 'Symboles', '🔥': 'Symboles', '✨': 'Symboles', '💥': 'Symboles', '🎉': 'Symboles',
      '🎊': 'Symboles', '🎈': 'Symboles', '🏆': 'Symboles', '🥇': 'Symboles', '⭐': 'Symboles',
      '🌟': 'Symboles', '💫': 'Symboles', '⚡': 'Symboles', '🌈': 'Symboles', '☀️': 'Symboles',
      '🌙': 'Symboles', '❄️': 'Symboles', '🔮': 'Symboles', '💎': 'Symboles', '👑': 'Symboles',
    };
    const EMOJI_CATS = {
      'Smileys': '😀', 'Gestes': '👋', 'Cœurs': '❤️', 'Animaux': '🐶',
      'Nourriture': '🍕', 'Sport': '⚽', 'Voyage': '✈️', 'Symboles': '🔥'
    };
    let currentEmojiCat = 'Smileys';

    const pickerPopup = appContainer.querySelector('.oneui-picker-popup');
    const emojiPanel = pickerPopup.querySelector('.oneui-emoji-panel');
    const gifPanel = pickerPopup.querySelector('.oneui-gif-panel');
    const emojiGrid = pickerPopup.querySelector('.oneui-emoji-grid');
    const emojiCatsEl = pickerPopup.querySelector('.oneui-emoji-categories');
    const gifGrid = pickerPopup.querySelector('.oneui-gif-grid');
    const gifSearch = pickerPopup.querySelector('.oneui-gif-search');
    const emojiBtn = appContainer.querySelector('.oneui-input-icon.emoji');

    const closePicker = () => { pickerPopup.style.display = 'none'; };

    // Build emoji category nav
    Object.entries(EMOJI_CATS).forEach(([cat, icon]) => {
      const btn = document.createElement('button');
      btn.className = 'oneui-emoji-cat-btn' + (cat === currentEmojiCat ? ' active' : '');
      btn.title = cat;
      btn.textContent = icon;
      btn.addEventListener('click', () => {
        currentEmojiCat = cat;
        emojiCatsEl.querySelectorAll('.oneui-emoji-cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderEmojiGrid();
      });
      emojiCatsEl.appendChild(btn);
    });

    const renderEmojiGrid = () => {
      emojiGrid.innerHTML = '';
      Object.entries(EMOJI_DATA)
        .filter(([, cat]) => cat === currentEmojiCat)
        .forEach(([emoji]) => {
          const btn = document.createElement('button');
          btn.className = 'oneui-emoji-btn';
          btn.textContent = emoji;
          btn.addEventListener('click', () => {
            if (inputField) {
              const pos = inputField.selectionStart;
              const val = inputField.value;
              inputField.value = val.slice(0, pos) + emoji + val.slice(pos);
              inputField.selectionStart = inputField.selectionEnd = pos + emoji.length;
              inputField.focus();
              inputField.dispatchEvent(new Event('input'));
            }
            closePicker();
          });
          emojiGrid.appendChild(btn);
        });
    };
    renderEmojiGrid();

    // Tenor GIF loader
    let gifDebounce = null;
    const loadGifs = async (query = '') => {
      gifGrid.innerHTML = '<div class="oneui-gif-loading">Chargement…</div>';
      const endpoint = query.trim()
        ? `https://api.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=${TENOR_KEY}&limit=24&media_filter=minimal`
        : `https://api.tenor.com/v1/trending?key=${TENOR_KEY}&limit=24&media_filter=minimal`;
      try {
        const resp = await fetch(endpoint);
        const data = await resp.json();
        gifGrid.innerHTML = '';
        (data.results || []).forEach(result => {
          const gifUrl = result.media?.[0]?.tinygif?.url || result.media?.[0]?.gif?.url;
          if (!gifUrl) return;
          const img = document.createElement('img');
          img.src = gifUrl;
          img.className = 'oneui-gif-item';
          img.loading = 'lazy';
          img.alt = result.title || 'GIF';
          img.addEventListener('click', async () => {
            closePicker();
            // Send GIF as a message
            if (!activeConversationId) return;
            try {
              await callMoodleAjax('core_message_send_messages_to_conversation', {
                conversationid: activeConversationId,
                messages: [{ text: gifUrl }]
              });
              if (inputField) inputField.value = '';
              await fetchAndRenderMessages();
            } catch(e) { console.error('Failed to send GIF:', e); }
          });
          gifGrid.appendChild(img);
        });
        if (gifGrid.children.length === 0) {
          gifGrid.innerHTML = '<div class="oneui-gif-loading">Aucun résultat.</div>';
        }
      } catch(e) {
        gifGrid.innerHTML = '<div class="oneui-gif-loading">Erreur de chargement.</div>';
      }
    };

    gifSearch.addEventListener('input', () => {
      clearTimeout(gifDebounce);
      gifDebounce = setTimeout(() => loadGifs(gifSearch.value), 400);
    });

    // Picker tabs
    pickerPopup.querySelectorAll('.oneui-picker-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        pickerPopup.querySelectorAll('.oneui-picker-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        if (tab.dataset.tab === 'emoji') {
          emojiPanel.style.display = 'flex';
          gifPanel.style.display = 'none';
        } else {
          emojiPanel.style.display = 'none';
          gifPanel.style.display = 'flex';
          if (gifGrid.children.length === 0) loadGifs();
        }
      });
    });

    // Toggle picker on emoji button click
    if (emojiBtn) {
      emojiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = pickerPopup.style.display !== 'none';
        pickerPopup.style.display = isOpen ? 'none' : 'flex';
      });
    }

    // Close picker on outside click
    document.addEventListener('click', (e) => {
      if (!pickerPopup.contains(e.target) && !emojiBtn.contains(e.target)) {
        closePicker();
      }
    });

    // Intercept clicks and mouse/touch events on IA result cards to prevent Moodle's routing system from crashing the page
    const stopResultCardEvents = ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend'];
    stopResultCardEvents.forEach(evt => {
      document.addEventListener(evt, (e) => {
        const card = e.target.closest && e.target.closest('.ia-result-card');
        if (card) {
          e.stopPropagation();
          e.stopImmediatePropagation();
          if (evt === 'click') {
            e.preventDefault();
            const url = card.getAttribute('href');
            const target = card.getAttribute('target') || '_self';
            if (url) {
              window.open(url, target);
            }
          }
        }
      }, true);
    });

    // 6b. Attach mobile back button listener
    const backBtn = appContainer.querySelector('.oneui-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        activeConversationId = null;
        if (pollTimeout) clearTimeout(pollTimeout);
        appContainer.querySelector('.oneui-left-panel').style.display = 'flex';
        appContainer.querySelector('.oneui-right-panel').style.display = 'none';
        
        const rightPanel = appContainer.querySelector('.oneui-right-panel');
        if (rightPanel) {
          rightPanel.classList.remove('oneui-chat-active');
        }
      });
    }

    // 6c. Attach reply preview close listener
    const replyCloseBtn = appContainer.querySelector('.oneui-reply-preview-close');
    if (replyCloseBtn) {
      replyCloseBtn.addEventListener('click', () => {
        cancelReply();
      });
    }

    // 7. Wait for Moodle configuration (sesskey and userid) to be ready, then fetch data
    const loadData = async () => {
      let attempts = 0;

      const fetchUserIdFromPage = async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
        const html = await res.text();
        
        // 1. Try M.cfg userid match
        let m = html.match(/"userid"\s*:\s*["']?(\d+)["']?/i);
        if (m && m[1] && m[1] !== '0') return parseInt(m[1], 10);
        
        // 2. Try body class match
        m = html.match(/<body[^>]*class="[^"]*\buser-(\d+)\b/i);
        if (m && m[1] && m[1] !== '0') return parseInt(m[1], 10);

        // 3. Try profile link match
        m = html.match(/\/user\/profile\.php\?id=(\d+)/i) || html.match(/\/user\/view\.php\?id=(\d+)/i);
        if (m && m[1] && m[1] !== '0') return parseInt(m[1], 10);
        
        throw new Error('User ID not found in page HTML');
      };

      const checkAndFetch = async () => {
        const config = extractMoodleConfig();
        if (config.sesskey) {
          currentSesskey = config.sesskey;
          if (config.userid && config.userid !== 0) {
            currentUserId = config.userid;
          } else {
            // Fetch userid via background page fetches
            try {
              console.log('[myMoodle ULTRA] userid is 0. Fetching dashboard page `/my/` to retrieve userid...');
              let resolvedId = 0;
              try {
                resolvedId = await fetchUserIdFromPage(`${window.location.origin}/my/`);
              } catch (myErr) {
                console.warn('[myMoodle ULTRA] Failed to fetch userid from `/my/`, trying `/user/profile.php`...', myErr);
                resolvedId = await fetchUserIdFromPage(`${window.location.origin}/user/profile.php`);
              }

              if (resolvedId) {
                currentUserId = resolvedId;
                console.log('[myMoodle ULTRA] Successfully retrieved userid via page fetch:', currentUserId);
                // Save it back to cache
                document.documentElement.setAttribute('data-moodle-userid', currentUserId);
                try {
                  sessionStorage.setItem('moodle_userid', currentUserId);
                } catch (e) {}
              } else {
                throw new Error('Resolved user ID is 0');
              }
            } catch (apiError) {
              console.error('[myMoodle ULTRA] Failed to retrieve userid via page fetches:', apiError);
              if (attempts < 150) {
                attempts++;
                setTimeout(checkAndFetch, 100);
                return;
              }
            }
          }

          if (currentUserId) {
            await loadUltraConversations();

            try {
              const result = await callMoodleAjax('core_message_get_conversations', {
                userid: currentUserId,
                limitnum: 40,
                limitfrom: 0
              });
              allConversations = result.conversations || [];
              
              // Resolve current user profile image and fullname from the API data
              let myProfileImage = '';
              let myFullname = '';
              for (const conv of allConversations) {
                if (conv.members) {
                  const me = conv.members.find(m => m.id === currentUserId);
                  if (me) {
                    myProfileImage = me.profileimageurl || me.profileimageurlsmall || '';
                    myFullname = me.fullname || '';
                    break;
                  }
                }
              }
              const profileInner = appContainer.querySelector('.oneui-profile-inner');
              if (profileInner) {
                if (myProfileImage) {
                  profileInner.innerHTML = `<img src="${myProfileImage}" alt="Profil">`;
                } else if (myFullname) {
                  const myInitials = myFullname.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
                  profileInner.textContent = myInitials;
                }
              }

              renderConversations(allConversations);
              updateSubtitle(appContainer.querySelector('.oneui-message-header'), allConversations);
              
              // Load enter to send preference on startup
              try {
                const userPrefs = await callMoodleAjax('core_user_get_user_preferences', {
                  userid: currentUserId
                });
                if (userPrefs && userPrefs.preferences) {
                  const entertosendPref = userPrefs.preferences.find(p => p.name === 'message_entertosend');
                  if (entertosendPref) {
                    entertosendEnabled = entertosendPref.value === '1';
                  }
                }
              } catch (prefErr) {
                console.warn('Failed to load enter to send pref on startup:', prefErr);
              }
            } catch (e) {
              console.error('Failed to load conversations:', e);
              if (convListEl) {
                convListEl.innerHTML = '<div class="oneui-error-convs">Impossible de charger les conversations.</div>';
              }
            }
            return;
          }
        }

        if (attempts < 150) { // Check every 100ms for 15 seconds
          attempts++;
          if (attempts === 20) {
            console.log('[myMoodle ULTRA Diagnostics] 2 seconds check - config state:', extractMoodleConfig());
          }
          setTimeout(checkAndFetch, 100);
        } else {
          console.warn('[myMoodle ULTRA] Configuration keys could not be resolved after 15 seconds.');
          console.log('[myMoodle ULTRA Diagnostics] document attributes:', {
            sesskey: document.documentElement.getAttribute('data-moodle-sesskey'),
            userid: document.documentElement.getAttribute('data-moodle-userid')
          });
          try {
            console.log('[myMoodle ULTRA Diagnostics] sessionStorage:', {
              sesskey: sessionStorage.getItem('moodle_sesskey'),
              userid: sessionStorage.getItem('moodle_userid')
            });
          } catch(e) {}
          const scripts = document.getElementsByTagName('script');
          console.log('[myMoodle ULTRA Diagnostics] Scripts count:', scripts.length);
          for (let i = 0; i < scripts.length; i++) {
            const content = scripts[i].textContent || '';
            if (content.includes('sesskey') || content.includes('userid') || content.includes('M.cfg')) {
              console.log(`[myMoodle ULTRA Diagnostics] Script ${i} content sample:`, content.slice(0, 500));
            }
          }
          if (convListEl) {
            convListEl.innerHTML = '<div class="oneui-error-convs">Impossible de récupérer la session Moodle. Veuillez réactualiser la page.</div>';
          }
        }
      };
      checkAndFetch();
    };

    loadData();
  };

  window.customizeMoodleMessaging = customizeMoodleMessaging;
})();
