import { createContext, useContext } from 'react';
import type { AppConfig, AppConfigUpdate } from '../common/types';

type UpdateHandler = (update: AppConfigUpdate) => Promise<void>;

type ConfigContextValue = {
  config: AppConfig | null;
  refreshConfig: () => Promise<void>;
  updateConfig: UpdateHandler;
};

const defaultValue: ConfigContextValue = {
  config: null,
  refreshConfig: async () => {},
  updateConfig: async () => {},
};

export const ConfigContext = createContext<ConfigContextValue>(defaultValue);

export function useConfig() {
  return useContext(ConfigContext);
}
