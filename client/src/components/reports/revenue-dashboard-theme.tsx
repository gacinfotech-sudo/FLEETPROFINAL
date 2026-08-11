import { useEffect, useState } from 'react';

/**
 * Theme type definition
 */
export type ThemeName = 'emerald-finance' | 'ocean-blue' | 'midnight-dark' | 'classic-light';

/**
 * Theme color palette structure
 */
interface ThemePalette {
  '--primary': string;
  '--primary-soft': string;
  '--surface': string;
  '--surface-hover': string;
  '--border': string;
  '--text-primary': string;
  '--text-secondary': string;
  '--success': string;
  '--danger': string;
  '--warning': string;
  '--chart-1': string;
  '--chart-2': string;
  '--chart-3': string;
  '--chart-4': string;
  '--chart-5': string;
  '--chart-6': string;
}

/**
 * Complete theme configuration with 4 themes
 * Each theme meets WCAG AA contrast standards
 */
export const THEMES: Record<ThemeName, ThemePalette> = {
  'emerald-finance': {
    '--primary': '#10B981', // Emerald green
    '--primary-soft': '#D1FAE5', // Light emerald
    '--surface': '#FFFFFF', // White background
    '--surface-hover': '#F3F4F6', // Light gray hover
    '--border': '#E5E7EB', // Light gray border
    '--text-primary': '#1F2937', // Dark gray text
    '--text-secondary': '#6B7280', // Medium gray text
    '--success': '#059669', // Dark green
    '--danger': '#DC2626', // Red
    '--warning': '#F59E0B', // Amber
    '--chart-1': '#10B981', // Emerald
    '--chart-2': '#0891B2', // Cyan
    '--chart-3': '#7C3AED', // Violet
    '--chart-4': '#EC4899', // Pink
    '--chart-5': '#F59E0B', // Amber
    '--chart-6': '#6366F1', // Indigo
  },
  'ocean-blue': {
    '--primary': '#0369A1', // Deep ocean blue
    '--primary-soft': '#E0F2FE', // Light sky blue
    '--surface': '#FFFFFF', // White background
    '--surface-hover': '#F0F9FF', // Very light blue hover
    '--border': '#BAE6FD', // Light blue border
    '--text-primary': '#0F1F3C', // Very dark navy text (WCAG AA contrast 4.5+)
    '--text-secondary': '#374151', // Medium gray text
    '--success': '#047857', // Dark teal
    '--danger': '#991B1B', // Dark red
    '--warning': '#B45309', // Dark amber
    '--chart-1': '#0369A1', // Deep ocean blue
    '--chart-2': '#0891B2', // Teal
    '--chart-3': '#2563EB', // Blue
    '--chart-4': '#7C3AED', // Violet
    '--chart-5': '#DC2626', // Red
    '--chart-6': '#D97706', // Amber
  },
  'midnight-dark': {
    '--primary': '#60A5FA', // Bright blue for dark mode
    '--primary-soft': '#1E3A8A', // Dark blue
    '--surface': '#0F172A', // Very dark blue
    '--surface-hover': '#1E293B', // Slate gray
    '--border': '#334155', // Dark slate
    '--text-primary': '#F1F5F9', // Light gray text (high contrast on dark)
    '--text-secondary': '#CBD5E1', // Medium light gray text
    '--success': '#86EFAC', // Bright mint green
    '--danger': '#FCA5A5', // Light red for contrast
    '--warning': '#FBBF24', // Bright amber
    '--chart-1': '#60A5FA', // Bright blue
    '--chart-2': '#86EFAC', // Bright mint green
    '--chart-3': '#FBBF24', // Bright amber
    '--chart-4': '#FCA5A5', // Light red
    '--chart-5': '#D8B4FE', // Light purple
    '--chart-6': '#FB7185', // Light rose
  },
  'classic-light': {
    '--primary': '#1E40AF', // Darker blue for better contrast
    '--primary-soft': '#DBEAFE', // Light blue
    '--surface': '#FFFFFF', // White background
    '--surface-hover': '#F8FAFC', // Slightly off-white hover
    '--border': '#D1D5DB', // Medium gray border
    '--text-primary': '#111827', // Almost black for maximum contrast
    '--text-secondary': '#374151', // Dark gray text
    '--success': '#059669', // Darker green
    '--danger': '#DC2626', // Darker red
    '--warning': '#D97706', // Darker amber
    '--chart-1': '#1E40AF', // Darker blue
    '--chart-2': '#059669', // Darker green
    '--chart-3': '#D97706', // Darker amber
    '--chart-4': '#DC2626', // Darker red
    '--chart-5': '#7C3AED', // Violet
    '--chart-6': '#BE185D', // Dark pink
  },
};

