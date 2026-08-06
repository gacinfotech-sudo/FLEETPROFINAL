// Quotation WhatsApp message — Hinglish template per the Inquiry/Lead spec
// §21. No customer, route, or price detail is hard-coded; everything comes
// from the quotation/lead/inquiry/tenant documents passed in. Mirrors the
// structure of templates.ts's buildBookingConfirmationMessage.

function formatDate(d: any): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatPaise(paise?: number): string {
  return `₹${((paise || 0) / 100).toLocaleString('en-IN')}`;
}

export function buildQuotationMessage(quotation: any, inquiry: any, tenant: any): string {
  const brandName = tenant.businessName || tenant.name;
  const lines: string[] = [
    `Namaste ${inquiry.customerName} ji,`,
    ``,
    `Aapki travel requirement ke according ${brandName} ki quotation ready hai.`,
    ``,
    `Inquiry Number: ${inquiry.inquiryNumber}`,
  ];
  if (inquiry.pickupDate) lines.push(`Travel Date: ${formatDate(inquiry.pickupDate)}`);
  const route = inquiry.route || [inquiry.pickupLocation, inquiry.dropLocation].filter(Boolean).join(' -> ');
  if (route) lines.push(`Route: ${route}`);
  if (inquiry.numberOfPassengers) lines.push(`Passengers: ${inquiry.numberOfPassengers}`);

  lines.push(``);
  lines.push(`Quotation Options:`);
  for (const option of quotation.options || []) {
    lines.push(`- ${option.vehicleNameSnapshot} (Qty ${option.quantity}): ${formatPaise(option.totalPaise)}`);
  }

  lines.push(``);
  lines.push(`Please quotation check karein. Kisi change, alternative vehicle ya package clarification ke liye humein message ya call kar sakte hain.`);
  if (quotation.validTill) lines.push(``, `Quotation Valid Till: ${formatDate(quotation.validTill)}`);
  lines.push(``, `Regards,`, `Sales Team`, brandName);
  if (tenant.supportMobile || tenant.phone) lines.push(tenant.supportMobile || tenant.phone);

  return lines.join('\n');
}
