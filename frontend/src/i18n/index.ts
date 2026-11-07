import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import en from "./en.json"
import fil from "./fil.json"

export const LANGUAGES = ["en", "fil"] as const
export type Language = (typeof LANGUAGES)[number]

export const LANGUAGE_STORAGE_KEY = "app-language"
const DEFAULT_LANGUAGE: Language = "en"

function isLanguage(value: unknown): value is Language {
  return LANGUAGES.includes(value as Language)
}

// The browser's own language is deliberately ignored: the interface is English
// until a person chooses Filipino from the profile menu.
function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

function applyDocumentLanguage(language: string) {
  document.documentElement.lang = language
}

export function setLanguage(language: Language) {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // Storage can be unavailable; the choice then lasts for this session only.
  }
  void i18n.changeLanguage(language)
}

const initialLanguage = readStoredLanguage()

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fil: { translation: fil },
  },
  lng: initialLanguage,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: [...LANGUAGES],
  interpolation: { escapeValue: false },
  returnNull: false,
})

applyDocumentLanguage(initialLanguage)
i18n.on("languageChanged", applyDocumentLanguage)

export default i18n
