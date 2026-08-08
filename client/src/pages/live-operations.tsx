// Live Operations — "Vehicles on Booking" control screen.
//
// A VIEW over canonical Booking records (GET /api/operations/live-vehicles):
// every card is a real Booking; every action routes to the existing
// canonical workflow (status transitions, /extend, /payments, the Unified
// Booking Workspace). Nothing here stores booking state of its own.

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Phone, MessageCircle, Clock, MapPin, User, Car, IndianRupee, AlertTriangle,
  CalendarPlus, CheckCircle2, Settings, RefreshCw, Gauge, Fuel, ShieldCheck, StickyNote,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useBookingWorkspace } from "@/components/booking/booking-workspace-context";
import { useAuth } from "@/hooks/use-auth";
import ExtendBookingDialog from "@/components/operations/extend-booking-dialog";
import CollectPaymentDialog from "@/components/operations/collect-payment-dialog";
import ReminderSettingsDialog from "@/components/operations/reminder-settings-dialog";

export interface LiveVehicleCard {
  id: string;
  bookingCode: string;
  serviceMode: "self_drive" | "with_driver";
  status: string;
  runtimeStatus: "RUNNING" | "ENDING_SOON" | "RETURN_DUE" | "OVERDUE" | "END_TIME_PENDING";
  customerName: string;
  customerPhone: string;
  vehicle: { id: string; make?: string; model?: string; registrationNumber?: string } | null;
  vendorVehicle: string | null;
  driver: { id: string; name?: string; phone?: string } | null;
  vendorDriver: { name?: string; phone?: string } | null;
  driverPending: boolean;
  pickupLocation: string;
  returnLocation: string | null;
  additionalStops: string[];
  startAt: string | null;
  endAt: string | null;
  startAtLocal: string;
  endAtLocal: string;
  timeRemainingMinutes: number | null;
  endTimePending: boolean;
  totalAmount: number;
  received: number;
  balance: number;
  securityDepositAmount: number | null;
  securityDepositStatus: string | null;
  startOdometer: number | null;
  startFuelLevel: string | null;
  extensionCount: number;
  nextBooking: {
    bookingId: string; bookingCode: string; customerName: string;
    startAtLocal: string; gapMinutes: number | null; requiredBufferMinutes: number;
    turnaroundConflict: boolean; atRisk: boolean;
  } | null;
  paymentDueSoon: boolean;
  selfDrive: {
    stage: string;
    latePolicy: { graceMinutes: number; rate: number; unit: string };
    lateChargeEstimate: number;
    fuelOut: number | null;
    kmOut: number | null;
  } | null;
}

interface LiveVehiclesResponse {
  generatedAt: string;
  timezone: string;
  summary: {
    vehiclesRunning: number; selfDrive: number; withDriver: number;
    endingSoon: number; overdue: number; needsAttention: number; balanceDue: number;
  };
  cards: LiveVehicleCard[];
}

type OpsTab = "all" | "self_drive" | "with_driver" | "ending_soon" | "overdue" | "attention";

const TABS: { key: OpsTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "self_drive", label: "Self Drive" },
  { key: "with_driver", label: "With Driver" },
  { key: "ending_soon", label: "Ending Soon" },
  { key: "overdue", label: "Overdue" },
  { key: "attention", label: "Needs Attention" },
];

export function money(n?: number | null) {
  if (n === undefined || n === null) return "—";
  return `₹${n.toLocaleString("en-IN")}`;
}

