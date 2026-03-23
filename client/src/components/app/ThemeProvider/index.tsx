import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
  isDark: boolean
  monacoTheme: 'vs-dark' | 'light'
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  isDark: false,
  monacoTheme: 'light',
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "kw-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  // Helper function to determine if current theme is dark
  const getIsDark = (currentTheme: Theme): boolean => {
    if (currentTheme === "dark") return true;
    if (currentTheme === "light") return false;
    // For system theme, check the media query
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  };

  const isDark = getIsDark(theme);
  const monacoTheme: 'vs-dark' | 'light' = isDark ? 'vs-dark' : 'light';

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
    isDark,
    monacoTheme,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      <div data-testid="theme-provider" data-default-theme={defaultTheme} data-storage-key={storageKey}>
        {children}
      </div>
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};