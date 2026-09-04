document.addEventListener('DOMContentLoaded', async () => {
    const { ipcRenderer } = require('electron');

    let browserTabsArray = [];
    let activeRuntimeTabId = null;

    const tabsContainer = document.getElementById('tabs-container-wrapper');
    const webviewsStack = document.getElementById('webviews-render-stack-wrapper');
    const searchInput = document.getElementById('confinity-native-search');
    const searchIndicator = document.getElementById('search-engine-indicator');
    const homeLandingView = document.getElementById('home-view');
    const clientSidebar = document.getElementById('account-sidebar');

    const accountStatusText = document.getElementById('account-status');
    const usernameInput = document.getElementById('acc-username');
    const loginButton = document.getElementById('btn-login');

    // Default Settings
    const defaultSettings = {
        searchEngine: 'Google',
        theme: 'dark',
        clearDataOnExit: false,
        askDownloadPath: false,
        startup: 'newtab',
        aiApiKey: '',
        aiModel: 'claude-3-5-sonnet-20241022'
    };

    function loadSettings() {
        const settings = JSON.parse(localStorage.getItem('confinity_settings')) || defaultSettings;
        document.getElementById('search-engine-select').value = settings.searchEngine;
        document.getElementById('theme-select').value = settings.theme;
        document.getElementById('clear-data-on-exit').checked = settings.clearDataOnExit;
        document.getElementById('ask-download-path').checked = settings.askDownloadPath;
        const startupRadios = document.getElementsByName('startup');
        for (const radio of startupRadios) {
            if (radio.value === settings.startup) radio.checked = true;
        }
        
        const aiApiKeyInput = document.getElementById('ai-api-key');
        if (aiApiKeyInput) aiApiKeyInput.value = settings.aiApiKey || '';
        
        const aiModelSelect = document.getElementById('ai-model-select');
        if (aiModelSelect) aiModelSelect.value = settings.aiModel || 'claude-3-5-sonnet-20241022';
        
        applySettings(settings);
        return settings;
    }

    function saveSettings() {
        const settings = {
            searchEngine: document.getElementById('search-engine-select').value,
            theme: document.getElementById('theme-select').value,
            clearDataOnExit: document.getElementById('clear-data-on-exit').checked,
            askDownloadPath: document.getElementById('ask-download-path').checked,
            startup: document.querySelector('input[name="startup"]:checked').value,
            aiApiKey: document.getElementById('ai-api-key') ? document.getElementById('ai-api-key').value : '',
            aiModel: document.getElementById('ai-model-select') ? document.getElementById('ai-model-select').value : 'claude-3-5-sonnet-20241022'
        };
        localStorage.setItem('confinity_settings', JSON.stringify(settings));
        applySettings(settings);
    }

    function applySettings(settings) {
        searchIndicator.innerText = settings.searchEngine;
    }

    let currentSettings = loadSettings();

    // Listen for setting changes
    document.getElementById('search-engine-select').addEventListener('change', saveSettings);
    document.getElementById('theme-select').addEventListener('change', saveSettings);
    document.getElementById('clear-data-on-exit').addEventListener('change', saveSettings);
    document.getElementById('ask-download-path').addEventListener('change', saveSettings);
    document.getElementsByName('startup').forEach(r => r.addEventListener('change', saveSettings));
    
    const aiApiKeyEl = document.getElementById('ai-api-key');
    if (aiApiKeyEl) aiApiKeyEl.addEventListener('input', saveSettings);
    const aiModelEl = document.getElementById('ai-model-select');
    if (aiModelEl) aiModelEl.addEventListener('change', saveSettings);

    const searchEngines = {
        Google: "https://www.google.com/search?q=",
        DuckDuckGo: "https://duckduckgo.com/?q=",
        "Brave Search": "https://search.brave.com/search?q=",
        Bing: "https://www.bing.com/search?q=",
        ConfiSearch: "https://confisearch.com/search?q="
    };

    function createBrowserTabInstance(targetLocationUrl = 'about:blank') {
        const tabUniqueId = 'tab-instance-node-' + Date.now() + Math.floor(Math.random() * 1000);

        const tabElementNode = document.createElement('div');
        tabElementNode.className = 'native-horizontal-tab';
        tabElementNode.id = tabUniqueId;
        tabElementNode.innerHTML = `
            <span class="tab-group-dot" style="display:none;"></span>
            <span class="tab-title-string-text">New Tab</span>
            <span class="tab-loading-spinner" style="display:none;">↻</span>
            <span class="tab-close-cross-trigger" data-close-target="${tabUniqueId}">×</span>
        `;

        const webviewViewportNode = document.createElement('webview');
        webviewViewportNode.id = 'viewport-layer-node-' + tabUniqueId;
        webviewViewportNode.className = 'hidden-webview-viewport';
        webviewViewportNode.src = targetLocationUrl;
        webviewViewportNode.allowpopups = true;

        const spinner = tabElementNode.querySelector('.tab-loading-spinner');

        webviewViewportNode.addEventListener('did-start-loading', () => {
            spinner.style.display = 'inline-block';
        });

        webviewViewportNode.addEventListener('did-stop-loading', () => {
            spinner.style.display = 'none';
            if (activeRuntimeTabId === tabUniqueId && typeof triggerAIPageAnalysis === 'function') {
                triggerAIPageAnalysis(webviewViewportNode);
            }
        });

        webviewViewportNode.addEventListener('page-title-updated', (event) => {
            tabElementNode.querySelector('.tab-title-string-text').innerText = event.title;
        });

        webviewViewportNode.addEventListener('did-navigate', (event) => {
            if (activeRuntimeTabId === tabUniqueId) {
                searchInput.value = event.url;
            }
        });

        webviewViewportNode.addEventListener('did-navigate-in-page', (event) => {
            if (activeRuntimeTabId === tabUniqueId) {
                searchInput.value = event.url;
            }
        });

        webviewViewportNode.addEventListener('did-fail-load', (e) => {
            if (e.errorCode !== -3 && e.validatedURL !== 'about:blank') { // -3 is ERR_ABORTED
                const errorHtml = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background-color:#0b0f19; color:#fff; font-family:sans-serif;">
                        <h1>Page Load Error</h1>
                        <p>Could not load the webpage. Error code: ${e.errorCode}</p>
                        <p style="color:#a0aec0; font-size:14px;">${e.errorDescription}</p>
                    </div>
                `;
                webviewViewportNode.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
            }
        });

        tabsContainer.appendChild(tabElementNode);
        webviewsStack.appendChild(webviewViewportNode);

        browserTabsArray.push({
            id: tabUniqueId,
            tabUiButton: tabElementNode,
            webviewInstance: webviewViewportNode,
            groupId: null
        });

        // Right-click for tab group context menu
        tabElementNode.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (typeof showTabContextMenu === 'function') showTabContextMenu(e, tabUniqueId);
        });

        tabElementNode.addEventListener('click', (event) => {
            if (!event.target.classList.contains('tab-close-cross-trigger')) {
                focusActiveTabInstance(tabUniqueId);
            }
        });

        tabElementNode.querySelector('.tab-close-cross-trigger').addEventListener('click', (event) => {
            event.stopPropagation();
            destroyBrowserTabInstance(tabUniqueId);
        });

        focusActiveTabInstance(tabUniqueId);
    }

    function focusActiveTabInstance(tabUniqueId) {
        browserTabsArray.forEach(tab => {
            tab.tabUiButton.classList.remove('active-tab');
            tab.webviewInstance.className = 'hidden-webview-viewport';
        });

        const targetFocusObject = browserTabsArray.find(tab => tab.id === tabUniqueId);
        if (targetFocusObject) {
            activeRuntimeTabId = tabUniqueId;
            targetFocusObject.tabUiButton.classList.add('active-tab');

            if (targetFocusObject.webviewInstance.src === 'about:blank' || targetFocusObject.webviewInstance.src === '' || targetFocusObject.webviewInstance.src.startsWith('data:text/html')) {
                homeLandingView.style.display = 'flex';
                searchInput.value = '';
                searchInput.focus();
            } else {
                homeLandingView.style.display = 'none';
                targetFocusObject.webviewInstance.className = 'visible-webview-viewport';
                searchInput.value = targetFocusObject.webviewInstance.src;
                targetFocusObject.webviewInstance.focus();
            }
        }
    }

    function destroyBrowserTabInstance(tabUniqueId) {
        const targetSearchIndex = browserTabsArray.findIndex(tab => tab.id === tabUniqueId);
        if (targetSearchIndex === -1) return;

        browserTabsArray[targetSearchIndex].tabUiButton.remove();
        browserTabsArray[targetSearchIndex].webviewInstance.remove();
        browserTabsArray.splice(targetSearchIndex, 1);

        if (browserTabsArray.length === 0) {
            window.close();
            return;
        }

        if (activeRuntimeTabId === tabUniqueId) {
            if (browserTabsArray.length > 0) {
                focusActiveTabInstance(browserTabsArray[browserTabsArray.length - 1].id);
            } else {
                activeRuntimeTabId = null;
                homeLandingView.style.display = 'flex';
                searchInput.value = '';
            }
        }
    }

    // SMART CONVENIENT ROUTER ENGINE
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && searchInput.value.trim() !== '') {
            const rawInput = searchInput.value.trim();
            if (!rawInput) return;

            let targetUrl = '';
            
            // Basic URL validation
            const urlPattern = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/i;
            const ipPattern = /^(https?:\/\/)?(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/.*)?$/;
            const localhostPattern = /^(https?:\/\/)?localhost(:\d+)?(\/.*)?$/i;

            if (urlPattern.test(rawInput) || ipPattern.test(rawInput) || localhostPattern.test(rawInput)) {
                if (!rawInput.startsWith('http://') && !rawInput.startsWith('https://')) {
                    targetUrl = 'https://' + rawInput;
                } else {
                    targetUrl = rawInput;
                }
            } else {
                // It's a search query
                const engine = JSON.parse(localStorage.getItem('confinity_settings'))?.searchEngine || 'Google';
                targetUrl = searchEngines[engine] + encodeURIComponent(rawInput);
            }

            if (!activeRuntimeTabId) {
                createBrowserTabInstance(targetUrl);
            } else {
                const currentFocusTab = browserTabsArray.find(tab => tab.id === activeRuntimeTabId);
                if (currentFocusTab) {
                    homeLandingView.style.display = 'none';
                    currentFocusTab.webviewInstance.className = 'visible-webview-viewport';
                    currentFocusTab.webviewInstance.src = targetUrl;
                    currentFocusTab.webviewInstance.focus();
                }
            }
        }
    });

    document.getElementById('cnav-new-tab-trigger').addEventListener('click', () => createBrowserTabInstance());

    document.getElementById('cnav-undo').addEventListener('click', () => {
        const activeTab = browserTabsArray.find(tab => tab.id === activeRuntimeTabId);
        if (activeTab && activeTab.webviewInstance.canGoBack()) activeTab.webviewInstance.goBack();
    });

    document.getElementById('cnav-redo').addEventListener('click', () => {
        const activeTab = browserTabsArray.find(tab => tab.id === activeRuntimeTabId);
        if (activeTab && activeTab.webviewInstance.canGoForward()) activeTab.webviewInstance.goForward();
    });

    document.getElementById('cnav-reload').addEventListener('click', () => {
        const activeTab = browserTabsArray.find(tab => tab.id === activeRuntimeTabId);
        if (activeTab && homeLandingView.style.display !== 'flex') {
            activeTab.webviewInstance.reload();
        } else {
            window.location.reload();
        }
    });

    document.getElementById('cnav-home').addEventListener('click', () => {
        const activeTab = browserTabsArray.find(tab => tab.id === activeRuntimeTabId);
        if (activeTab) {
            activeTab.webviewInstance.src = 'about:blank';
            activeTab.webviewInstance.className = 'hidden-webview-viewport';
            homeLandingView.style.display = 'flex';
            searchInput.value = '';
            searchInput.focus();
        }
    });

    // Settings Overlay
    const settingsOverlay = document.getElementById('settings-overlay');
    const settingsTabs = document.querySelectorAll('#settings-tabs li');
    const settingsPanels = document.querySelectorAll('.settings-panel');

    document.getElementById('cnav-settings-toggle').addEventListener('click', () => {
        settingsOverlay.classList.remove('hidden');
        if (!clientSidebar.classList.contains('hidden')) clientSidebar.classList.add('hidden');
    });

    document.getElementById('close-settings-btn').addEventListener('click', () => {
        settingsOverlay.classList.add('hidden');
    });

    settingsTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            settingsTabs.forEach(t => t.classList.remove('active'));
            settingsPanels.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.getAttribute('data-target')).classList.add('active');
        });
    });

    // Extensions Manager
    document.getElementById('cnav-extensions-toggle').addEventListener('click', () => {
        createBrowserTabInstance('https://chromewebstore.google.com/');
    });

    const extensionsListDiv = document.getElementById('installed-extensions-list');
    
    function renderExtensions(extensions) {
        extensionsListDiv.innerHTML = '';
        if (extensions.length === 0) {
            extensionsListDiv.innerHTML = '<p>No extensions installed.</p>';
            return;
        }
        extensions.forEach(ext => {
            const div = document.createElement('div');
            div.className = 'extension-item';
            div.innerHTML = `
                <div class="extension-info">
                    <h4>${ext.name}</h4>
                    <p>Version: ${ext.version}</p>
                </div>
                <div class="extension-actions">
                    <button class="action-button danger-tab-btn" data-id="${ext.id}" data-path="${ext.path}">Remove</button>
                </div>
            `;
            div.querySelector('button').addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const path = e.target.getAttribute('data-path');
                const success = await ipcRenderer.invoke('remove-extension', id);
                if (success) {
                    let savedExts = JSON.parse(localStorage.getItem('confinity_extensions')) || [];
                    savedExts = savedExts.filter(p => p !== path);
                    localStorage.setItem('confinity_extensions', JSON.stringify(savedExts));
                    div.remove();
                } else {
                    alert('Failed to remove extension. It may require a browser restart.');
                }
            });
            extensionsListDiv.appendChild(div);
        });
    }

    const webstoreInput = document.getElementById('webstore-ext-input');
    const installWebstoreBtn = document.getElementById('install-webstore-ext');

    async function installFromWebStore() {
        const value = webstoreInput.value.trim();
        if (!value) return;

        installWebstoreBtn.disabled = true;
        installWebstoreBtn.innerText = 'Installing...';
        try {
            const result = await ipcRenderer.invoke('install-webstore-extension', value);
            if (result.success) {
                webstoreInput.value = '';
                alert(`Installed: ${result.name} ${result.version}`);
                // Web store extensions are tracked by the store itself, not the unpacked
                // path list, so just refresh what's currently loaded.
                const currentlyLoaded = JSON.parse(sessionStorage.getItem('loaded_extensions')) || [];
                currentlyLoaded.push({ id: result.id, name: result.name, version: result.version });
                sessionStorage.setItem('loaded_extensions', JSON.stringify(currentlyLoaded));
                renderExtensions(currentlyLoaded);
            } else {
                alert('Could not install extension: ' + result.error);
            }
        } finally {
            installWebstoreBtn.disabled = false;
            installWebstoreBtn.innerText = 'Install';
        }
    }

    installWebstoreBtn.addEventListener('click', installFromWebStore);
    webstoreInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') installFromWebStore();
    });

    document.getElementById('load-unpacked-ext').addEventListener('click', async () => {
        const result = await ipcRenderer.invoke('load-unpacked-extension');
        if (result.success) {
            let savedExts = JSON.parse(localStorage.getItem('confinity_extensions')) || [];
            if (!savedExts.includes(result.path)) {
                savedExts.push(result.path);
                localStorage.setItem('confinity_extensions', JSON.stringify(savedExts));
            }
            alert(`Successfully loaded: ${result.name}`);
            // Re-render
            const currentlyLoaded = JSON.parse(sessionStorage.getItem('loaded_extensions')) || [];
            currentlyLoaded.push(result);
            sessionStorage.setItem('loaded_extensions', JSON.stringify(currentlyLoaded));
            renderExtensions(currentlyLoaded);
        } else if (result.error !== 'Cancelled') {
            alert('Failed to load extension: ' + result.error);
        }
    });

    // Initialize Extensions on startup
    async function initExtensions() {
        const savedExts = JSON.parse(localStorage.getItem('confinity_extensions')) || [];
        if (savedExts.length > 0) {
            const loaded = await ipcRenderer.invoke('init-extensions', savedExts);
            sessionStorage.setItem('loaded_extensions', JSON.stringify(loaded));
            renderExtensions(loaded);
        }
    }
    initExtensions();

    // Clear Cache Button
    document.getElementById('clear-cache-btn').addEventListener('click', async () => {
        await ipcRenderer.invoke('clear-browser-cache');
        alert('Browser cache cleared successfully.');
    });

    document.getElementById('cnav-account-toggle').addEventListener('click', () => {
        clientSidebar.classList.toggle('hidden');
    });

    // Persistent Sign-In Logic
    const savedUser = localStorage.getItem('confinity_user');
    if (savedUser) {
        accountStatusText.innerText = `Active Session: ${savedUser}`;
        usernameInput.style.display = 'none';
        loginButton.innerText = "Sign Out";
        loginButton.classList.add('danger-tab-btn');
    }

    loginButton.addEventListener('click', () => {
        if (loginButton.innerText === "Sign In & Sync") {
            const user = usernameInput.value.trim();
            if (user) {
                loginButton.innerText = "Authenticating...";
                loginButton.style.opacity = '0.7';
                loginButton.disabled = true;
                
                setTimeout(() => {
                    localStorage.setItem('confinity_user', user);
                    accountStatusText.innerText = `Active Session: ${user}`;
                    usernameInput.style.display = 'none';
                    loginButton.innerText = "Sign Out";
                    loginButton.classList.add('danger-tab-btn');
                    loginButton.style.opacity = '1';
                    loginButton.disabled = false;
                }, 1200);
            }
        } else {
            loginButton.innerText = "Signing Out...";
            loginButton.style.opacity = '0.7';
            loginButton.disabled = true;
            
            setTimeout(() => {
                localStorage.removeItem('confinity_user');
                accountStatusText.innerText = "Guest Session Profile";
                usernameInput.value = "";
                usernameInput.style.display = 'block';
                loginButton.innerText = "Sign In & Sync";
                loginButton.classList.remove('danger-tab-btn');
                loginButton.style.opacity = '1';
                loginButton.disabled = false;
            }, 600);
        }
    });

    document.getElementById('sys-min').addEventListener('click', () => ipcRenderer.send('window-minimize'));
    document.getElementById('sys-max').addEventListener('click', () => ipcRenderer.send('window-maximize'));
    document.getElementById('sys-close').addEventListener('click', () => ipcRenderer.send('window-close'));

    // Handle startup behavior
    const startupSetting = currentSettings.startup;
    if (startupSetting === 'continue') {
        const savedTabs = JSON.parse(localStorage.getItem('confinity_saved_tabs')) || [];
        if (savedTabs.length > 0) {
            savedTabs.forEach(url => createBrowserTabInstance(url));
        } else {
            createBrowserTabInstance();
        }
    } else {
        createBrowserTabInstance();
    }

    // Save tabs periodically for "Continue where you left off"
    setInterval(() => {
        const urls = browserTabsArray
            .map(t => t.webviewInstance.src)
            .filter(src => src !== 'about:blank' && !src.startsWith('data:text/html'));
        localStorage.setItem('confinity_saved_tabs', JSON.stringify(urls));
    }, 5000);

    // ==========================================================
    // FEATURE 1: COMMAND PALETTE (Ctrl+K)
    // ==========================================================
    const cpOverlay = document.getElementById('command-palette-overlay');
    const cpInput = document.getElementById('cp-input');
    const cpResults = document.getElementById('cp-results');
    let cpActiveIndex = 0;

    function getCommands() {
        const cmds = [
            { icon: '➕', label: 'New Tab', hint: '', action: () => createBrowserTabInstance() },
            { icon: '↻', label: 'Reload Page', hint: '', action: () => document.getElementById('cnav-reload').click() },
            { icon: '⌂', label: 'Go Home', hint: '', action: () => document.getElementById('cnav-home').click() },
            { icon: '⚙️', label: 'Open Settings', hint: '', action: () => { settingsOverlay.classList.remove('hidden'); } },
            { icon: '🧩', label: 'Chrome Web Store', hint: '', action: () => createBrowserTabInstance('https://chromewebstore.google.com/') },
            { icon: '✦', label: 'Toggle AI Assistant', hint: '', action: () => document.getElementById('cnav-ai-toggle').click() },
            { icon: '🗑', label: 'Clear Browser Cache', hint: '', action: async () => { await ipcRenderer.invoke('clear-browser-cache'); } },
        ];
        // Add open tabs as switchable items
        browserTabsArray.forEach(tab => {
            const title = tab.tabUiButton.querySelector('.tab-title-string-text').innerText;
            cmds.push({ icon: '📄', label: title, hint: 'Switch Tab', action: () => focusActiveTabInstance(tab.id) });
        });
        return cmds;
    }

    function renderCPResults(query) {
        const commands = getCommands();
        const q = query.toLowerCase();
        const filtered = q ? commands.filter(c => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q)) : commands;
        cpResults.innerHTML = '';
        cpActiveIndex = 0;
        if (filtered.length === 0) {
            cpResults.innerHTML = '<div class="cp-no-results">No results found</div>';
            return;
        }
        filtered.forEach((cmd, i) => {
            const div = document.createElement('div');
            div.className = 'cp-result-item' + (i === 0 ? ' cp-active' : '');
            div.innerHTML = `<span class="cp-result-icon">${cmd.icon}</span><span class="cp-result-text">${cmd.label}</span><span class="cp-result-hint">${cmd.hint}</span>`;
            div.addEventListener('click', () => { cmd.action(); closeCPalette(); });
            div.addEventListener('mouseenter', () => {
                cpResults.querySelectorAll('.cp-result-item').forEach(el => el.classList.remove('cp-active'));
                div.classList.add('cp-active');
                cpActiveIndex = i;
            });
            cpResults.appendChild(div);
        });
    }

    function openCPalette() {
        cpOverlay.classList.remove('hidden');
        cpInput.value = '';
        renderCPResults('');
        setTimeout(() => cpInput.focus(), 50);
    }
    function closeCPalette() {
        cpOverlay.classList.add('hidden');
        cpInput.value = '';
    }

    cpInput.addEventListener('input', () => renderCPResults(cpInput.value));
    cpInput.addEventListener('keydown', (e) => {
        const items = cpResults.querySelectorAll('.cp-result-item');
        if (e.key === 'ArrowDown') { e.preventDefault(); cpActiveIndex = Math.min(cpActiveIndex + 1, items.length - 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); cpActiveIndex = Math.max(cpActiveIndex - 1, 0); }
        else if (e.key === 'Enter') { e.preventDefault(); if (items[cpActiveIndex]) items[cpActiveIndex].click(); return; }
        else if (e.key === 'Escape') { closeCPalette(); return; }
        items.forEach((el, i) => el.classList.toggle('cp-active', i === cpActiveIndex));
        if (items[cpActiveIndex]) items[cpActiveIndex].scrollIntoView({ block: 'nearest' });
    });
    cpOverlay.addEventListener('click', (e) => { if (e.target === cpOverlay) closeCPalette(); });

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            cpOverlay.classList.contains('hidden') ? openCPalette() : closeCPalette();
        }
    });

    // ==========================================================
    // FEATURE 2: TAB GROUPS
    // ==========================================================
    let tabGroups = JSON.parse(localStorage.getItem('confinity_tab_groups')) || [];
    const GROUP_COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#6B7280'];
    const tabCtxMenu = document.getElementById('tab-context-menu');
    const ctxGroupsList = document.getElementById('ctx-groups-list');
    const ngdDialog = document.getElementById('new-group-dialog');
    const ngdColorsDiv = document.getElementById('ngd-colors');
    let ctxTargetTabId = null;
    let selectedGroupColor = GROUP_COLORS[0];

    // Populate color swatches in dialog
    GROUP_COLORS.forEach((c, i) => {
        const s = document.createElement('div');
        s.className = 'ngd-color-swatch' + (i === 0 ? ' selected' : '');
        s.style.backgroundColor = c;
        s.addEventListener('click', () => {
            ngdColorsDiv.querySelectorAll('.ngd-color-swatch').forEach(el => el.classList.remove('selected'));
            s.classList.add('selected');
            selectedGroupColor = c;
        });
        ngdColorsDiv.appendChild(s);
    });

    function saveGroups() { localStorage.setItem('confinity_tab_groups', JSON.stringify(tabGroups)); }

    function applyGroupToTab(tabId, groupId) {
        const tab = browserTabsArray.find(t => t.id === tabId);
        const group = tabGroups.find(g => g.id === groupId);
        if (!tab || !group) return;
        tab.groupId = groupId;
        tab.tabUiButton.setAttribute('data-group-color', group.color);
        tab.tabUiButton.style.setProperty('--tab-group-color', group.color);
        const dot = tab.tabUiButton.querySelector('.tab-group-dot');
        if (dot) { dot.style.display = 'inline-block'; dot.style.backgroundColor = group.color; }
    }

    function removeGroupFromTab(tabId) {
        const tab = browserTabsArray.find(t => t.id === tabId);
        if (!tab) return;
        tab.groupId = null;
        tab.tabUiButton.removeAttribute('data-group-color');
        tab.tabUiButton.style.removeProperty('--tab-group-color');
        const dot = tab.tabUiButton.querySelector('.tab-group-dot');
        if (dot) { dot.style.display = 'none'; }
    }

    function showTabContextMenu(e, tabId) {
        ctxTargetTabId = tabId;
        // Build existing groups list
        ctxGroupsList.innerHTML = '';
        tabGroups.forEach(g => {
            const item = document.createElement('div');
            item.className = 'ctx-group-item';
            item.innerHTML = `<span class="ctx-group-dot" style="background:${g.color}"></span>${g.name}`;
            item.addEventListener('click', () => { applyGroupToTab(tabId, g.id); hideTabCtxMenu(); });
            ctxGroupsList.appendChild(item);
        });
        tabCtxMenu.style.left = e.clientX + 'px';
        tabCtxMenu.style.top = e.clientY + 'px';
        tabCtxMenu.classList.remove('hidden');
    }

    function hideTabCtxMenu() { tabCtxMenu.classList.add('hidden'); }
    document.addEventListener('click', (e) => { if (!tabCtxMenu.contains(e.target)) hideTabCtxMenu(); });

    // Context menu actions
    tabCtxMenu.querySelector('[data-action="new-group"]').addEventListener('click', () => {
        hideTabCtxMenu();
        document.getElementById('ngd-name').value = '';
        selectedGroupColor = GROUP_COLORS[0];
        ngdColorsDiv.querySelectorAll('.ngd-color-swatch').forEach((s, i) => s.classList.toggle('selected', i === 0));
        ngdDialog.classList.remove('hidden');
        setTimeout(() => document.getElementById('ngd-name').focus(), 50);
    });
    tabCtxMenu.querySelector('[data-action="remove-from-group"]').addEventListener('click', () => {
        if (ctxTargetTabId) removeGroupFromTab(ctxTargetTabId);
        hideTabCtxMenu();
    });
    tabCtxMenu.querySelector('[data-action="duplicate-tab"]').addEventListener('click', () => {
        const tab = browserTabsArray.find(t => t.id === ctxTargetTabId);
        if (tab) createBrowserTabInstance(tab.webviewInstance.src);
        hideTabCtxMenu();
    });
    tabCtxMenu.querySelector('[data-action="close-tab"]').addEventListener('click', () => {
        if (ctxTargetTabId) destroyBrowserTabInstance(ctxTargetTabId);
        hideTabCtxMenu();
    });
    tabCtxMenu.querySelector('[data-action="close-others"]').addEventListener('click', () => {
        const others = browserTabsArray.filter(t => t.id !== ctxTargetTabId).map(t => t.id);
        others.forEach(id => destroyBrowserTabInstance(id));
        hideTabCtxMenu();
    });

    // New group dialog
    document.getElementById('ngd-create').addEventListener('click', () => {
        const name = document.getElementById('ngd-name').value.trim() || 'Untitled';
        const group = { id: 'grp-' + Date.now(), name, color: selectedGroupColor };
        tabGroups.push(group);
        saveGroups();
        if (ctxTargetTabId) applyGroupToTab(ctxTargetTabId, group.id);
        ngdDialog.classList.add('hidden');
    });
    document.getElementById('ngd-cancel').addEventListener('click', () => ngdDialog.classList.add('hidden'));

    // ==========================================================
    // FEATURE 3: AI PAGE ASSISTANT
    // ==========================================================
    const aiPanel = document.getElementById('ai-assistant-panel');
    const aiStatsDiv = document.getElementById('ai-page-stats');
    const aiSummaryP = document.getElementById('ai-summary-text');
    const aiMsgsDiv = document.getElementById('ai-messages');
    const aiChatInput = document.getElementById('ai-chat-input');
    let lastExtractedContent = '';

    document.getElementById('cnav-ai-toggle').addEventListener('click', () => {
        aiPanel.classList.toggle('hidden');
        if (!aiPanel.classList.contains('hidden')) {
            // Trigger analysis for current tab
            const tab = browserTabsArray.find(t => t.id === activeRuntimeTabId);
            if (tab && tab.webviewInstance.src && !tab.webviewInstance.src.startsWith('about:') && !tab.webviewInstance.src.startsWith('data:')) {
                triggerAIPageAnalysis(tab.webviewInstance);
            }
        }
    });
    document.getElementById('ai-panel-close').addEventListener('click', () => aiPanel.classList.add('hidden'));

    function triggerAIPageAnalysis(webview) {
        if (aiPanel.classList.contains('hidden')) return;
        if (!webview || !webview.src || webview.src.startsWith('about:') || webview.src.startsWith('data:')) {
            aiStatsDiv.innerHTML = '<span class="ai-stat">Navigate to a page first</span>';
            aiSummaryP.textContent = 'No page loaded yet.';
            return;
        }
        aiStatsDiv.innerHTML = '<span class="ai-stat">Analyzing...</span>';
        aiSummaryP.textContent = 'Extracting content...';

        const extractScript = `(function(){
            const title = document.title || '';
            const desc = document.querySelector('meta[name="description"]');
            const headings = Array.from(document.querySelectorAll('h1,h2,h3')).slice(0,8).map(h=>h.innerText.trim()).filter(Boolean);
            const paragraphs = Array.from(document.querySelectorAll('p')).map(p=>p.innerText.trim()).filter(t=>t.length>30);
            const bodyText = document.body ? document.body.innerText : '';
            const links = document.querySelectorAll('a[href]').length;
            const images = document.querySelectorAll('img').length;
            return JSON.stringify({title,desc:desc?desc.content:'',headings,paragraphs:paragraphs.slice(0,10),wordCount:bodyText.split(/\\s+/).length,links,images,bodySnippet:bodyText.substring(0,2000)});
        })()`;

        webview.executeJavaScript(extractScript).then(rawJson => {
            try {
                const data = JSON.parse(rawJson);
                lastExtractedContent = data.bodySnippet;
                const readTime = Math.max(1, Math.round(data.wordCount / 220));
                aiStatsDiv.innerHTML = [
                    `<span class="ai-stat"><strong>${data.wordCount.toLocaleString()}</strong> words</span>`,
                    `<span class="ai-stat"><strong>${readTime}</strong> min read</span>`,
                    `<span class="ai-stat"><strong>${data.links}</strong> links</span>`,
                    `<span class="ai-stat"><strong>${data.images}</strong> images</span>`,
                    `<span class="ai-stat"><strong>${data.headings.length}</strong> headings</span>`,
                ].join('');
                // Build summary from description + first paragraphs
                let summary = '';
                if (data.desc) summary = data.desc;
                else if (data.paragraphs.length > 0) summary = data.paragraphs.slice(0, 2).join(' ');
                else summary = 'Could not extract a summary from this page.';
                if (summary.length > 300) summary = summary.substring(0, 297) + '...';
                aiSummaryP.textContent = summary;
            } catch(err) {
                aiStatsDiv.innerHTML = '<span class="ai-stat">Could not analyze</span>';
                aiSummaryP.textContent = 'Failed to parse page content.';
            }
        }).catch(() => {
            aiStatsDiv.innerHTML = '<span class="ai-stat">Restricted page</span>';
            aiSummaryP.textContent = 'This page cannot be analyzed (security restriction).';
        });
    }

    function addAIMessage(text, sender) {
        const div = document.createElement('div');
        div.className = 'ai-msg ' + sender;
        div.textContent = text;
        aiMsgsDiv.appendChild(div);
        aiMsgsDiv.scrollTop = aiMsgsDiv.scrollHeight;
    }

    const https = require('https');
    let aiChatHistory = [];

    function requestAnthropicAPI(apiKey, model, systemPrompt, messages) {
        return new Promise((resolve, reject) => {
            const payload = JSON.stringify({
                model: model,
                max_tokens: 1024,
                system: systemPrompt,
                messages: messages
            });

            const req = https.request({
                hostname: 'api.anthropic.com',
                path: '/v1/messages',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Length': Buffer.byteLength(payload)
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
                });
            });

            req.on('error', reject);
            req.write(payload);
            req.end();
        });
    }

    async function handleAIChat(question) {
        addAIMessage(question, 'user');
        
        const settings = loadSettings();
        const apiKey = settings.aiApiKey;
        const model = settings.aiModel || 'claude-3-5-sonnet-20241022';

        if (!apiKey || apiKey.trim() === '') {
            addAIMessage('Please configure your Anthropic API Key in Settings > AI Assistant.', 'assistant');
            return;
        }

        const loaderMsgId = 'msg-' + Date.now();
        const loaderDiv = document.createElement('div');
        loaderDiv.className = 'ai-msg assistant';
        loaderDiv.id = loaderMsgId;
        loaderDiv.innerHTML = '<span style="display:inline-block;">↻</span> Thinking...';
        aiMsgsDiv.appendChild(loaderDiv);
        aiMsgsDiv.scrollTop = aiMsgsDiv.scrollHeight;

        aiChatHistory.push({ role: 'user', content: question });

        const systemPrompt = "You are Confinity AI, a helpful browser assistant. The user might ask you general questions or questions about the current webpage they are viewing. Be concise and helpful.";
        
        const tab = browserTabsArray.find(t => t.id === activeRuntimeTabId);
        const url = tab ? tab.webviewInstance.src : 'unknown URL';
        
        let pageContext = "";
        if (lastExtractedContent) {
            pageContext = `\n\nContext - The user is currently on a page with URL: ${url}\nPage Content Snippet:\n${lastExtractedContent}`;
        } else {
            pageContext = `\n\nContext - The user is currently on a page with URL: ${url}\nNo page content has been extracted yet.`;
        }

        try {
            const data = await requestAnthropicAPI(apiKey, model, systemPrompt + pageContext, aiChatHistory);
            
            const loaderEl = document.getElementById(loaderMsgId);
            if (loaderEl) loaderEl.remove();

            if (data.error) {
                addAIMessage('Error: ' + data.error.message, 'assistant');
                aiChatHistory.pop(); // Remove the failed user message
            } else if (data.content && data.content.length > 0) {
                const answer = data.content[0].text;
                addAIMessage(answer, 'assistant');
                aiChatHistory.push({ role: 'assistant', content: answer });
            } else {
                addAIMessage('Received an empty response from Claude.', 'assistant');
                aiChatHistory.pop();
            }
        } catch (error) {
            const loaderEl = document.getElementById(loaderMsgId);
            if (loaderEl) loaderEl.remove();
            
            addAIMessage('Network Error: ' + error.message, 'assistant');
            aiChatHistory.pop();
        }
    }

    aiChatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && aiChatInput.value.trim()) {
            handleAIChat(aiChatInput.value.trim());
            aiChatInput.value = '';
        }
    });
    document.getElementById('ai-send-btn').addEventListener('click', () => {
        if (aiChatInput.value.trim()) {
            handleAIChat(aiChatInput.value.trim());
            aiChatInput.value = '';
        }
    });

});
