/* eslint import/prefer-default-export: off */
import { URL } from 'url';
import path from 'path';
import { app } from 'electron';
import { getAppConfig } from './config';

export function resolveHtmlPath(htmlFileName: string) {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || 1212;
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  }
  return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
}

// A new utility function to get the path to the contract-templates directory
export function getContractTemplatesPath() {
  // In development, the path is relative to the app's root directory
  const config = getAppConfig();
  const customPath = config.templateDirectory?.trim();
  if (customPath) {
    return customPath;
  }

  if (process.env.NODE_ENV === 'development') {
    return path.resolve(app.getAppPath(), '../contract-templates');
  }
  // In production, the path is relative to the executable
  return path.resolve(process.resourcesPath, 'contract-templates');
}
