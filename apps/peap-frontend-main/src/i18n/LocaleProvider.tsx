import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { translateText, type Locale } from "./translations";

const LOCALE_STORAGE_KEY = "matchcore.locale";
const TEXT_ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"] as const;

const textNodeOriginals = new WeakMap<Text, string>();
const attributeOriginals = new WeakMap<Element, Map<string, string>>();

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const isLocale = (value: unknown): value is Locale => value === "en" || value === "fr";

const canUseWindow = (): boolean => typeof window !== "undefined" && typeof document !== "undefined";

const readStoredLocale = (): Locale => {
  if (!canUseWindow()) {
    return "en";
  }
  const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return isLocale(raw) ? raw : "en";
};

const translateDomTree = (root: ParentNode, locale: Locale) => {
  if (!canUseWindow()) {
    return;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    const textNode = current as Text;
    const parent = textNode.parentElement;
    if (parent && !["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) {
      const original = textNodeOriginals.get(textNode) ?? textNode.textContent ?? "";
      if (!textNodeOriginals.has(textNode)) {
        textNodeOriginals.set(textNode, original);
      }
      const translated = translateText(original, locale);
      if ((textNode.textContent ?? "") !== translated) {
        textNode.textContent = translated;
      }
    }
    current = walker.nextNode();
  }

  root.querySelectorAll("*").forEach((element) => {
    let originals = attributeOriginals.get(element);
    if (!originals) {
      originals = new Map<string, string>();
      attributeOriginals.set(element, originals);
    }

    TEXT_ATTRIBUTES.forEach((attribute) => {
      const currentValue = element.getAttribute(attribute);
      if (!currentValue) {
        return;
      }
      if (!originals!.has(attribute)) {
        originals!.set(attribute, currentValue);
      }
      const translated = translateText(originals!.get(attribute) || currentValue, locale);
      if (element.getAttribute(attribute) !== translated) {
        element.setAttribute(attribute, translated);
      }
    });
  });
};

function LocaleTextSync({ locale }: { locale: Locale }) {
  useEffect(() => {
    if (!canUseWindow()) {
      return;
    }

    document.documentElement.lang = locale;

    const apply = () => {
      if (!document.body) {
        return;
      }
      translateDomTree(document.body, locale);
    };

    apply();

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(apply);
    });

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    return () => {
      observer.disconnect();
    };
  }, [locale]);

  return null;
}

function LanguageToggle() {
  const localeContext = useLocale();

  return (
    <div className="fixed bottom-4 right-4 z-[80] inline-flex items-center gap-1 rounded-full border border-border bg-background/95 p-1 shadow-lg backdrop-blur">
      {(["en", "fr"] as const).map((value) => {
        const active = localeContext.locale === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => localeContext.setLocale(value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            }`}
            aria-label={value === "en" ? "Switch language to English" : "Passer la langue en francais"}
          >
            {value.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale());

  useEffect(() => {
    if (!canUseWindow()) {
      return;
    }
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale: setLocaleState,
      toggleLocale: () => setLocaleState((current) => (current === "en" ? "fr" : "en")),
    }),
    [locale],
  );

  return (
    <LocaleContext.Provider value={value}>
      <LocaleTextSync locale={locale} />
      {children}
      <LanguageToggle />
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used inside LocaleProvider");
  }
  return context;
}
