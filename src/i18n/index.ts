// chatup/frontend/src/i18n/index.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Import modular language files
import enTranslation from "./locales/en/translation.json";
import fiTranslation from "./locales/fi/translation.json";
import svTranslation from "./locales/sw/translation.json";

i18n.use(initReactI18next).init({
    resources: {
        en: {
            translation: enTranslation,
        },
        fi: {
            translation: fiTranslation,
        },
        sv: {
            translation: svTranslation,
        },
    },
    lng: "en", // Default starting language
    fallbackLng: "en",
    interpolation: {
        escapeValue: false, // React already escapes values safely
    },
});

export default i18n;