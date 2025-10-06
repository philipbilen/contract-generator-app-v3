import fs from 'fs';
import path from 'path';
import { app } from 'electron';

interface WorkspaceConfig {
  root: string | null;
}

const CONFIG_FILENAME = 'workspace.json';

function getConfigPath() {
  const userDataDir = app.getPath('userData');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  return path.join(userDataDir, CONFIG_FILENAME);
}

function readConfig(): WorkspaceConfig {
  try {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
      return { root: null };
    }

    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as WorkspaceConfig;

    return {
      root: typeof parsed.root === 'string' ? parsed.root : null,
    };
  } catch {
    // If the config is malformed, reset it.
    return { root: null };
  }
}

function writeConfig(config: WorkspaceConfig) {
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

export function getWorkspaceRoot() {
  const { root } = readConfig();
  return root ? path.resolve(root) : null;
}

export function setWorkspaceRoot(rootPath: string) {
  const resolved = path.resolve(rootPath);
  fs.mkdirSync(resolved, { recursive: true });
  writeConfig({ root: resolved });
  return resolved;
}

export function clearWorkspaceRoot() {
  writeConfig({ root: null });
}

export function workspaceRootExists() {
  const root = getWorkspaceRoot();
  return Boolean(root && fs.existsSync(root));
}

export function ensureWorkspaceRoot() {
  const root = getWorkspaceRoot();
  if (!root) {
    return { root: null, exists: false };
  }

  const exists = fs.existsSync(root);
  if (!exists) {
    return { root, exists: false };
  }

  return { root, exists: true };
}
