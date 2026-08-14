import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type StickyActionBarValue = {
  barHeight: number;
  registerBar: (el: HTMLElement | null) => void;
};

const StickyActionBarContext = createContext<StickyActionBarValue>({
  barHeight: 0,
  registerBar: () => {},
});

export const StickyActionBarProvider = ({ children }: { children: React.ReactNode }) => {
  const [barHeight, setBarHeight] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);

  const registerBar = useCallback((el: HTMLElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;

    if (!el) {
      setBarHeight(0);
      return;
    }

    setBarHeight(el.offsetHeight);

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setBarHeight(el.offsetHeight));
    observer.observe(el);
    observerRef.current = observer;
  }, []);

  const value = useMemo(() => ({ barHeight, registerBar }), [barHeight, registerBar]);

  return (
    <StickyActionBarContext.Provider value={value}>{children}</StickyActionBarContext.Provider>
  );
};

export const useStickyActionBar = () => useContext(StickyActionBarContext).registerBar;

export const useStickyActionBarHeight = () => useContext(StickyActionBarContext).barHeight;
