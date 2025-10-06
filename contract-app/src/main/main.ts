/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import fs from 'fs'; // Added for file system operations
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'; // Added ipcMain and dialog
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath, getContractTemplatesPath } from './util';
import {
  getAppConfig,
  updateAppConfig,
  promptForTemplateDirectory,
} from './config';
import type { AppConfigUpdate } from '../common/types';

// --- OUR CUSTOM IMPORTS ---
import { checkLatex, generateConfig, compilePdf } from './generator';
import { ensureWorkspaceRoot, setWorkspaceRoot } from './workspace';
// --------------------------

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

ipcMain.handle('workspace:get', async () => {
  return ensureWorkspaceRoot();
});

ipcMain.handle('workspace:set', async (_event, rootPath: unknown) => {
  if (typeof rootPath !== 'string' || rootPath.trim().length === 0) {
    return { success: false, message: 'Invalid workspace path' };
  }

  try {
    const normalized = setWorkspaceRoot(rootPath);
    return { success: true, root: normalized };
  } catch (error: any) {
    log.error('Failed to set workspace root:', error);
    dialog.showErrorBox(
      'Workspace Error',
      `Could not set workspace root: ${error.message}`,
    );
    return { success: false, message: error.message };
  }
});

ipcMain.handle('workspace:choose', async () => {
  const targetWindow =
    BrowserWindow.getFocusedWindow() ?? mainWindow ?? undefined;

  const { canceled, filePaths } = await dialog.showOpenDialog(targetWindow, {
    title: 'Select Workspace Root',
    properties: ['openDirectory', 'createDirectory'],
  });

  if (canceled || !filePaths || filePaths.length === 0) {
    return { canceled: true };
  }

  return { canceled: false, path: filePaths[0] };
});

