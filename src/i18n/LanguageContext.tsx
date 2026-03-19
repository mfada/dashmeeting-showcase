// Language context provider – provides i18n translations
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import en from "./en";
import es from "./es";
import type { Translations } from "./en";

type Lang = "en" | "es";

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translations;
}

const translations: Record<Lang, Translations> = { en, es };

const LanguageCtx = createContext<LanguageContextType | undefined>(undefined);

function detectLanguage(): Lang {
  const stored = localStorage.getItem("app-lang") as Lang | null;
  if (stored && translations[stored]) return stored;
  const browserLang = navigator.language.slice(0, 2);
  return browserLang === "es" ? "es" : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLanguage);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("app-lang", l);
  };

  return (
    <LanguageCtx.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LanguageCtx.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageCtx);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
