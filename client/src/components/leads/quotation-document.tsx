import React from "react";

interface QuotationDocumentProps {
  quotation: any;
  inquiry: any;
  companyName: string;
  companyPhone?: string;
}

function fmtDate(d?: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtPaise(paise?: number) {
  return `Rs. ${((paise || 0) / 100).toLocaleString("en-IN")}`;
}

const QuotationDocument: React.FC<QuotationDocumentProps> = ({ quotation, inquiry, companyName, companyPhone }) => {
  return (
    <div id="quotation-pdf" className="max-w-2xl mx-auto p-6 bg-white text-gray-900" style={{ fontFamily: "Arial, sans-serif" }}>
      <div className="text-center border-b-2 border-gray-800 pb-3 mb-4">
        <h1 className="text-2xl font-bold">{companyName}</h1>
        {companyPhone && <p className="text-sm text-gray-600">{companyPhone}</p>}
        <h2 className="text-lg font-semibold mt-2 uppercase tracking-wide">Quotation</h2>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mb-4">
        <div><span className="text-gray-500">Quotation No:</span> <strong>{quotation.quotationNumber || "DRAFT"}</strong></div>
        <div><span className="text-gray-500">Version:</span> <strong>v{quotation.version}</strong></div>
        <div><span className="text-gray-500">Inquiry No:</span> <strong>{inquiry.inquiryNumber}</strong></div>
        <div><span className="text-gray-500">Valid Till:</span> <strong>{fmtDate(quotation.validTill)}</strong></div>
        <div><span className="text-gray-500">Customer:</span> <strong>{inquiry.customerName}</strong></div>
        <div><span className="text-gray-500">Mobile:</span> <strong>{inquiry.primaryMobile}</strong></div>
        <div><span className="text-gray-500">Travel Date:</span> <strong>{fmtDate(inquiry.pickupDate)}</strong></div>
        <div><span className="text-gray-500">Route:</span> <strong>{inquiry.route || inquiry.pickupLocation || "-"}</strong></div>
      </div>

      <table className="w-full text-sm border-collapse mb-4">
        <thead>
          <tr className="border-b-2 border-gray-800">
            <th className="text-left py-1">Option</th>
            <th className="text-left py-1">Vehicle</th>
            <th className="text-left py-1">Qty</th>
            <th className="text-left py-1">Pricing</th>
            <th className="text-right py-1">Total</th>
          </tr>
        </thead>
        <tbody>
          {(quotation.options || []).map((opt: any) => (
            <tr key={opt.optionNumber} className={`border-b border-gray-200 ${quotation.acceptedOptionNumber === opt.optionNumber ? "bg-green-50" : ""}`}>
              <td className="py-1">#{opt.optionNumber}{quotation.acceptedOptionNumber === opt.optionNumber ? " (Accepted)" : ""}</td>
              <td className="py-1">{opt.vehicleNameSnapshot}</td>
              <td className="py-1">{opt.quantity}</td>
              <td className="py-1 capitalize">{(opt.pricingType || "").replace(/_/g, " ")}</td>
              <td className="py-1 text-right font-semibold">{fmtPaise(opt.totalPaise)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {quotation.paymentTerms && <p className="text-sm mb-2"><span className="text-gray-500">Payment Terms:</span> {quotation.paymentTerms}</p>}
      {quotation.termsAndConditions && <p className="text-sm mb-2"><span className="text-gray-500">Terms & Conditions:</span> {quotation.termsAndConditions}</p>}
      {quotation.cancellationTerms && <p className="text-sm mb-2"><span className="text-gray-500">Cancellation Terms:</span> {quotation.cancellationTerms}</p>}

      <div className="text-center text-sm text-gray-500 mt-6 pt-3 border-t border-gray-300">
        Thank you for considering {companyName}.
      </div>
    </div>
  );
};

export default QuotationDocument;