ipcMain.handle('config:get', async () => {
  try {
    return { success: true, config: getAppConfig() };
  } catch (error: any) {
    log.error('Failed to load config:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('config:update', async (_event, payload: AppConfigUpdate) => {
  try {
    const updated = updateAppConfig(payload ?? {});
    return { success: true, config: updated };
  } catch (error: any) {
    log.error('Failed to update config:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('config:choose-templates', async () => {
  try {
    const selection = await promptForTemplateDirectory();
    if (!selection) {
      return { canceled: true };
    }
    return { canceled: false, path: selection };
  } catch (error: any) {
    log.error('Failed to choose templates directory:', error);
    return { canceled: true, message: error.message };
  }
});

const getProjectsRoot = () => {
  return path.join(app.getPath('documents'), 'Engeloop_Contracts');
};

const isWithinDirectory = (parent: string, candidate: string) => {
  const normalizedParent = path.resolve(parent);
  const normalizedCandidate = path.resolve(candidate);

  if (normalizedParent === normalizedCandidate) {
    return false;
  }

  const relative = path.relative(normalizedParent, normalizedCandidate);
  return (
    relative.length > 0 &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative)
  );
};

// Sanitize a string to be a valid filename
const sanitizeFilename = (name: string) => {
  if (typeof name !== 'string') {
    return '';
  }

  const normalized = name.normalize('NFKC').trim();
  if (normalized.length === 0) {
    return '';
  }

  const withUnderscores = normalized.replace(/\s+/g, '_');
  const sanitized = withUnderscores
    .replace(/["<>:/\\|?*]/g, '')
    .replace(/[^\p{L}\p{N}_.-]/gu, '');

  return sanitized.replace(/_{2,}/g, '_').replace(/^\.+/, '');
};

const compactToken = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

  if (!normalized) {
    return fallback;
  }

  const token = normalized
    .split(/\s+/)
    .map((part) =>
      part.length === 0
        ? ''
        : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join('');

  return token || fallback;
};

const buildPdfBaseName = (agreementData: any): string => {
  const titleToken = compactToken(agreementData?.releaseTitle, 'Release');

  const mainArtistsRaw = Array.isArray(agreementData?.mainArtists)
    ? (agreementData.mainArtists as unknown[])
    : [];
  const artistTokenList = mainArtistsRaw
    .map((artist) =>
      typeof artist === 'string' ? compactToken(artist, '') : '',
    )
    .filter((token): token is string => token.length > 0);
  const artistsToken =
    artistTokenList.length > 0 ? artistTokenList.join('-') : 'UnknownArtist';

  const rawDateISO = (() => {
    if (typeof agreementData?.releaseDateISO === 'string') {
      return agreementData.releaseDateISO.trim();
    }
    if (typeof agreementData?.releaseDate === 'string') {
      return agreementData.releaseDate.trim();
    }
    return '';
  })();

  let dateToken = 'DateUnknown';
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDateISO)) {
    dateToken = rawDateISO;
  } else if (rawDateISO.length > 0) {
    const parsed = new Date(rawDateISO);
    if (!Number.isNaN(parsed.getTime())) {
      dateToken = parsed.toISOString().slice(0, 10);
    }
  }

  const baseName = `${titleToken}_${artistsToken}_${dateToken}`;
  const sanitized = sanitizeFilename(baseName);
  return sanitized.length > 0 ? sanitized : 'Engeloop_Agreement';
};

// --- OUR CUSTOM PDF GENERATION HANDLER ---
ipcMain.handle(
  'generate-pdf',
  async (
    event,
    agreementData,
    projectPath: string,
    options: { mode?: 'preview' | 'final' } = {},
  ) => {
    try {
      // Determine the paths relative to the running application
      const contractTemplatesPath = getContractTemplatesPath();
      // Use the provided projectPath for output
      const agreementsOutputPath = projectPath;

      // Create the output directory if it doesn't exist (projectPath should already exist, but good to be safe)
      if (!fs.existsSync(agreementsOutputPath)) {
        fs.mkdirSync(agreementsOutputPath, { recursive: true });
      }

      // 1. Generate the config file inside the project directory
      generateConfig(agreementData, agreementsOutputPath); // Pass projectPath as output dir

      // 2. Compile the PDF, outputting to the project directory
      const pdfBaseName =
        options.mode === 'final'
          ? buildPdfBaseName(agreementData)
          : 'master-agreement-template';
      const pdfPath = await compilePdf(
        contractTemplatesPath,
        agreementsOutputPath,
        pdfBaseName,
      );

      // Let the UI know it was successful
      return { success: true, pdfPath };
    } catch (error: any) {
      console.error('Error in generate-pdf IPC handler:', error);
      // Display a user-friendly error box
      dialog.showErrorBox(
        'PDF Generation Error',
        `An error occurred during PDF generation: ${error.message}`,
      );
      return { success: false, message: error.message };
    }
  },
);
ipcMain.handle('get-pdf-data', async (event, filePath) => {
  try {
    // Return the raw buffer, which is more efficient.
    return fs.readFileSync(filePath);
  } catch (error: any) {
    log.error('Error reading PDF file:', error);
    dialog.showErrorBox(
      'Error Reading PDF',
      `Could not read PDF file: ${error.message}`,
    );
    return null;
  }
});

ipcMain.handle('save-agreement-data', async (_event, agreementData) => {
  const targetWindow =
    BrowserWindow.getFocusedWindow() ?? mainWindow ?? undefined;

  const { canceled, filePath } = await dialog.showSaveDialog(targetWindow, {
    title: 'Save Agreement',
    defaultPath: 'engeloop-agreement.json',
    filters: [{ name: 'Agreement JSON', extensions: ['json'] }],
  });

  if (canceled || !filePath) {
    return { success: false, canceled: true };
  }

  try {
    fs.writeFileSync(filePath, JSON.stringify(agreementData, null, 2), 'utf8');
    return { success: true, filePath };
  } catch (error: any) {
    log.error('Failed to save agreement data:', error);
    dialog.showErrorBox(
      'Save Failed',
      `Could not save the agreement: ${error.message}`,
    );
    return { success: false, message: error.message };
  }
});

ipcMain.handle('load-agreement-data', async () => {
  const targetWindow =
    BrowserWindow.getFocusedWindow() ?? mainWindow ?? undefined;

  const { canceled, filePaths } = await dialog.showOpenDialog(targetWindow, {
    title: 'Load Agreement',
    properties: ['openFile'],
    filters: [{ name: 'Agreement JSON', extensions: ['json'] }],
  });

  if (canceled || !filePaths || filePaths.length === 0) {
    return { success: false, canceled: true };
  }

  const filePath = filePaths[0];

  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContents);
    return { success: true, filePath, data };
  } catch (error: any) {
    log.error('Failed to load agreement data:', error);
    dialog.showErrorBox(
      'Load Failed',
      `Could not load the agreement: ${error.message}`,
    );
    return { success: false, message: error.message };
  }
});

const getArtistString = (mainArtists: unknown): string | undefined => {
  if (!Array.isArray(mainArtists) || mainArtists.length === 0) {
    return undefined;
  }

  const artistNames = mainArtists.filter(
    (artist) => typeof artist === 'string' && artist.trim().length > 0,
  );

  if (artistNames.length === 0) {
    return undefined;
  }

  if (artistNames.length === 1) {
    return artistNames[0];
  }

  if (artistNames.length === 2) {
    return `${artistNames[0]} and ${artistNames[1]}`;
  }

  const lastArtist = artistNames[artistNames.length - 1];
  const otherArtists = artistNames.slice(0, -1).join(', ');
  return `${otherArtists}, and ${lastArtist}`;
};

ipcMain.handle('projects:list', async () => {
  const projectsRoot = getProjectsRoot();
  try {
    if (!fs.existsSync(projectsRoot)) {
      fs.mkdirSync(projectsRoot, { recursive: true });
    }

    const projectFolders = fs.readdirSync(projectsRoot, {
      withFileTypes: true,
    });

    const projects = projectFolders
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => {
        const projectPath = path.join(projectsRoot, dirent.name);
        const dataPath = path.join(projectPath, 'agreement_data.json');
        let artists: string | undefined;

        try {
          if (fs.existsSync(dataPath)) {
            const fileContents = fs.readFileSync(dataPath, 'utf8');
            const data = JSON.parse(fileContents);
            artists = getArtistString(data?.mainArtists);
          }
        } catch (error) {
          log.warn(
            `Could not read or parse metadata for project ${dirent.name}:`,
            error,
          );
        }

        return {
          name: dirent.name.replace(/_/g, ' '),
          path: projectPath,
          artists,
        };
      });

    return { success: true, projects };
  } catch (error: any) {
    log.error('Failed to list projects:', error);
    dialog.showErrorBox(
      'Error Listing Projects',
      `Could not read project directory: ${error.message}`,
    );
    return { success: false, message: error.message };
  }
});

