import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Users, X } from "lucide-react";
import CustomerDashboard from "@/components/customers/customer-dashboard";
import QuickInquiryForm from "@/components/inquiries/quick-inquiry-form";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

function fmtMoney(n?: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  new: { label: "New", className: "bg-blue-100 text-blue-800" },
  repeat: { label: "Repeat", className: "bg-green-100 text-green-800" },
  frequent: { label: "Frequent", className: "bg-purple-100 text-purple-800" },
  high_value: { label: "High Value", className: "bg-amber-100 text-amber-800" },
  inactive: { label: "Inactive", className: "bg-gray-100 text-gray-600" },
  at_risk: { label: "At Risk", className: "bg-red-100 text-red-800" },
};

interface CustomersPageProps {
  onEditBooking?: (booking: any) => void;
  onNewBooking?: (prefill: any) => void;
  // Set by the Sidebar's Global Customer Search (via dashboard.tsx's
  // pendingCustomerId) when the user picked a specific customer before
  // navigating here — opens that customer's 360 dialog immediately instead
  // of landing on the plain list.
  initialCustomerId?: string | null;
  // Forwarded to CustomerDashboard's timeline — see its own prop comment.
  onNavigateToInquiry?: (inquiryId: string) => void;
  onNavigateToLead?: (leadId: string) => void;
  // Sidebar's "Add Customer" entry lands here with the intake dialog
  // already open. New customers enter FleetPro through the existing
  // Quick Inquiry funnel (there is deliberately no bare POST /api/customers
  // — see server/services/customerService.ts's findOrCreateCustomer).
  initialShowIntake?: boolean;
}

