// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels =
  | 'ipc-example'
  | 'menu:save-agreement'
  | 'menu:load-agreement'
  | 'projects:create'
  | 'projects:list'
  | 'projects:open'
  | 'projects:rename'
  | 'projects:duplicate'
  | 'projects:delete'
  | 'projects:reveal'
  | 'projects:save-agreement-data'
  | 'projects:load-agreement-data'
  | 'config:get'
  | 'config:update'
  | 'config:choose-templates';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    invoke(channel: string, ...args: unknown[]) {
      return ipcRenderer.invoke(channel, ...args);
    },
    on(channel: Channels | string, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels | string, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