ipcMain.handle('projects:create', async (_event, projectName: unknown) => {
  if (typeof projectName !== 'string' || projectName.trim().length === 0) {
    return { success: false, message: 'Invalid project name' };
  }

  const projectsRoot = getProjectsRoot();
  const trimmedName = projectName.trim();
  const sanitizedName = sanitizeFilename(trimmedName);
  if (sanitizedName.length === 0) {
    return {
      success: false,
      message: 'Project name contains only unsupported characters.',
    };
  }

  if (!fs.existsSync(projectsRoot)) {
    fs.mkdirSync(projectsRoot, { recursive: true });
  }

  const projectPath = path.join(projectsRoot, sanitizedName);
  if (!isWithinDirectory(projectsRoot, projectPath)) {
    return { success: false, message: 'Invalid project path.' };
  }

  try {
    if (fs.existsSync(projectPath)) {
      return {
        success: false,
        message: 'Project with this name already exists.',
      };
    }

    fs.mkdirSync(projectPath, { recursive: true });

    const newProject = {
      name: trimmedName,
      path: projectPath,
    };

    return { success: true, project: newProject };
  } catch (error: any) {
    log.error('Failed to create project:', error);
    dialog.showErrorBox(
      'Error Creating Project',
      `Could not create project directory: ${error.message}`,
    );
    return { success: false, message: error.message };
  }
});

ipcMain.handle(
  'projects:rename',
  async (
    _event,
    { currentPath, newName }: { currentPath: string; newName: string },
  ) => {
    if (typeof newName !== 'string' || newName.trim().length === 0) {
      return { success: false, message: 'Invalid new project name' };
    }

    const projectsRoot = getProjectsRoot();
    const sanitizedNewName = sanitizeFilename(newName.trim());
    if (sanitizedNewName.length === 0) {
      return {
        success: false,
        message: 'New project name contains only unsupported characters.',
      };
    }
    const newPath = path.join(projectsRoot, sanitizedNewName);
    if (!isWithinDirectory(projectsRoot, newPath)) {
      return { success: false, message: 'Invalid project path.' };
    }

    try {
      if (
        !isWithinDirectory(projectsRoot, currentPath) ||
        !fs.existsSync(currentPath)
      ) {
        return {
          success: false,
          message: 'Project could not be located for renaming.',
        };
      }

      if (fs.existsSync(newPath)) {
        return {
          success: false,
          message: 'A project with that name already exists.',
        };
      }

      fs.renameSync(currentPath, newPath);

      const updatedProject = {
        name: newName.trim(),
        path: newPath,
      };

      return { success: true, project: updatedProject };
    } catch (error: any) {
      log.error(
        `Failed to rename project from ${currentPath} to ${newPath}:`,
        error,
      );
      dialog.showErrorBox(
        'Error Renaming Project',
        `Could not rename project: ${error.message}`,
      );
      return { success: false, message: error.message };
    }
  },
);

