'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pixelRounded', Object.freeze({
  openImage: () => ipcRenderer.invoke('pixel-rounded:open'),
  saveImage: payload => ipcRenderer.invoke('pixel-rounded:save', payload),
  platform: process.platform
}));
