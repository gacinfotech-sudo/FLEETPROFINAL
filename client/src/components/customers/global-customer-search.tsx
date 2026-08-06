import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  // Navigates to Customer 360 for an existing match.
  onSelectCustomer: (customerId: string) => void;
}

// One reusable global search, reachable from the Sidebar (the only element
// actually persistent across every page and both mobile/desktop layouts —
// the standalone client/src/components/layout/header.tsx is dead code,
// never imported anywhere, so mounting there would have been invisible).
// Reuses GET /api/customers?search= verbatim — same endpoint, same
// debounce-free-but-now-correct search logic already powering
// customers.tsx, no new backend route.
export default function GlobalCustomerSearch({ onSelectCustomer }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQuery(""); setDebounced(""); }
  }, [open]);

  const { data, isFetching } = useQuery<any[]>({
    queryKey: ["/api/customers", "global-search", debounced],
    queryFn: async () => {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(debounced)}`, { credentials: "include" });
      if (!res.ok) throw new Error("search failed");
      return res.json();
    },
    enabled: debounced.length >= 2,
  });

  const results = (data || []).slice(0, 15);

  return (
    <>
      <Button
        variant="ghost"
        className="w-full justify-start px-3 lg:px-4 py-3 text-sm lg:text-base text-gray-600 hover:bg-gray-100 border border-gray-200 mx-3 lg:mx-4 mb-2"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 mr-2" /> Search customers...
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg top-[15%] translate-y-0">
          <DialogHeader><DialogTitle>Search Customers</DialogTitle></DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              ref={inputRef}
              placeholder="Name, mobile, or email..."
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {isFetching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />}
          </div>

          <div className="max-h-80 overflow-y-auto -mx-2">
            {debounced.length < 2 ? (
              <p className="text-sm text-gray-500 text-center py-8">Type at least 2 characters to search.</p>
            ) : !isFetching && results.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No matching customers.</p>
            ) : (
              results.map((c: any) => (
                <button
                  key={c._id}
                  type="button"
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 flex items-center justify-between gap-3"
                  onClick={() => { setOpen(false); onSelectCustomer(c._id); }}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{c.name}</div>
                    <div className="text-xs text-gray-500">{(c.primaryMobile || "").replace(/^91/, "")}{c.email ? ` · ${c.email}` : ""}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-gray-500">{c.totalBookings || 0} booking{c.totalBookings === 1 ? "" : "s"}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
