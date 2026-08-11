// One provider, mounted once in the app shell, that lets ANY booking
// surface (queues, upcoming, live, history, Customer 360, dashboard cards,
// search results, payment dues) open the ONE Unified Booking Workspace by
// canonical booking id — no per-page dialogs, no prop drilling, no
// duplicate editors.

import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import BookingWorkspace from "./booking-workspace";
import type { WorkspaceSection } from "@/lib/booking-state";

interface OpenOptions {
  focus?: WorkspaceSection;
}

interface BookingWorkspaceApi {
  /** Open the Unified Booking Workspace for a canonical booking id
   *  (Mongo _id). Accepts a row/document object too, for convenience. */
  openBooking: (bookingOrId: string | { _id?: string; id?: string }, opts?: OpenOptions) => void;
}

const Ctx = createContext<BookingWorkspaceApi | null>(null);

export function BookingWorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ id: string; focus?: WorkspaceSection } | null>(null);

  const openBooking = useCallback((bookingOrId: string | { _id?: string; id?: string }, opts?: OpenOptions) => {
    const id = typeof bookingOrId === "string" ? bookingOrId : String(bookingOrId._id || bookingOrId.id || "");
    if (!id) {
      console.warn("openBooking called without a booking id");
      return;
    }
    setState({ id, focus: opts?.focus });
  }, []);

  return (
    <Ctx.Provider value={{ openBooking }}>
      {children}
      {state && (
        <BookingWorkspace
          bookingId={state.id}
          initialFocus={state.focus}
          onClose={() => setState(null)}
        />
      )}
    </Ctx.Provider>
  );
}

export function useBookingWorkspace(): BookingWorkspaceApi {
  const ctx = useContext(Ctx);
  if (ctx) return ctx;
  // Surfaces rendered outside the provider (should not happen once the
  // provider wraps the app shell) degrade to a console warning instead of
  // crashing the page.
  return {
    openBooking: () => console.warn("BookingWorkspaceProvider is not mounted above this component"),
  };
}
