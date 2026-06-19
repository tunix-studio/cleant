import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const KEY = "tclean-theme";

function initial(): Theme {
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  }
  return "light"; // Quiet Premium ships light-first
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggle = useCallback(
    () => setTheme((t) => (t === "light" ? "dark" : "light")),
    [],
  );

  return { theme, toggle };
}
