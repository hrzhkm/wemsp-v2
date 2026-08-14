import { useLanguage } from '@/lib/i18n/context';
import { Languages } from 'lucide-react';

export const LanguageSwitcher = () => {
  const { language, setLanguage, t } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ms' : 'en');
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition-all duration-200 font-medium border border-white/20"
      title={t('languageSwitcher.label')}
    >
      <Languages className="w-4 h-4" />
      <span className="uppercase">{language}</span>
    </button>
  );
};
