const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const https = require('https');

let mainWindow;
let tray = null;

// Enable live reload for Electron in development
if (isDev) {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit'
  });
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'icon.ico'), // Your custom icon
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    autoHideMenuBar: true,
    show: false // Don't show initially
  });

  // Load the app
  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../out/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Hide to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
      
      // Show tray notification on first minimize
      if (tray && !tray.notificationShown) {
        tray.displayBalloon({
          iconType: 'info',
          title: "Mersace's Macro Manager",
          content: 'Application minimized to tray. Click the tray icon to restore.'
        });
        tray.notificationShown = true;
      }
    }
  });
}

function createTray() {
  // Create tray icon
  tray = new Tray(path.join(__dirname, 'tray-icon.ico')); // Smaller tray icon
  
  // Tray context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Mersace's Macro Manager",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Macro Status',
      submenu: [
        { label: 'Macro System: Ready', enabled: false },
        { label: 'Presets: Loaded', enabled: false },
        { type: 'separator' },
        { label: 'Toggle Global Hotkeys', type: 'checkbox', checked: true }
      ]
    },
    { type: 'separator' },
    {
      label: 'Settings',
      submenu: [
        { label: 'Start with Windows', type: 'checkbox', checked: false },
        { label: 'Minimize to Tray', type: 'checkbox', checked: true },
        { label: 'Show Notifications', type: 'checkbox', checked: true }
      ]
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip("Mersace's Macro Manager - Gaming Macros");

  // Double-click to restore
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// App event handlers
app.whenReady().then(() => {
  createWindow();
  createTray();

  // Register global shortcuts (example)
  // Note: In production, these should be configurable
  globalShortcut.register('F1', () => {
    // Send toggle command to renderer process
    if (mainWindow) {
      mainWindow.webContents.send('global-shortcut', { key: 'F1', action: 'toggle' });
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});

// IPC handlers for communication with renderer
ipcMain.handle('register-global-shortcut', (event, key) => {
  try {
    globalShortcut.register(key, () => {
      mainWindow.webContents.send('global-shortcut', { key, action: 'toggle' });
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('unregister-global-shortcut', (event, key) => {
  globalShortcut.unregister(key);
  return { success: true };
});

// Simulate key press (requires additional native modules in production)
ipcMain.handle('simulate-key-press', (event, key) => {
  // This is a placeholder - in production you'd use a native module
  // like robotjs or node-global-key-listener
  console.log(`Simulating key press: ${key}`);
  return { success: true, key };
});

// System information
ipcMain.handle('get-system-info', () => {
  return {
    platform: process.platform,
    arch: process.arch,
    version: app.getVersion(),
    electronVersion: process.versions.electron
  };
});

// Auto-updater configuration
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'mutvayzz-sys',
  repo: 'Mersace-Macro-manager',
  private: false
});

// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info.version);
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info);
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available:', info.version);
  if (mainWindow) {
    mainWindow.webContents.send('update-not-available', info);
  }
});

autoUpdater.on('error', (err) => {
  console.error('Update error:', err);
  if (mainWindow) {
    mainWindow.webContents.send('update-error', err.message);
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
  console.log(logMessage);
  if (mainWindow) {
    mainWindow.webContents.send('download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info.version);
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info);
  }
});

// Manual download and install for GitHub releases
ipcMain.handle('download-update', async (event, options) => {
  const { url, version, onProgress } = options;
  
  try {
    // Create downloads directory
    const downloadDir = path.join(app.getPath('downloads'), 'MersaceMacroManager');
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
    
    const fileName = `Mersace-Macro-Manager-${version}-Setup.exe`;
    const filePath = path.join(downloadDir, fileName);
    
    // Download file
    await downloadFile(url, filePath, (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send('download-progress', { percent: progress });
      }
    });
    
    // Show dialog asking if user wants to install now
    const response = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Install Now', 'Install Later'],
      defaultId: 0,
      title: 'Update Downloaded',
      message: `Mersace's Macro Manager ${version} has been downloaded successfully.`,
      detail: 'Would you like to install the update now? The application will close during installation.'
    });
    
    if (response.response === 0) {
      // Install now
      shell.openPath(filePath);
      app.quit();
    }
    
    return { success: true, filePath };
  } catch (error) {
    console.error('Download failed:', error);
    return { success: false, error: error.message };
  }
});

// Download file helper function
function downloadFile(url, filePath, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize > 0 && onProgress) {
          const progress = Math.round((downloadedSize / totalSize) * 100);
          onProgress(progress);
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve(filePath);
      });
      
      file.on('error', (err) => {
        fs.unlink(filePath, () => {}); // Delete partial file
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Check for updates manually
ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return {
      available: result.updateInfo.version !== app.getVersion(),
      version: result.updateInfo.version,
      releaseNotes: result.updateInfo.releaseNotes
    };
  } catch (error) {
    console.error('Manual update check failed:', error);
    return { available: false, error: error.message };
  }
});

// Restart app
ipcMain.handle('restart-app', () => {
  app.relaunch();
  app.exit();
});

// Auto-check for updates on startup (after app is ready)
app.whenReady().then(() => {
  createWindow();
  createTray();

  // Register global shortcuts
  globalShortcut.register('F1', () => {
    if (mainWindow) {
      mainWindow.webContents.send('global-shortcut', { key: 'F1', action: 'toggle' });
    }
  });

  // Check for updates 3 seconds after startup
  setTimeout(() => {
    if (!isDev) {
      console.log('Checking for updates...');
      autoUpdater.checkForUpdatesAndNotify();
    }
  }, 3000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

module.exports = { mainWindow, tray };