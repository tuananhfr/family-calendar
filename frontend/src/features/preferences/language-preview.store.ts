import { create } from "zustand";
import type { LanguageOptionCode } from "./languages";

interface LanguagePreviewState {
  language: LanguageOptionCode;
  selectLanguage: (language: LanguageOptionCode) => void;
}

// The selector is a UI preview; it must not change routes, document language or translations.
export const useLanguagePreviewStore = create<LanguagePreviewState>((set) => ({
  language: "vi",
  selectLanguage: (language) => set({ language }),
}));