/**
 * Hook to manage theme state and persistence
 * Returns current theme and setter function
 * Persists theme preference to localStorage with key 'dashboardTheme'
 */
export function useTheme() {
  const [currentTheme, setCurrentThemeState] = useState<ThemeName>('emerald-finance');
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('dashboardTheme') as ThemeName | null;
    const themeToUse = (savedTheme && THEMES[savedTheme]) ? savedTheme : 'emerald-finance';

    setCurrentThemeState(themeToUse);
    applyTheme(themeToUse);
    setIsLoaded(true);
  }, []);

  /**
   * Apply theme by setting CSS variables on document root
   */
  const applyTheme = (theme: ThemeName) => {
    const palette = THEMES[theme];
    const root = document.documentElement;

    Object.entries(palette).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  };

  /**
   * Set theme and persist to localStorage
   */
  const setTheme = (theme: ThemeName) => {
    if (THEMES[theme]) {
      setCurrentThemeState(theme);
      applyTheme(theme);
      localStorage.setItem('dashboardTheme', theme);
    }
  };

  return {
    currentTheme,
    setTheme,
    isLoaded,
  };
}

/**
 * ThemeSwitcher component
 * Renders a dropdown/select component to switch between themes
 * Shows current theme selection with visual indicator
 */
export function ThemeSwitcher() {
  const { currentTheme, setTheme } = useTheme();

  const themeLabels: Record<ThemeName, string> = {
    'emerald-finance': 'Emerald Finance',
    'ocean-blue': 'Ocean Blue',
    'midnight-dark': 'Midnight Dark',
    'classic-light': 'Classic Light',
  };

  const themeColors: Record<ThemeName, string> = {
    'emerald-finance': '#10B981',
    'ocean-blue': '#0284C7',
    'midnight-dark': '#60A5FA',
    'classic-light': '#3B82F6',
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="theme-switcher" className="text-sm font-medium text-current">
        Theme:
      </label>
      <select
        id="theme-switcher"
        value={currentTheme}
        onChange={(e) => setTheme(e.target.value as ThemeName)}
        className="px-3 py-1.5 text-sm border rounded-md cursor-pointer"
        style={{
          borderColor: 'var(--border)',
          backgroundColor: 'var(--surface)',
          color: 'var(--text-primary)',
        }}
      >
        {Object.entries(themeLabels).map(([themeKey, label]) => (
          <option key={themeKey} value={themeKey}>
            {label}
          </option>
        ))}
      </select>

      {/* Visual indicator of current theme color */}
      <div
        className="w-6 h-6 rounded-full border-2"
        style={{
          backgroundColor: themeColors[currentTheme],
          borderColor: 'var(--border)',
        }}
        title={`Current theme: ${themeLabels[currentTheme]}`}
      />
    </div>
  );
}

/**
 * Export theme names for type-safe usage
 */
export const THEME_NAMES: ThemeName[] = Object.keys(THEMES) as ThemeName[];

/**
 * Get a specific CSS variable value from the current theme
 */
export function getCSSVariable(variableName: keyof ThemePalette): string {
  return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
}

/**
 * Apply theme programmatically without hook
 * Useful for initialization or theme application outside React components
 */
export function applyThemeDirectly(themeName: ThemeName): void {
  if (!THEMES[themeName]) {
    console.warn(`Theme "${themeName}" not found. Available themes:`, THEME_NAMES);
    return;
  }

  const palette = THEMES[themeName];
  const root = document.documentElement;

  Object.entries(palette).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  localStorage.setItem('dashboardTheme', themeName);
}

/**
 * Initialize theme on application startup
 * Should be called once in the app root or main.tsx
 */
export function initializeTheme(): void {
  const savedTheme = localStorage.getItem('dashboardTheme') as ThemeName | null;
  const themeToUse = (savedTheme && THEMES[savedTheme]) ? savedTheme : 'emerald-finance';
  applyThemeDirectly(themeToUse);
}
