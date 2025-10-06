import fs from 'fs';
import path from 'path';
import { app, dialog, BrowserWindow } from 'electron';
import type {
  AppConfig,
  AppConfigUpdate,
  AgreementDefaults,
  LegacyArtistDefaults,
} from '../common/types';

function deriveFromLegacyArtists(
  legacyArtists: LegacyArtistDefaults[],
): Pick<
  AgreementDefaults,
  'mainArtists' | 'featuredArtists' | 'licensors' | 'royaltyParties'
> {
  const mainArtists: string[] = [];
  const featuredArtists: string[] = [];
  const licensors = legacyArtists.map((artist) => ({
    stageName: artist.stageName ?? '',
    legalName: artist.legalName ?? '',
    address: artist.address ?? '',
    email: artist.email ?? '',
  }));
  const royaltyParties = legacyArtists.map((artist) => ({
    displayName: artist.stageName ?? '',
    legalName: artist.legalName ?? '',
    role: artist.role ?? 'Artist',
    royaltyShare: artist.royaltyShare,
    email: artist.email ?? '',
  }));

  legacyArtists.forEach((artist) => {
    const stageName = artist.stageName?.trim();
    if (!stageName) {
      return;
    }
    const role = (artist.role ?? '').toLowerCase();
    if (role.includes('main')) {
      mainArtists.push(stageName);
    } else if (role.includes('featured')) {
      featuredArtists.push(stageName);
    }
  });

  return {
    mainArtists,
    featuredArtists,
    licensors,
    royaltyParties,
  };
}

const BASE_CONFIG_DIR = 'config';
const BASE_CONFIG_FILENAME = 'base-config.json';
const USER_CONFIG_FILENAME = 'config.json';

let cachedBaseConfig: AppConfig | null = null;
let cachedUserConfig: AppConfigUpdate | null = null;
let cachedMergedConfig: AppConfig | null = null;

function getBaseConfigPath() {
  return path.join(app.getAppPath(), BASE_CONFIG_DIR, BASE_CONFIG_FILENAME);
}

function getUserConfigPath() {
  return path.join(app.getPath('userData'), USER_CONFIG_FILENAME);
}

function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

function ensureDirExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function mergeAgreementDefaults(
  base: AgreementDefaults,
  override: AgreementDefaults | undefined,
): AgreementDefaults {
  if (!override) {
    return { ...base };
  }

  const merged: AgreementDefaults = { ...base };
  Object.entries(override).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    if (
      (key === 'artists' ||
        key === 'mainArtists' ||
        key === 'featuredArtists' ||
        key === 'licensors' ||
        key === 'royaltyParties') &&
      Array.isArray(value)
    ) {
      (merged as Record<string, unknown>)[key] = Array.isArray(value)
        ? value.map((item) =>
            typeof item === 'object' && item !== null
              ? { ...(item as Record<string, unknown>) }
              : item,
          )
        : value;
      return;
    }
    (merged as Record<string, unknown>)[key] = value;
  });

  if (Array.isArray(merged.artists) && merged.artists.length) {
    const hasNewData =
      (Array.isArray(merged.licensors) && merged.licensors.length > 0) ||
      (Array.isArray(merged.royaltyParties) &&
        merged.royaltyParties.length > 0);

    if (!hasNewData) {
      const derived = deriveFromLegacyArtists(merged.artists);
      merged.mainArtists = merged.mainArtists?.length
        ? merged.mainArtists
        : derived.mainArtists;
      merged.featuredArtists = merged.featuredArtists?.length
        ? merged.featuredArtists
        : derived.featuredArtists;
      merged.licensors = merged.licensors?.length
        ? merged.licensors
        : derived.licensors;
      merged.royaltyParties = merged.royaltyParties?.length
        ? merged.royaltyParties
        : derived.royaltyParties;
    }
  }

  return merged;
}

function buildMergedConfig(base: AppConfig, user: AppConfigUpdate): AppConfig {
  return {
    agreementDefaults: mergeAgreementDefaults(
      base.agreementDefaults,
      user.agreementDefaults,
    ),
    templateDirectory:
      typeof user.templateDirectory === 'string' &&
      user.templateDirectory.trim().length > 0
        ? user.templateDirectory.trim()
        : base.templateDirectory,
  };
}

function loadBaseConfig(): AppConfig {
  if (!cachedBaseConfig) {
    const basePath = getBaseConfigPath();
    cachedBaseConfig = readJsonFile<AppConfig>(basePath);
  }
  return cachedBaseConfig;
}

function loadUserConfig(): AppConfigUpdate {
  if (cachedUserConfig) {
    return cachedUserConfig;
  }
  const userPath = getUserConfigPath();
  if (fs.existsSync(userPath)) {
    cachedUserConfig = readJsonFile<AppConfigUpdate>(userPath);
  } else {
    cachedUserConfig = {};
  }
  return cachedUserConfig;
}

function persistUserConfig(config: AppConfigUpdate) {
  const userPath = getUserConfigPath();
  ensureDirExists(path.dirname(userPath));
  fs.writeFileSync(userPath, JSON.stringify(config, null, 2), 'utf8');
}

export function getAppConfig(): AppConfig {
  if (cachedMergedConfig) {
    return cachedMergedConfig;
  }
  const base = loadBaseConfig();
  const user = loadUserConfig();
  cachedMergedConfig = buildMergedConfig(base, user);
  return cachedMergedConfig;
}

export function updateAppConfig(update: AppConfigUpdate): AppConfig {
  const base = loadBaseConfig();
  const currentUser = loadUserConfig();

  const nextUser: AppConfigUpdate = {
    ...currentUser,
    ...update,
  };

  if (update.agreementDefaults && currentUser.agreementDefaults) {
    nextUser.agreementDefaults = {
      ...currentUser.agreementDefaults,
      ...update.agreementDefaults,
    };
  }

  if (typeof nextUser.templateDirectory === 'string') {
    const trimmed = nextUser.templateDirectory.trim();
    nextUser.templateDirectory = trimmed.length > 0 ? trimmed : '';
  }

  persistUserConfig(nextUser);
  cachedUserConfig = nextUser;
  cachedMergedConfig = buildMergedConfig(base, nextUser);
  return cachedMergedConfig;
}

export function resetConfigCache() {
  cachedBaseConfig = null;
  cachedUserConfig = null;
  cachedMergedConfig = null;
}

export async function promptForTemplateDirectory(): Promise<string | null> {
  const targetWindow = BrowserWindow.getFocusedWindow() ?? undefined;
  const result = await dialog.showOpenDialog(targetWindow, {
    title: 'Select Contract Templates Directory',
    properties: ['openDirectory', 'createDirectory'],
  });

  if (result.canceled || !result.filePaths?.length) {
    return null;
  }

  return result.filePaths[0];
}
