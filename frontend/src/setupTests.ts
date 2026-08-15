import '@testing-library/jest-dom';

// jsdom no implementa matchMedia y usa un viewport 1024x768 por defecto.
// Forzamos un viewport desktop (>=1280) para que los componentes con
// useMediaQuery (DataTable >=768, calendario "timeline" >=1280) caigan en su
// variante de escritorio. Los tests que necesiten móvil sobrescriben matchMedia.
if (typeof window !== 'undefined' && window.innerWidth < 1280) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
}

if (typeof window !== "undefined" && !window.matchMedia) {
  const width = window.innerWidth || 1280;

  const queryMatches = (query: string) => {
    const trimmed = query.trim();
    if (trimmed.includes("min-width: 1280")) return width >= 1280;
    if (trimmed.includes("min-width: 768")) return width >= 768;
    return false;
  };

  window.matchMedia = (query: string) => {
    const mql = {
      media: query,
      matches: queryMatches(query),
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as MediaQueryList;
    Object.defineProperty(mql, "matches", {
      get: () => queryMatches(query),
    });
    return mql;
  };
}