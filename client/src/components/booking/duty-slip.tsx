import React from "react";

interface DutySlipProps {
  booking: any;
  companyName: string;
  companyPhone?: string;
  // 'office' sees full financials; 'driver' only sees what to collect —
  // internal cost/margin must never reach the driver copy.
  variant: "office" | "driver";
}

function fmtDate(d?: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMoney(n?: number) {
  if (n === undefined || n === null) return "-";
  return `Rs. ${n.toLocaleString("en-IN")}`;
}

const DutySlip: React.FC<DutySlipProps> = ({ booking, companyName, companyPhone, variant }) => {
  const vehicle = booking.vehicleId && typeof booking.vehicleId === "object" ? booking.vehicleId : null;
  const driver = booking.driverId && typeof booking.driverId === "object" ? booking.driverId : null;
  const remaining = Math.max(0, (booking.totalAmount || 0) - (booking.advanceReceived || 0));
  const isVendor = booking.fulfilmentType === "vendor";

  return (
    <div id="duty-slip-pdf" className="max-w-2xl mx-auto p-6 bg-white text-gray-900" style={{ fontFamily: "Arial, sans-serif" }}>
      <div className="text-center border-b-2 border-gray-800 pb-3 mb-4">
        <h1 className="text-2xl font-bold">{companyName}</h1>
        {companyPhone && <p className="text-sm text-gray-600">{companyPhone}</p>}
        <h2 className="text-lg font-semibold mt-2 uppercase tracking-wide">
          {variant === "driver" ? "Driver Duty Slip" : "Office Duty Slip"}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mb-4">
        <div><span className="text-gray-500">Duty Slip / Booking No:</span> <strong>{booking.bookingId}</strong></div>
        <div><span className="text-gray-500">Status:</span> <strong>{(booking.status || "").replace(/_/g, " ")}</strong></div>
        <div><span className="text-gray-500">Customer:</span> <strong>{booking.customerName}</strong></div>
        <div><span className="text-gray-500">Customer Mobile:</span> <strong>{booking.customerPhone}</strong></div>
        <div><span className="text-gray-500">Pickup Date:</span> <strong>{fmtDate(booking.pickupDate)}</strong></div>
        <div><span className="text-gray-500">Pickup Time:</span> <strong>{booking.pickupTime || "-"}</strong></div>
        <div className="col-span-2"><span className="text-gray-500">Pickup:</span> <strong>{booking.pickupLocation}</strong></div>
        {booking.dropoffLocation && (
          <div className="col-span-2"><span className="text-gray-500">Drop:</span> <strong>{booking.dropoffLocation}</strong></div>
        )}
      </div>

      <div className="border-t border-gray-300 pt-3 mb-4">
        <h3 className="font-semibold text-sm mb-2 uppercase text-gray-700">
          {isVendor ? "Vendor & Vehicle Details" : "Vehicle & Driver"}
        </h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {isVendor ? (
            <>
              <div><span className="text-gray-500">Vendor:</span> <strong>{booking.vendorName || "-"}</strong></div>
              <div><span className="text-gray-500">Vendor Contact:</span> <strong>{booking.vendorContactPhone || "-"}</strong></div>
              <div><span className="text-gray-500">Vendor Driver:</span> <strong>{booking.vendorDriverName || "-"}</strong></div>
              <div><span className="text-gray-500">Vendor Driver Mobile:</span> <strong>{booking.vendorDriverPhone || "-"}</strong></div>
              <div className="col-span-2"><span className="text-gray-500">Vehicle:</span> <strong>{booking.vendorVehicleDetails || "-"}</strong></div>
            </>
          ) : (
            <>
              <div><span className="text-gray-500">Vehicle:</span> <strong>{vehicle ? `${vehicle.make} ${vehicle.vehicleModel || ""}`.trim() : "Not assigned"}</strong></div>
              <div><span className="text-gray-500">Vehicle No:</span> <strong>{vehicle?.licensePlate || "-"}</strong></div>
              <div><span className="text-gray-500">Driver:</span> <strong>{driver ? driver.name : (booking.bookingType === "self_drive" ? "Self Drive" : "Not assigned")}</strong></div>
              <div><span className="text-gray-500">Driver Mobile:</span> <strong>{driver?.phone || "-"}</strong></div>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-gray-300 pt-3 mb-4">
        <h3 className="font-semibold text-sm mb-2 uppercase text-gray-700">Odometer & Trip Log</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <div><span className="text-gray-500">Start Odometer:</span> <strong>{booking.startOdometer ?? "___________"}</strong></div>
          <div><span className="text-gray-500">End Odometer:</span> <strong>{booking.endOdometer ?? "___________"}</strong></div>
          <div><span className="text-gray-500">Actual Start:</span> <strong>{booking.actualStartDateTime ? new Date(booking.actualStartDateTime).toLocaleString("en-IN") : "-"}</strong></div>
          <div><span className="text-gray-500">Actual End:</span> <strong>{booking.actualEndDateTime ? new Date(booking.actualEndDateTime).toLocaleString("en-IN") : "-"}</strong></div>
          <div><span className="text-gray-500">Toll:</span> <strong>{fmtMoney(booking.tollCharges)}</strong></div>
          <div><span className="text-gray-500">Parking:</span> <strong>{fmtMoney(booking.parkingCharges)}</strong></div>
        </div>
      </div>

      <div className="border-t border-gray-300 pt-3 mb-4">
        <h3 className="font-semibold text-sm mb-2 uppercase text-gray-700">Payment</h3>
        {variant === "office" ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div><span className="text-gray-500">Total Amount:</span> <strong>{fmtMoney(booking.totalAmount)}</strong></div>
            <div><span className="text-gray-500">Advance Received:</span> <strong>{fmtMoney(booking.advanceReceived)}</strong></div>
            <div><span className="text-gray-500">Remaining Balance:</span> <strong>{fmtMoney(remaining)}</strong></div>
            <div><span className="text-gray-500">Payment Status:</span> <strong>{booking.paymentStatus}</strong></div>
          </div>
        ) : (
          <div className="text-sm">
            {remaining > 0 ? (
              <p className="font-semibold text-base">Collect {fmtMoney(remaining)} from customer in cash.</p>
            ) : (
              <p className="font-semibold">No balance to collect — fully paid.</p>
            )}
          </div>
        )}
      </div>

      {(booking.customerDiscussionSummary || booking.notes) && (
        <div className="border-t border-gray-300 pt-3 mb-4 text-sm">
          {booking.customerDiscussionSummary && (
            <div className="mb-2">
              <h3 className="font-semibold uppercase text-gray-700 text-xs mb-1">Customer Discussion</h3>
              <p>{booking.customerDiscussionSummary}</p>
            </div>
          )}
          {booking.notes && (
            <div>
              <h3 className="font-semibold uppercase text-gray-700 text-xs mb-1">Instructions</h3>
              <p>{booking.notes}</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mt-10 pt-6 text-xs text-center">
        <div className="border-t border-gray-400 pt-1">Customer Signature</div>
        <div className="border-t border-gray-400 pt-1">Driver Signature</div>
        <div className="border-t border-gray-400 pt-1">Authorized Signature</div>
      </div>
    </div>
  );
};

export default DutySlip;
