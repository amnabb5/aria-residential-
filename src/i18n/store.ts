'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Language = 'en' | 'fr' | 'ar';

interface I18nState {
  language: Language;
  setLanguage: (lang: Language) => void;
  initLanguage: () => void;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (lang: Language) => {
        set({ language: lang });
        if (typeof document !== 'undefined') {
          document.documentElement.lang = lang;
          document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        }
      },
      initLanguage: () => {
        if (typeof window === 'undefined') return;
        // Only set auto-detected language if we haven't manually saved one in localStorage
        const stored = localStorage.getItem('i18n-store');
        let detected: Language = 'en';
        
        if (!stored || !JSON.parse(stored).state?.language) {
          const browserLang = navigator.language.slice(0, 2).toLowerCase();
          if (browserLang === 'fr') detected = 'fr';
          else if (browserLang === 'ar') detected = 'ar';
          else detected = 'en';
          
          set({ language: detected });
        } else {
          detected = JSON.parse(stored).state.language as Language;
        }

        // Apply HTML attributes
        document.documentElement.lang = detected;
        document.documentElement.dir = detected === 'ar' ? 'rtl' : 'ltr';
      },
    }),
    {
      name: 'i18n-store',
      // We handle the DOM side-effects manually in initLanguage and setLanguage,
      // but Zustand will persist the active language string.
    }
  )
);
