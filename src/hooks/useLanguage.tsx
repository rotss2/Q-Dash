import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  Locale, 
  DEFAULT_LOCALE, 
  SUPPORTED_LOCALES, 
  getBrowserLocale, 
  getTranslations,
  getLocaleDisplayName,
  Translations 
} from '../lib/i18n';

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  translations: Translations;
  t: (key: keyof Translations) => string;
  supportedLocales: Locale[];
  getDisplayName: (locale: Locale) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const STORAGE_KEY = 'q-dash-language';

interface LanguageProviderProps {
  children: ReactNode;
  defaultLocale?: Locale;
  surveySupportedLanguages?: string[];
}

export function LanguageProvider({ 
  children, 
  defaultLocale,
  surveySupportedLanguages 
}: LanguageProviderProps) {
  // Determine initial locale
  const getInitialLocale = (): Locale => {
    // 1. Use survey-specific default if provided
    if (defaultLocale && SUPPORTED_LOCALES.includes(defaultLocale)) {
      return defaultLocale;
    }
    
    // 2. Try to get from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale;
      if (stored && SUPPORTED_LOCALES.includes(stored)) {
        return stored;
      }
    } catch {
      // localStorage might be disabled
    }
    
    // 3. Use browser locale if survey supports it
    const browserLocale = getBrowserLocale();
    if (surveySupportedLanguages) {
      const supported = surveySupportedLanguages as Locale[];
      if (supported.includes(browserLocale)) {
        return browserLocale;
      }
      // Return first supported language if browser locale not supported
      if (supported.length > 0 && SUPPORTED_LOCALES.includes(supported[0])) {
        return supported[0];
      }
    }
    
    // 4. Fall back to default
    return DEFAULT_LOCALE;
  };

  const [locale, setLocaleState] = useState<Locale>(getInitialLocale());
  const [translations, setTranslations] = useState<Translations>(getTranslations(locale));

  // Update translations when locale changes
  useEffect(() => {
    setTranslations(getTranslations(locale));
  }, [locale]);

  // Persist locale to localStorage
  const setLocale = (newLocale: Locale) => {
    if (!SUPPORTED_LOCALES.includes(newLocale)) {
      console.warn(`Unsupported locale: ${newLocale}`);
      return;
    }
    
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // localStorage might be disabled
    }
    
    // Update HTML lang attribute
    document.documentElement.lang = newLocale;
  };

  // Initialize HTML lang attribute
  useEffect(() => {
    document.documentElement.lang = locale;
  }, []);

  // Translation function
  const t = (key: keyof Translations): string => {
    return translations[key] || key;
  };

  const getDisplayName = (loc: Locale): string => {
    return getLocaleDisplayName(loc);
  };

  // Filter available locales based on survey support
  const availableLocales = surveySupportedLanguages 
    ? SUPPORTED_LOCALES.filter(loc => surveySupportedLanguages.includes(loc))
    : SUPPORTED_LOCALES;

  const value: LanguageContextType = {
    locale,
    setLocale,
    translations,
    t,
    supportedLocales: availableLocales,
    getDisplayName,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
