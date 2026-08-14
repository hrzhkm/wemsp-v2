import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from './config';

type Language = 'en' | 'ms';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const normalizeLanguage = (value: unknown): Language | undefined => {
  if (value === 'en' || value === 'ms') {
    return value;
  }
  return undefined;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const [language, setLanguageState] = useState<Language>(normalizeLanguage(i18n.language) || 'en');

  const applyLanguage = (lang: Language) => {
    setLanguageState(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('i18nextLng', lang);
    document.documentElement.lang = lang;
  };

  useEffect(() => {
    const initializeLanguage = async () => {
      const savedLang = normalizeLanguage(localStorage.getItem('i18nextLng'));
      if (savedLang) {
        applyLanguage(savedLang);
      }

      try {
        const response = await fetch('/api/user/notification-preferences', {
          method: 'GET',
        });

        if (!response.ok) return;

        const data = await response.json();
        const preferredLanguage = normalizeLanguage(data?.settings?.preferredLanguage);
        if (preferredLanguage) {
          applyLanguage(preferredLanguage);
        }
      } catch {
        // Ignore preference bootstrap failures and keep current language.
      }
    };

    initializeLanguage();
  }, []);

  const setLanguage = (lang: Language) => {
    applyLanguage(lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