ipcMain.handle(
  'projects:duplicate',
  async (
    _event,
    { sourcePath, newName }: { sourcePath: string; newName: string },
  ) => {
    if (typeof newName !== 'string' || newName.trim().length === 0) {
      return { success: false, message: 'Invalid project name' };
    }

    if (typeof sourcePath !== 'string' || sourcePath.trim().length === 0) {
      return { success: false, message: 'Invalid source project path' };
    }

    const projectsRoot = getProjectsRoot();
    if (
      !isWithinDirectory(projectsRoot, sourcePath) ||
      !fs.existsSync(sourcePath)
    ) {
      return {
        success: false,
        message: 'Source project could not be located.',
      };
    }

    const sanitizedNewName = sanitizeFilename(newName.trim());
    if (sanitizedNewName.length === 0) {
      return {
        success: false,
        message: 'Project name contains only unsupported characters.',
      };
    }

    const targetPath = path.join(projectsRoot, sanitizedNewName);
    if (!isWithinDirectory(projectsRoot, targetPath)) {
      return { success: false, message: 'Invalid project destination.' };
    }

    if (fs.existsSync(targetPath)) {
      return {
        success: false,
        message: 'A project with that name already exists.',
      };
    }

    try {
      fs.cpSync(sourcePath, targetPath, { recursive: true });
      const duplicatedProject = {
        name: newName.trim(),
        path: targetPath,
      };
      return { success: true, project: duplicatedProject };
    } catch (error: any) {
      log.error(`Failed to duplicate project ${sourcePath}:`, error);
      dialog.showErrorBox(
        'Error Duplicating Project',
        `Could not duplicate project: ${error.message}`,
      );
      return { success: false, message: error.message };
    }
  },
);

ipcMain.handle('projects:delete', async (_event, projectPath: unknown) => {
  if (typeof projectPath !== 'string' || projectPath.trim().length === 0) {
    return { success: false, message: 'Invalid project path' };
  }

  const projectsRoot = getProjectsRoot();
  if (
    !isWithinDirectory(projectsRoot, projectPath) ||
    !fs.existsSync(projectPath)
  ) {
    return { success: false, message: 'Project could not be located.' };
  }

  try {
    fs.rmSync(projectPath, { recursive: true, force: true });
    return { success: true };
  } catch (error: any) {
    log.error(`Failed to delete project at ${projectPath}:`, error);
    dialog.showErrorBox(
      'Error Deleting Project',
      `Could not delete project: ${error.message}`,
    );
    return { success: false, message: error.message };
  }
});

ipcMain.handle('projects:reveal', async (_event, projectPath: unknown) => {
  if (typeof projectPath !== 'string' || projectPath.trim().length === 0) {
    return { success: false, message: 'Invalid project path' };
  }

  const projectsRoot = getProjectsRoot();
  if (
    !isWithinDirectory(projectsRoot, projectPath) ||
    !fs.existsSync(projectPath)
  ) {
    return { success: false, message: 'Project could not be located.' };
  }

  try {
    shell.showItemInFolder(path.resolve(projectPath));
    return { success: true };
  } catch (error: any) {
    log.error(`Failed to reveal project at ${projectPath}:`, error);
    dialog.showErrorBox(
      'Error Revealing Project',
      `Could not reveal project folder: ${error.message}`,
    );
    return { success: false, message: error.message };
  }
});

ipcMain.handle(
  'projects:save-agreement-data',
  async (
    _event,
    { projectPath, agreementData }: { projectPath: string; agreementData: any },
  ) => {
    const filePath = path.join(projectPath, 'agreement_data.json');
    try {
      fs.writeFileSync(
        filePath,
        JSON.stringify(agreementData, null, 2),
        'utf8',
      );
      return { success: true };
    } catch (error: any) {
      log.error(
        `Failed to save agreement data for project ${projectPath}:`,
        error,
      );
      dialog.showErrorBox(
        'Error Saving Data',
        `Could not save agreement data: ${error.message}`,
      );
      return { success: false, message: error.message };
    }
  },
);

ipcMain.handle(
  'projects:load-agreement-data',
  async (_event, projectPath: string) => {
    const filePath = path.join(projectPath, 'agreement_data.json');
    try {
      if (fs.existsSync(filePath)) {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContents);
        return { success: true, data };
      }
      return { success: true, data: null }; // No data file found, which is fine for new projects
    } catch (error: any) {
      log.error(
        `Failed to load agreement data for project ${projectPath}:`,
        error,
      );
      dialog.showErrorBox(
        'Error Loading Data',
        `Could not load agreement data: ${error.message}`,
      );
      return { success: false, message: error.message };
    }
  },
);

// ----------------------------------------

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  import('electron-debug')
    .then(({ default: installDebug }) => {
      installDebug();
    })
    .catch((error) => {
      log.warn('Failed to load electron-debug:', error);
    });
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch((error: unknown) => {
      log.info('Devtools installer message:', error);
    });
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(async () => {
    try {
      getAppConfig();
    } catch (error) {
      log.error('Configuration failed to load:', error);
    }

    // --- OUR CUSTOM LATEX CHECK ---
    try {
      await checkLatex();
      console.log('LaTeX dependency check passed.');
    } catch (error) {
      console.error(
        'LaTeX dependency check failed. The application will now exit.',
        error,
      );
      app.quit(); // Exit the app if LaTeX is not found
      return; // Stop further execution
    }
    // ----------------------------

    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
