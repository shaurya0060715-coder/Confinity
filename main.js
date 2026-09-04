const { app, BrowserWindow, ipcMain, session, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { installChromeWebStore, installExtension, uninstallExtension } = require('electron-chrome-web-store');

// ⚡ FIX: Forces Chromium to bypass glitched DWM injection hooks and render frames stably
app.disableHardwareAcceleration();

function createConfinityWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        title: "Confinity",
        icon: path.join(__dirname, 'Confinity.ico'),
        frame: false,
        autoHideMenuBar: true,
        backgroundColor: '#0b0f19',
        show: false, // ⚡ FIX: Prevents a flashing transparent frame while loading assets
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webviewTag: true
        }
    });

    // ⚡ FIX: Uses dynamic paths via __dirname so the app works inside the installer archive
    win.loadFile(path.join(__dirname, 'index.html'));

    // ⚡ FIX: Reveals the window gracefully only after the UI successfully draws
    win.once('ready-to-show', () => {
        win.show();
    });

    ipcMain.on('window-minimize', () => win.minimize());
    ipcMain.on('window-maximize', () => {
        if (win.isMaximized()) {
            win.unmaximize();
        } else {
            win.maximize();
        }
    });
    ipcMain.on('window-close', () => win.close());
}

// Chrome's store gates installs on chrome.webstorePrivate, which Electron doesn't
// ship -- hence the "Switch to Chrome" banner. This supplies that API, fetches the
// CRX from Google's update endpoint and unpacks it into userData/Extensions.
// Webviews inherit defaultSession, so installing here covers every tab.
async function enableWebStore() {
    try {
        await installChromeWebStore({
            session: session.defaultSession,
            loadExtensions: true,
            allowUnpackedExtensions: true,
            autoUpdate: true,
            beforeInstall: async (details) => {
                const { response } = await dialog.showMessageBox(details.browserWindow, {
                    type: 'question',
                    buttons: ['Cancel', 'Add extension'],
                    defaultId: 1,
                    cancelId: 0,
                    icon: details.icon,
                    title: 'Add extension',
                    message: `Add "${details.localizedName}" to Confinity?`,
                    detail: 'Extensions can read and change the data on sites you visit. '
                        + 'Only add extensions you trust.'
                });
                return { action: response === 1 ? 'allow' : 'deny' };
            }
        });
    } catch (e) {
        // A store failure must never stop the browser itself from opening.
        console.error('Chrome Web Store support unavailable:', e);
    }
}

app.whenReady().then(async () => {
    await enableWebStore();
    createConfinityWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createConfinityWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// Extension Management IPC
ipcMain.handle('load-unpacked-extension', async (event) => {
    const { filePaths } = await dialog.showOpenDialog({
        title: 'Select Unpacked Extension Directory',
        properties: ['openDirectory']
    });
    
    if (filePaths && filePaths.length > 0) {
        const extPath = filePaths[0];
        try {
            const ext = await session.defaultSession.loadExtension(extPath, { allowFileAccess: true });
            let manifest = {};
            try {
                manifest = JSON.parse(fs.readFileSync(path.join(extPath, 'manifest.json'), 'utf-8'));
            } catch (e) {}
            
            return {
                success: true,
                id: ext.id,
                name: manifest.name || ext.name || 'Unknown Extension',
                version: manifest.version || '1.0.0',
                path: extPath
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    return { success: false, error: 'Cancelled' };
});

ipcMain.handle('remove-extension', async (event, extensionId) => {
    try {
        // Store extensions live on disk under userData/Extensions. removeExtension only
        // unloads them, so they'd come back on the next launch -- delete them properly.
        await uninstallExtension(extensionId, { session: session.defaultSession });
        return true;
    } catch (e) {
        try {
            session.defaultSession.removeExtension(extensionId);
            return true;
        } catch (inner) {
            console.error("Failed to remove extension", inner);
            return false;
        }
    }
});

// Install straight from a Web Store URL or a bare extension ID, skipping the store page.
ipcMain.handle('install-webstore-extension', async (event, input) => {
    const id = String(input || '').trim().match(/([a-p]{32})/)?.[1];
    if (!id) return { success: false, error: 'Not a valid Chrome Web Store URL or extension ID' };
    try {
        const ext = await installExtension(id, { session: session.defaultSession });
        return { success: true, id: ext.id, name: ext.name, version: ext.version };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('init-extensions', async (event, extPaths) => {
    const loaded = [];
    for (const extPath of extPaths) {
        try {
            const ext = await session.defaultSession.loadExtension(extPath, { allowFileAccess: true });
            let manifest = {};
            try { manifest = JSON.parse(fs.readFileSync(path.join(extPath, 'manifest.json'), 'utf-8')); } catch(e){}
            loaded.push({
                id: ext.id,
                name: manifest.name || ext.name || 'Unknown Extension',
                version: manifest.version || '1.0.0',
                path: extPath
            });
        } catch (e) {
            console.error("Failed to load persisted extension:", e);
        }
    }
    return loaded;
});

ipcMain.handle('clear-browser-cache', async () => {
    await session.defaultSession.clearCache();
    return true;
});