export function humanizeMinutes(mins: number) {
  const abs = Math.abs(Math.round(mins));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// apiRequest throws Error("<status>: <rawBody>") on non-2xx — recover the
// server's human message for toasts instead of showing raw JSON.
export function apiErrorMessage(err: any): string {
  const match = /^(\d+):\s*([\s\S]*)$/.exec(err?.message || "");
  if (match) {
    try {
      const body = JSON.parse(match[2]);
      if (body?.message) return body.message;
    } catch { /* not JSON */ }
  }
  return err?.message || "Request failed";
}

function waLink(phone?: string | null) {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  const full = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${full}`;
}

const RUNTIME_BADGE: Record<LiveVehicleCard["runtimeStatus"], { label: string; cls: string }> = {
  RUNNING: { label: "Running", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  ENDING_SOON: { label: "Ending Soon", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  RETURN_DUE: { label: "Return Due", cls: "bg-orange-100 text-orange-800 border-orange-200" },
  OVERDUE: { label: "OVERDUE", cls: "bg-red-100 text-red-800 border-red-200" },
  END_TIME_PENDING: { label: "End Time Pending", cls: "bg-slate-100 text-slate-700 border-slate-200" },
};

function vehicleName(card: LiveVehicleCard) {
  if (card.vehicle) return [card.vehicle.make, card.vehicle.model].filter(Boolean).join(" ") || "Vehicle";
  return card.vendorVehicle || "Vehicle (vendor)";
}

// Live countdown re-rendered every 30s — display only; the server-derived
// runtimeStatus stays authoritative for classification.
function useNowTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 30000);
    return () => clearInterval(t);
  }, []);
}

function TimeRemaining({ card }: { card: LiveVehicleCard }) {
  if (card.endTimePending || !card.endAt) {
    return <span className="font-semibold text-slate-600">END TIME PENDING</span>;
  }
  const mins = Math.round((new Date(card.endAt).getTime() - Date.now()) / 60000);
  if (mins >= 0) {
    return <span className={`font-semibold ${mins <= 60 ? "text-amber-700" : "text-emerald-700"}`}>{humanizeMinutes(mins)} left</span>;
  }
  return <span className="font-semibold text-red-700">Late by {humanizeMinutes(mins)}</span>;
}

function Row({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon size={14} className="mt-0.5 shrink-0 text-gray-400" />
      <span className="text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-gray-900 min-w-0 break-words">{children}</span>
    </div>
  );
}

function LiveCard({ card, onExtend, onCollect, onOpen, onAction, onLog, actingId }: {
  card: LiveVehicleCard;
  onExtend: (c: LiveVehicleCard) => void;
  onCollect: (c: LiveVehicleCard) => void;
  onOpen: (c: LiveVehicleCard) => void;
  onAction: (c: LiveVehicleCard, action: "start_return" | "complete") => void;
  onLog: (c: LiveVehicleCard, action: string) => void;
  actingId: string | null;
}) {
  const badge = RUNTIME_BADGE[card.runtimeStatus];
  const isSelfDrive = card.serviceMode === "self_drive";
  const wa = waLink(card.customerPhone);
  const driverPhone = card.driver?.phone || card.vendorDriver?.phone;
  const acting = actingId === card.id;

  return (
    <Card
      data-testid={`live-card-${card.bookingCode}`}
      className={`border ${card.runtimeStatus === "OVERDUE" ? "border-red-300 shadow-red-100 shadow" : card.runtimeStatus === "ENDING_SOON" || card.runtimeStatus === "RETURN_DUE" ? "border-amber-300" : "border-gray-200"}`}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">{vehicleName(card)}</span>
              {card.vehicle?.registrationNumber && (
                <span className="text-xs font-mono bg-gray-100 rounded px-1.5 py-0.5">{card.vehicle.registrationNumber}</span>
              )}
            </div>
            <button className="text-xs text-blue-600 hover:underline" onClick={() => onOpen(card)}>
              {card.bookingCode}
            </button>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className={badge.cls}>{badge.label}</Badge>
            <Badge variant="outline" className={isSelfDrive ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-sky-50 text-sky-700 border-sky-200"}>
              {isSelfDrive ? "Self Drive" : "With Driver"}
            </Badge>
          </div>
        </div>

        <div className="space-y-1.5">
          <Row icon={User} label="Customer">
            {card.customerName}
            {card.customerPhone && <span className="text-gray-500"> · {card.customerPhone}</span>}
          </Row>

          {!isSelfDrive && (
            <Row icon={User} label="Driver">
              {card.driverPending ? (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">DRIVER PENDING</Badge>
              ) : (
                <>
                  {card.driver?.name || card.vendorDriver?.name}
                  {driverPhone && <span className="text-gray-500"> · {driverPhone}</span>}
                </>
              )}
            </Row>
          )}

          <Row icon={Clock} label={isSelfDrive ? "Return" : "Trip End"}>
            {card.endAtLocal} · <TimeRemaining card={card} />
          </Row>

          <Row icon={MapPin} label={isSelfDrive ? "Return At" : "Route"}>
            {isSelfDrive
              ? (card.returnLocation || "—")
              : [card.pickupLocation, ...card.additionalStops, card.returnLocation].filter(Boolean).join(" → ")}
          </Row>

          <Row icon={IndianRupee} label={isSelfDrive ? "Rental" : "Fare"}>
            {money(card.totalAmount)} · Received {money(card.received)} ·{" "}
            <span className={card.balance > 0 ? "text-red-700 font-semibold" : "text-emerald-700"}>
              Balance {money(card.balance)}
            </span>
          </Row>

          {isSelfDrive && (
            <>
              <Row icon={ShieldCheck} label="Deposit">
                {card.securityDepositAmount !== null ? (
                  <>
                    {money(card.securityDepositAmount)}
                    {card.securityDepositStatus && (
                      <Badge variant="outline" className="ml-1.5 text-[10px] uppercase">{card.securityDepositStatus}</Badge>
                    )}
                  </>
                ) : "—"}
              </Row>
              {(card.selfDrive?.kmOut !== null || card.selfDrive?.fuelOut !== null || card.startFuelLevel) && (
                <div className="flex gap-4 text-xs text-gray-500 pl-6 flex-wrap">
                  {(card.selfDrive?.kmOut ?? card.startOdometer) !== null && <span className="flex items-center gap-1"><Gauge size={12} /> KM Out {(card.selfDrive?.kmOut ?? card.startOdometer)!.toLocaleString("en-IN")}</span>}
                  {(card.selfDrive?.fuelOut !== null && card.selfDrive?.fuelOut !== undefined) ? <span className="flex items-center gap-1"><Fuel size={12} /> Fuel Out {card.selfDrive.fuelOut}%</span>
                    : card.startFuelLevel ? <span className="flex items-center gap-1"><Fuel size={12} /> Fuel {card.startFuelLevel}</span> : null}
                  {card.selfDrive && <span>Late: ₹{card.selfDrive.latePolicy.rate}/{card.selfDrive.latePolicy.unit === "per_hour" ? "hr" : card.selfDrive.latePolicy.unit === "per_30min" ? "30m" : card.selfDrive.latePolicy.unit === "per_day" ? "day" : "fixed"}</span>}
                  {card.selfDrive && card.selfDrive.lateChargeEstimate > 0 && (
                    <span className="text-red-600 font-medium">Late charge so far ≈ ₹{card.selfDrive.lateChargeEstimate.toLocaleString("en-IN")}</span>
                  )}
                </div>
              )}
            </>
          )}

          {card.nextBooking && (
            <div className={`text-xs rounded-md px-2 py-1.5 ${card.nextBooking.atRisk ? "bg-red-50 text-red-800" : card.nextBooking.turnaroundConflict ? "bg-amber-50 text-amber-800" : "bg-gray-50 text-gray-600"}`}>
              <AlertTriangle size={12} className="inline mr-1 -mt-0.5" />
              Next: {card.nextBooking.bookingCode} ({card.nextBooking.customerName}) {card.nextBooking.startAtLocal}
              {card.nextBooking.gapMinutes !== null && <> · turnaround {humanizeMinutes(card.nextBooking.gapMinutes)}</>}
              {card.nextBooking.atRisk ? " · NEXT BOOKING AT RISK" : card.nextBooking.turnaroundConflict ? " · TURNAROUND CONFLICT" : ""}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-100">
          {card.customerPhone && (
            <Button size="sm" variant="outline" asChild onClick={() => onLog(card, "called_customer")}>
              <a href={`tel:${card.customerPhone}`}><Phone size={13} className="mr-1" />Customer</a>
            </Button>
          )}
          {!isSelfDrive && driverPhone && (
            <Button size="sm" variant="outline" asChild onClick={() => onLog(card, "called_driver")}>
              <a href={`tel:${driverPhone}`}><Phone size={13} className="mr-1" />Driver</a>
            </Button>
          )}
          {wa && (
            <Button size="sm" variant="outline" asChild onClick={() => onLog(card, "whatsapp_customer")}>
              <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={13} className="mr-1" />WhatsApp</a>
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onExtend(card)} data-testid={`extend-${card.bookingCode}`}>
            <CalendarPlus size={13} className="mr-1" />Extend
          </Button>
          {card.balance > 0 && (
            <Button size="sm" variant={card.paymentDueSoon ? "default" : "outline"} onClick={() => onCollect(card)} data-testid={`collect-${card.bookingCode}`}>
              <IndianRupee size={13} className="mr-1" />Collect
            </Button>
          )}
          {isSelfDrive && ["trip_started", "ongoing", "extended"].includes(card.status) && (
            <Button size="sm" variant="outline" disabled={acting} onClick={() => onAction(card, "start_return")}>
              Start Return
            </Button>
          )}
          {["trip_started", "ongoing", "extended", "return_pending"].includes(card.status) && (
            <Button size="sm" variant="outline" disabled={acting} onClick={() => onAction(card, "complete")} data-testid={`complete-${card.bookingCode}`}>
              <CheckCircle2 size={13} className="mr-1" />{isSelfDrive ? "Returned" : "Complete Trip"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onOpen(card)}>Open</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LiveOperations({ initialTab }: { initialTab?: OpsTab } = {}) {
  const { toast } = useToast();
  const { openBooking } = useBookingWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<OpsTab>(initialTab || "all");
  const [extending, setExtending] = useState<LiveVehicleCard | null>(null);
  const [collecting, setCollecting] = useState<LiveVehicleCard | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  useNowTick();

  const { data, isLoading, isError, refetch } = useQuery<LiveVehiclesResponse>({
    queryKey: ["/api/operations/live-vehicles"],
    refetchInterval: 30000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/operations/live-vehicles"] });
    queryClient.invalidateQueries({ queryKey: ["/api/operations/alerts"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
  };

  const actionMutation = useMutation({
    mutationFn: async ({ card, action }: { card: LiveVehicleCard; action: "start_return" | "complete" }) => {
      setActingId(card.id);
      const res = action === "start_return"
        ? await apiRequest("POST", `/api/bookings/${card.id}/status`, { status: "return_pending" })
        : await apiRequest("POST", `/api/bookings/${card.id}/complete`, {});
      return res.json();
    },
    onSuccess: (_d, { action, card }) => {
      toast({
        title: action === "start_return" ? "Return started" : (card.serviceMode === "self_drive" ? "Vehicle returned" : "Trip completed"),
        description: `${card.bookingCode} · ${vehicleName(card)}`,
      });
      invalidate();
    },
    onError: (err: any) => toast({ title: "Action failed", description: apiErrorMessage(err), variant: "destructive" }),
    onSettled: () => setActingId(null),
  });

  // Contact attempts are logged fire-and-forget — never block the actual
  // phone call behind an API round-trip.
  const logContact = (card: LiveVehicleCard, action: string) => {
    apiRequest("POST", `/api/operations/bookings/${card.id}/activity`, { action }).catch(() => {});
  };

  const cards = data?.cards ?? [];
  const filtered = useMemo(() => {
    switch (activeTab) {
      case "self_drive": return cards.filter((c) => c.serviceMode === "self_drive");
      case "with_driver": return cards.filter((c) => c.serviceMode === "with_driver");
      case "ending_soon": return cards.filter((c) => c.runtimeStatus === "ENDING_SOON" || c.runtimeStatus === "RETURN_DUE");
      case "overdue": return cards.filter((c) => c.runtimeStatus === "OVERDUE");
      case "attention": return cards.filter((c) => c.endTimePending || c.driverPending || c.nextBooking?.turnaroundConflict || c.nextBooking?.atRisk);
      default: return cards;
    }
  }, [cards, activeTab]);

  const s = data?.summary;
  const CHIPS: { label: string; value: string | number; tab?: OpsTab; danger?: boolean }[] = s ? [
    { label: "Vehicles Running", value: s.vehiclesRunning, tab: "all" },
    { label: "Self Drive", value: s.selfDrive, tab: "self_drive" },
    { label: "With Driver", value: s.withDriver, tab: "with_driver" },
    { label: "Ending Soon", value: s.endingSoon, tab: "ending_soon" },
    { label: "Overdue", value: s.overdue, tab: "overdue", danger: s.overdue > 0 },
    { label: "Balance Due", value: money(s.balanceDue) },
  ] : [];

  return (
    <div data-testid="live-operations-page">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Vehicles on Booking</h1>
          <p className="text-sm text-gray-500">Every vehicle currently out — who has it, when it returns, what's due.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { apiRequest("POST", "/api/operations/reminders/run", {}).finally(() => refetch()); }}>
            <RefreshCw size={14} className="mr-1" />Refresh
          </Button>
          {user?.role === "client" && (
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)} data-testid="reminder-settings-button">
              <Settings size={14} className="mr-1" />Reminders
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
        {CHIPS.map((chip) => (
          <button
            key={chip.label}
            onClick={() => chip.tab && setActiveTab(chip.tab)}
            className={`rounded-lg border p-2.5 text-left transition-colors min-w-0 ${chip.danger ? "border-red-200 bg-red-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}
          >
            <div className={`text-lg font-bold truncate ${chip.danger ? "text-red-700" : "text-gray-900"}`}>{chip.value}</div>
            <div className="text-[11px] text-gray-500 leading-tight">{chip.label}</div>
          </button>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as OpsTab)}>
        <TabsList className="flex flex-wrap h-auto justify-start mb-4">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} data-testid={`ops-tab-${t.key}`}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading && <div className="text-center text-gray-500 py-12">Loading live operations…</div>}
      {isError && <div className="text-center text-red-600 py-12">Failed to load live operations.</div>}
      {!isLoading && !isError && filtered.length === 0 && (
        <div className="text-center text-gray-500 py-12 border border-dashed rounded-lg">
          <Car className="mx-auto mb-2 text-gray-300" size={40} />
          <p>No vehicles in this bucket right now.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((card) => (
          <LiveCard
            key={card.id}
            card={card}
            actingId={actingId}
            onExtend={setExtending}
            onCollect={setCollecting}
            onOpen={(c) => openBooking(c.id)}
            onAction={(c, action) => actionMutation.mutate({ card: c, action })}
            onLog={logContact}
          />
        ))}
      </div>

      {extending && (
        <ExtendBookingDialog card={extending} onClose={() => setExtending(null)} onDone={() => { setExtending(null); invalidate(); }} />
      )}
      {collecting && (
        <CollectPaymentDialog card={collecting} onClose={() => setCollecting(null)} onDone={() => { setCollecting(null); invalidate(); }} />
      )}
      <ReminderSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
