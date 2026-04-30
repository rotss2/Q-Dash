import { useLanguage } from '../hooks/useLanguage';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
  variant?: 'dropdown' | 'inline' | 'minimal';
  className?: string;
}

export default function LanguageSwitcher({ 
  variant = 'dropdown',
  className = '' 
}: LanguageSwitcherProps) {
  const { locale, setLocale, supportedLocales, getDisplayName } = useLanguage();

  // Don't show if only one language is supported
  if (supportedLocales.length <= 1) {
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLocale(e.target.value as typeof locale);
  };

  if (variant === 'minimal') {
    return (
      <select
        value={locale}
        onChange={handleChange}
        className={`text-sm bg-transparent border-none focus:ring-0 cursor-pointer ${className}`}
        aria-label="Select language"
      >
        {supportedLocales.map((loc) => (
          <option key={loc} value={loc}>
            {loc.toUpperCase()}
          </option>
        ))}
      </select>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Globe className="w-4 h-4 text-gray-500" />
        <div className="flex gap-1">
          {supportedLocales.map((loc) => (
            <button
              key={loc}
              onClick={() => setLocale(loc)}
              className={`px-2 py-1 text-sm rounded transition-colors ${
                loc === locale
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              aria-label={`Switch to ${getDisplayName(loc)}`}
            >
              {getDisplayName(loc)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Dropdown variant (default)
  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-gray-500" />
        <select
          value={locale}
          onChange={handleChange}
          className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-1 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 cursor-pointer"
          aria-label="Select language"
        >
          {supportedLocales.map((loc) => (
            <option key={loc} value={loc}>
              {getDisplayName(loc)}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
