import React, { createContext, useContext, useMemo, useState } from 'react';
import i18n from '../i18n';

export type CurrencySymbol = 'Rs.' | 'रू';
export type DateMode = 'AD' | 'BS';
export type Language = 'en' | 'ne';

export interface AppSettings {
  currencySymbol: CurrencySymbol;
  vatRate: number;
  dateMode: DateMode;
  language: Language;
  businessName: string;
  businessAddress: string;
  panVatNumber: string;
}

const STORAGE_KEY = 'startup_erp_settings';

const defaultSettings: AppSettings = {
  currencySymbol: 'Rs.',
  vatRate: 13,
  dateMode: 'AD',
  language: 'en',
  businessName: 'Startup ERP',
  businessAddress: 'Kathmandu, Nepal',
  panVatNumber: '000000000',
};

const loadSettings = (): AppSettings => {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...defaultSettings, ...parsed };
  } catch {
    return defaultSettings;
  }
};

type SettingsContextValue = {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  setCurrencySymbol: (symbol: CurrencySymbol) => void;
  setDateMode: (mode: DateMode) => void;
  setLanguage: (language: Language) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  React.useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    void i18n.changeLanguage(settings.language);
  }, [settings]);

  const value = useMemo<SettingsContextValue>(() => ({
    settings,
    updateSettings: (partial) => setSettings((current) => ({ ...current, ...partial })),
    setCurrencySymbol: (currencySymbol) => setSettings((current) => ({ ...current, currencySymbol })),
    setDateMode: (dateMode) => setSettings((current) => ({ ...current, dateMode })),
    setLanguage: (language) => setSettings((current) => ({ ...current, language })),
  }), [settings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};

export { defaultSettings };
