import {createContext, useContext, type ReactNode} from 'react';

// The v2 design is a single, permanently-light theme (no dark mode toggle
// anywhere in the product), so this provider is now a thin stub: it keeps
// the existing `useTheme()` call sites working without every one of them
// needing to be ripped out, but there is nothing to switch.
interface ThemeContextValue {
  theme: 'light';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({theme: 'light', toggleTheme: () => {}});

export function ThemeProvider({children}: {children: ReactNode}) {
  return <ThemeContext.Provider value={{theme: 'light', toggleTheme: () => {}}}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
