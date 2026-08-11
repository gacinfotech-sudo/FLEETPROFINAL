import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Chromium's "ResizeObserver loop completed with undelivered notifications"
// (and the older "loop limit exceeded" wording) is a benign, well-known
// browser quirk — it fires whenever a ResizeObserver callback triggers a
// layout change in the same frame (e.g. a large form section
// appearing/disappearing next to an open Radix Select/Popover, which uses
// ResizeObserver internally to position itself). It's not a real error:
// no exception is thrown, nothing is actually broken, and it doesn't
// surface through any normal error-handling path (confirmed the app
// state is correct with it dismissed). Vite's dev-only error overlay
// treats it as fatal and blocks the UI regardless, which real users never
// see (this overlay doesn't exist in the production build) but which
// makes local development and automated UI testing unusable. This is the
// standard, widely-used suppression for this exact class of warning.
// capture: true — Vite's dev-only error overlay registers its own window
// 'error' listener as part of the injected HMR client script, which loads
// and runs before this module does; a same-phase listener registered
// later can't out-race it. A capture-phase listener always runs before
// bubble-phase listeners for the same event regardless of registration
// order, which is the only way to actually stop this before Vite's
// overlay sees it.
window.addEventListener('error', (e) => {
  if (e.message === 'ResizeObserver loop completed with undelivered notifications.'
    || e.message === 'ResizeObserver loop limit exceeded') {
    e.stopImmediatePropagation();
  }
}, { capture: true });

// Unregister any existing service worker to prevent caching issues
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
      console.log('Service worker unregistered:', registration);
    }
  }).catch(error => {
    console.error('Error unregistering service workers:', error);
  });
  
  // Also clear all caches
  if ('caches' in window) {
    caches.keys().then(function(cacheNames) {
      return Promise.all(cacheNames.map(function(cacheName) {
        console.log('Deleting cache:', cacheName);
        return caches.delete(cacheName);
      }));
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
