const { app, BrowserWindow } = require('electron');
const path = require('path');

// Requerir el backend directamente en el proceso principal
require(path.join(__dirname, 'backend', 'server.js'));

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    title: 'Terra Frutos Secos - POS',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Esperar 1.5 segundos para asegurar que Express esté escuchando en el puerto 3000
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:3000');
  }, 1500);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});