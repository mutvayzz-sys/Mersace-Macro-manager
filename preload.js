const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // System information
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  
  // Global shortcuts
  registerGlobalShortcut: (key) => ipcRenderer.invoke('register-global-shortcut', key),
  unregisterGlobalShortcut: (key) => ipcRenderer.invoke('unregister-global-shortcut', key),
  onGlobalShortcut: (callback) => {
    ipcRenderer.on('global-shortcut', (event, data) => callback(data));
  },
  removeGlobalShortcutListener: (callback) => {
    ipcRenderer.removeListener('global-shortcut', callback);
  },
  
  // Key simulation
  simulateKeyPress: (key) => ipcRenderer.invoke('simulate-key-press', key),
  
  // Auto-updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: (options) => ipcRenderer.invoke('download-update', options),
  restartApp: () => ipcRenderer.invoke('restart-app'),
  
  // Auto-updater events
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (event, info) => callback(info));
  },
  onUpdateNotAvailable: (callback) => {
    ipcRenderer.on('update-not-available', (event, info) => callback(info));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (event, info) => callback(info));
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, progress) => callback(progress));
  },
  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', (event, error) => callback(error));
  },
  
  // Remove update listeners
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update-available');
    ipcRenderer.removeAllListeners('update-not-available');
    ipcRenderer.removeAllListeners('update-downloaded');
    ipcRenderer.removeAllListeners('download-progress');
    ipcRenderer.removeAllListeners('update-error');
  }
});

// Log when preload script is loaded
console.log('Preload script loaded successfully');