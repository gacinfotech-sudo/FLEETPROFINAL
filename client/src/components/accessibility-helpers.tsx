/**
 * Accessibility Helper Components
 * Provides reusable accessibility patterns for enhanced UX
 */

/**
 * Screen Reader Only Text
 * Visually hidden but available to screen readers
 */
export function ScreenReaderText({ children }: { children: React.ReactNode }) {
  return (
    <span className="sr-only">
      {children}
    </span>
  );
}

/**
 * Skip to Main Content Link
 * Allows keyboard users to jump to main content
 */
export function SkipToMainContent() {
  return (
    <a
      href="#main-content"
      className="skip-to-main"
      onClick={(e) => {
        e.preventDefault();
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
          mainContent.focus();
          mainContent.scrollIntoView({ behavior: 'smooth' });
        }
      }}
    >
      Skip to main content
    </a>
  );
}

/**
 * Add ARIA labels to interactive elements
 * Use this hook to manage aria-label consistency
 */
export function useAriaLabel(label: string, status?: string) {
  return {
    'aria-label': label,
    ...(status && { 'aria-current': status })
  };
}

/**
 * Loading state announcement for screen readers
 */
export function LoadingAnnouncement({ isLoading, message = "Loading content" }: { isLoading: boolean; message?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={isLoading}
      className="sr-only"
    >
      {isLoading && message}
    </div>
  );
}

/**
 * Announce dynamic content updates
 */
export function DynamicContentAnnouncement({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="assertive"
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}

/**
 * Enhanced keyboard navigation for lists
 */
export function useKeyboardNavigation(onEnter?: () => void, onEscape?: () => void) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onEnter) {
      onEnter();
    }
    if (e.key === 'Escape' && onEscape) {
      onEscape();
    }
  };

  return { onKeyDown: handleKeyDown };
}

/**
 * Tooltip with accessibility attributes
 */
export function AccessibleTooltip({
  children,
  tooltip,
  position = 'top',
}: {
  children: React.ReactNode;
  tooltip: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}) {
  const id = `tooltip-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="relative inline-block group">
      <div
        aria-describedby={id}
        role="tooltip"
        className="focus-ring"
      >
        {children}
      </div>
      <div
        id={id}
        className={`absolute hidden group-hover:block group-focus-within:block bg-gray-900 text-white text-sm rounded px-2 py-1 whitespace-nowrap z-50 ${
          position === 'top' ? 'bottom-full mb-2' :
          position === 'bottom' ? 'top-full mt-2' :
          position === 'left' ? 'right-full mr-2' :
          'left-full ml-2'
        }`}
        role="tooltip"
      >
        {tooltip}
      </div>
    </div>
  );
}

/**
 * Icon with accessible label
 */
export function AccessibleIcon({
  icon: Icon,
  label,
  size = 20,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  size?: number;
}) {
  return (
    <>
      <Icon size={size} aria-hidden="true" />
      <ScreenReaderText>{label}</ScreenReaderText>
    </>
  );
}

/**
 * Announce form errors to screen readers
 */
export function FormErrorAnnouncement({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="sr-only"
    >
      {errors.length === 1 ? (
        <>Error: {errors[0]}</>
      ) : (
        <>
          {errors.length} errors:
          {errors.map((error, i) => (
            <div key={i}>{error}</div>
          ))}
        </>
      )}
    </div>
  );
}
