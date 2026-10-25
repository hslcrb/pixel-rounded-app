'use strict';

const { app, BrowserWindow, dialog, ipcMain, Menu, session, protocol, net } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MAX_INPUT_BYTES = 36 * 1024 * 1024;
const MAX_EXPORT_BYTES = 128 * 1024 * 1024;
let mainWindow;

protocol.registerSchemesAsPrivileged([{ scheme: 'pixelrounded', privileges: {
  standard: true, secure: true, supportFetchAPI: true
} }]);

function trustedIPC(event) {
  return !!mainWindow && !mainWindow.isDestroyed() &&
    event.sender === mainWindow.webContents &&
    event.senderFrame && event.senderFrame.url === 'pixelrounded://app/renderer/index.html';
}

function imageMime(buffer) {
  if (buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480, height: 940, minWidth: 1050, minHeight: 700,
    title: 'pixel-rounded',
    backgroundColor: '#11131b',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadURL('pixelrounded://app/renderer/index.html');
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', event => event.preventDefault());
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  protocol.handle('pixelrounded', request => {
    const url = new URL(request.url);
    if (url.hostname !== 'app' || !['GET', 'HEAD'].includes(request.method)) {
      return new Response('Not found', { status: 404 });
    }
    let filename;
    try { filename = decodeURIComponent(url.pathname); }
    catch { return new Response('Invalid path', { status: 400 }); }
    const resolved = path.resolve(__dirname, '.' + filename);
    const relative = path.relative(__dirname, resolved);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      return new Response('Access denied', { status: 403 });
    }
    return net.fetch(pathToFileURL(resolved).toString());
  });
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  ipcMain.handle('pixel-rounded:open', async event => {
    if (!trustedIPC(event)) throw new Error('허용되지 않은 요청입니다.');
    const response = await dialog.showOpenDialog(mainWindow, {
      title: '사진 가져오기',
      properties: ['openFile'],
      filters: [{ name: '사진', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
    });
    if (response.canceled || !response.filePaths.length) return null;
    const filePath = response.filePaths[0];
    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size > MAX_INPUT_BYTES) {
      throw new Error('파일 크기 제한: 36MB 이하의 이미지를 선택해 주세요.');
    }
    const buffer = await fs.readFile(filePath);
    const mime = imageMime(buffer);
    if (!mime) throw new Error('PNG, JPEG, WebP 사진만 지원합니다.');
    return { name: path.basename(filePath), mime, dataUrl: 'data:' + mime + ';base64,' + buffer.toString('base64') };
  });

  ipcMain.handle('pixel-rounded:save', async (event, payload) => {
    if (!trustedIPC(event)) throw new Error('허용되지 않은 요청입니다.');
    if (!payload || typeof payload.dataUrl !== 'string' || !['png', 'jpeg'].includes(payload.format)) {
      throw new Error('지원되지 않는 내보내기 요청입니다.');
    }
    const mime = payload.format === 'png' ? 'image/png' : 'image/jpeg';
    const prefix = 'data:' + mime + ';base64,';
    if (!payload.dataUrl.startsWith(prefix) || payload.dataUrl.length > MAX_EXPORT_BYTES * 1.38) {
      throw new Error('이미지 포맷이나 크기가 올바르지 않습니다.');
    }
    const binary = Buffer.from(payload.dataUrl.slice(prefix.length), 'base64');
    if (binary.length > MAX_EXPORT_BYTES || imageMime(binary) !== mime) {
      throw new Error('내보내기 이미지가 유효하지 않습니다.');
    }
    const extension = payload.format === 'png' ? 'png' : 'jpg';
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: '사진 내보내기',
      defaultPath: 'pixel-rounded-export.' + extension,
      filters: [{ name: payload.format.toUpperCase(), extensions: [extension] }]
    });
    if (canceled || !filePath) return { canceled: true };
    await fs.writeFile(filePath, binary);
    return { canceled: false, name: path.basename(filePath) };
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