export default function CustomersPage({ onEditBooking, onNewBooking, initialCustomerId, onNavigateToInquiry, onNavigateToLead, initialShowIntake }: CustomersPageProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [activeSegment, setActiveSegment] = useState<{ key: string; label: string } | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [viewingCustomerId, setViewingCustomerId] = useState<string | null>(null);
  const [showQuickInquiry, setShowQuickInquiry] = useState(!!initialShowIntake);

  useEffect(() => {
    if (initialShowIntake) setShowQuickInquiry(true);
  }, [initialShowIntake]);

  useEffect(() => {
    if (initialCustomerId) setViewingCustomerId(initialCustomerId);
  }, [initialCustomerId]);

  const { data: segments } = useQuery<any[]>({ queryKey: ["/api/customers/segments"] });
  const { data: tagCounts } = useQuery<any[]>({ queryKey: ["/api/customers/tags"] });

  const { data, isLoading, isFetching } = useQuery<any[]>({
    queryKey: ["/api/customers", debouncedSearch, activeSegment?.key, activeTag],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (activeSegment) params.set("segment", activeSegment.key);
      if (activeTag) params.set("tag", activeTag);
      const res = await fetch(`/api/customers?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json();
    },
  });

  const customers = data || [];
  // True while the rendered table can't be trusted to match `search` yet —
  // either the 350ms debounce hasn't caught up (`search !== debouncedSearch`)
  // or the debounced query is still in flight. Row clicks must be ignored
  // during this window: otherwise a click that lands on the still-rendered
  // stale table can open the wrong customer's record (see
  // .claude/tasks/reports/INTEGRATION-report.md, "Follow-up needed" #1).
  const isSearchStale = search !== debouncedSearch || isFetching;
  const nonEmptySegments = (segments || []).filter((s) => s.key === 'all' || s.count > 0);
  // The "unknown NUMBER → Quick Inquiry" flow (spec) is specifically about
  // a phone search coming up empty — a plain name search with zero results
  // isn't the same scenario (there's no number to seed the inquiry with),
  // so it keeps the original neutral empty state instead of offering a CTA
  // that would open a form with nothing useful pre-filled.
  const searchLooksLikePhone = /\d{10,}/.test(search.replace(/\D/g, ""));

  return (
    <div className="space-y-6">
      {/* Beautiful Header */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl p-6 text-white shadow-lg">
        <h1 className="text-3xl font-bold">👥 Customer Database</h1>
        <p className="text-violet-100 mt-1">Complete customer profiles • Auto-linked from bookings • No duplicates</p>
      </div>

      {/* Segments — every count is a real query, computed server-side
          (services/segmentService.ts). Clicking a card filters the list
          below using the exact same definition the count came from. */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Segments</h2>
        <div className="flex flex-wrap gap-2">
          {nonEmptySegments.map((s) => (
            <button
              key={s.key}
              onClick={() => { setActiveSegment(activeSegment?.key === s.key ? null : { key: s.key, label: s.label }); setActiveTag(null); }}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                activeSegment?.key === s.key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
              }`}
            >
              {s.label} <span className="opacity-70">({s.count})</span>
            </button>
          ))}
        </div>
        {tagCounts && tagCounts.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {tagCounts.map((t: any) => (
              <button
                key={t.tag}
                onClick={() => { setActiveTag(activeTag === t.tag ? null : t.tag); setActiveSegment(null); }}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                  activeTag === t.tag
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-purple-50 text-purple-700 border-purple-200 hover:border-purple-400'
                }`}
              >
                #{t.tag} ({t.count})
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {activeSegment && (
            <Badge className="bg-blue-100 text-blue-800 gap-1">
              {activeSegment.label}
              <button onClick={() => setActiveSegment(null)}><X className="w-3 h-3" /></button>
            </Badge>
          )}
          {activeTag && (
            <Badge className="bg-purple-100 text-purple-800 gap-1">
              #{activeTag}
              <button onClick={() => setActiveTag(null)}><X className="w-3 h-3" /></button>
            </Badge>
          )}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search name, mobile, or email" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{customers.length} customer{customers.length === 1 ? "" : "s"}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-gray-500 py-8 text-center">Loading...</p>
          ) : customers.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              {searchLooksLikePhone ? (
                <>
                  <p className="font-medium text-gray-700">No Existing Customer Found</p>
                  <p className="text-sm mb-4">No customer matches "{search.trim()}".</p>
                  <Button onClick={() => setShowQuickInquiry(true)}>Create Quick Inquiry</Button>
                </>
              ) : (
                <>
                  <p>No customers found</p>
                  <p className="text-sm">Customers are created automatically from bookings.</p>
                </>
              )}
            </div>
          ) : (
            <div className="relative overflow-x-auto">
              {isSearchStale && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-sm text-gray-500" data-testid="customers-search-updating">
                  Updating results...
                </div>
              )}
              <Table className={isSearchStale ? "opacity-50 pointer-events-none" : undefined}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Bookings</TableHead>
                    <TableHead>Lifetime Spend</TableHead>
                    <TableHead>Last Booking</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c: any) => {
                    const badge = STATUS_BADGE[c.customerStatus] || STATUS_BADGE.new;
                    return (
                      <TableRow
                        key={c._id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => { if (!isSearchStale) setViewingCustomerId(c._id); }}
                      >
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.primaryMobile?.replace(/^91/, '')}</TableCell>
                        <TableCell className="capitalize">{(c.customerType || "individual").replace(/_/g, " ")}</TableCell>
                        <TableCell><Badge className={badge.className}>{badge.label}</Badge></TableCell>
                        <TableCell>{c.totalBookings || 0}</TableCell>
                        <TableCell>{fmtMoney(c.totalSpending)}</TableCell>
                        <TableCell>{c.lastBookingDate ? new Date(c.lastBookingDate).toLocaleDateString('en-IN') : "-"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewingCustomerId} onOpenChange={(open) => !open && setViewingCustomerId(null)}>
        <DialogContent className="max-w-6xl max-h-[94vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customer Dashboard</DialogTitle>
          </DialogHeader>
          {viewingCustomerId && (
            <CustomerDashboard
              customerId={viewingCustomerId}
              onEditBooking={(booking) => {
                setViewingCustomerId(null);
                onEditBooking?.(booking);
              }}
              onNewBooking={(prefill) => {
                setViewingCustomerId(null);
                onNewBooking?.(prefill);
              }}
              onNavigateToInquiry={(inquiryId) => {
                setViewingCustomerId(null);
                onNavigateToInquiry?.(inquiryId);
              }}
              onNavigateToLead={(leadId) => {
                setViewingCustomerId(null);
                onNavigateToLead?.(leadId);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showQuickInquiry} onOpenChange={setShowQuickInquiry}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Inquiry</DialogTitle></DialogHeader>
          <QuickInquiryForm
            initialMobile={searchLooksLikePhone ? search : undefined}
            onSuccess={() => setShowQuickInquiry(false)}
            onCancel={() => setShowQuickInquiry(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
