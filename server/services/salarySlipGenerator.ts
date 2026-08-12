/**
 * PHASE 10: SALARY SLIP PDF GENERATOR
 * Generates professional PDF salary slips for drivers
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { DriverSalary, DriverSalaryMaster } from '../models/index';
import mongoose from 'mongoose';

interface SlipData {
  salary: any;
  salaryMaster: any;
  company: {
    name: string;
    address: string;
    phone?: string;
  };
}

export async function generateSalarySlip(
  tenantId: string | mongoose.Types.ObjectId,
  salaryId: string | mongoose.Types.ObjectId
): Promise<Buffer> {
  // Fetch salary record
  const salary = await DriverSalary.findOne({
    _id: new mongoose.Types.ObjectId(salaryId as any),
    tenantId: new mongoose.Types.ObjectId(tenantId as any)
  }).populate('driverId');

  if (!salary) {
    throw new Error('Salary record not found');
  }

  // Fetch salary master for additional config
  const salaryMaster = await DriverSalaryMaster.findOne({
    tenantId: new mongoose.Types.ObjectId(tenantId as any),
    driverId: salary.driverId._id
  });

  // Create PDF
  const pdf = new jsPDF('p', 'mm', 'A4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Set fonts
  const titleFont = { name: 'helvetica', size: 14, weight: 'bold' };
  const headerFont = { name: 'helvetica', size: 11, weight: 'bold' };
  const normalFont = { name: 'helvetica', size: 10 };
  const smallFont = { name: 'helvetica', size: 9 };

  let yPosition = 15;

  // Company Header
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('SALARY SLIP', pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 8;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Generated on: ' + new Date().toLocaleDateString(), pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 12;

  // Driver Information
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Employee Information:', 15, yPosition);

  yPosition += 6;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');

  const driverInfo = [
    ['Name:', (salary.driverId as any).name || 'N/A'],
    ['Employee ID:', salary.driverId._id.toString().substring(0, 8)],
    ['Contact:', (salary.driverId as any).phone || 'N/A'],
    ['Email:', (salary.driverId as any).email || 'N/A']
  ];

  for (const [label, value] of driverInfo) {
    pdf.text(label + ' ' + value, 15, yPosition);
    yPosition += 5;
  }

  yPosition += 3;

  // Salary Period
  pdf.setFont('helvetica', 'bold');
  pdf.text('Salary Period:', 15, yPosition);

  yPosition += 5;
  pdf.setFont('helvetica', 'normal');
  const startDate = new Date(salary.salaryPeriodStart).toLocaleDateString();
  const endDate = new Date(salary.salaryPeriodEnd).toLocaleDateString();
  pdf.text(`${startDate} to ${endDate}`, 15, yPosition);

  yPosition += 8;

  // Attendance Summary
  pdf.setFont('helvetica', 'bold');
  pdf.text('Attendance Summary:', 15, yPosition);

  yPosition += 5;
  pdf.setFont('helvetica', 'normal');

  const attendanceSummary = [
    ['Total Days in Period:', salary.payrollDays.toString()],
    ['Payable Days:', salary.payableDays.toString()],
    ['Service Days (Bookings):', salary.dayWiseBreakdown?.filter((d: any) => d.dayType === 'booking_service').length.toString() || 'N/A'],
    ['Free Days:', salary.dayWiseBreakdown?.filter((d: any) => d.dayType === 'free').length.toString() || 'N/A']
  ];

  for (const [label, value] of attendanceSummary) {
    pdf.text(label + ' ' + value, 15, yPosition);
    yPosition += 5;
  }

  yPosition += 3;

  // Earnings Table
  pdf.setFont('helvetica', 'bold');
  pdf.text('EARNINGS', 15, yPosition);

  yPosition += 5;
  pdf.setFont('helvetica', 'normal');

  const earningsData = [
    ['Description', 'Amount (₹)'],
    ['Base Salary (' + salary.payableDays + ' days @ ₹' + salary.dailyRate.toFixed(2) + '/day)', salary.earnings?.baseSalary?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'],
    ...(salary.allowances && salary.allowances > 0 ? [['Allowances', salary.allowances.toLocaleString('en-IN', { minimumFractionDigits: 2 })]] : []),
    ...(salary.incentives && salary.incentives > 0 ? [['Incentives', salary.incentives.toLocaleString('en-IN', { minimumFractionDigits: 2 })]] : []),
    ...(salary.bonuses && salary.bonuses > 0 ? [['Bonuses', salary.bonuses.toLocaleString('en-IN', { minimumFractionDigits: 2 })]] : []),
    ['Gross Earned', salary.grossEarned?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00']
  ];

  (pdf as any).autoTable({
    startY: yPosition,
    head: [earningsData[0]],
    body: earningsData.slice(1),
    theme: 'grid',
    margin: { left: 15, right: 15 },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [200, 200, 200], textColor: 0, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] }
  });

  yPosition = (pdf as any).lastAutoTable.finalY + 5;

  // Deductions Table
  pdf.setFont('helvetica', 'bold');
  pdf.text('DEDUCTIONS', 15, yPosition);

  yPosition += 5;

  const deductionsData = [
    ['Description', 'Amount (₹)'],
    ...(salary.advanceDeduction && salary.advanceDeduction > 0 ? [['Advance Deduction', salary.advanceDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })]] : []),
    ...(salary.rechargeDeduction && salary.rechargeDeduction > 0 ? [['Recharge Deduction', salary.rechargeDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })]] : []),
    ...(salary.recoveryDeduction && salary.recoveryDeduction > 0 ? [['Recovery Deduction', salary.recoveryDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })]] : []),
    ...(salary.otherDeduction && salary.otherDeduction > 0 ? [['Other Deductions', salary.otherDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })]] : []),
    ['Total Deductions', salary.totalDeductions?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00']
  ];

  (pdf as any).autoTable({
    startY: yPosition,
    head: [deductionsData[0]],
    body: deductionsData.slice(1),
    theme: 'grid',
    margin: { left: 15, right: 15 },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [200, 200, 200], textColor: 0, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] }
  });

  yPosition = (pdf as any).lastAutoTable.finalY + 8;

  // NET SALARY (Highlighted)
  pdf.setFont('helvetica', 'bold');
  pdf.setFillColor(52, 152, 219); // Blue background
  pdf.setTextColor(255, 255, 255); // White text
  pdf.rect(15, yPosition - 4, pageWidth - 30, 10, 'F');
  pdf.text('NET SALARY:', 20, yPosition + 2);
  pdf.text('₹' + salary.netPayable?.toLocaleString('en-IN', { minimumFractionDigits: 2 }), pageWidth - 30, yPosition + 2, { align: 'right' });

  yPosition += 12;

  // Payment Status
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Payment Status:', 15, yPosition);

  yPosition += 5;
  pdf.setFont('helvetica', 'normal');

  const paymentData = [
    ['Status:', salary.status?.replace(/_/g, ' ').toUpperCase() || 'PENDING'],
    ['Already Paid:', '₹' + salary.totalPaid?.toLocaleString('en-IN', { minimumFractionDigits: 2 })],
    ['Remaining Balance:', '₹' + salary.remainingBalance?.toLocaleString('en-IN', { minimumFractionDigits: 2 })]
  ];

  for (const [label, value] of paymentData) {
    pdf.text(label + ' ' + value, 15, yPosition);
    yPosition += 5;
  }

  yPosition += 8;

  // Footer
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text('This is a system-generated salary slip. No signature is required.', pageWidth / 2, pageHeight - 20, { align: 'center' });
  pdf.text('Generated by FleetPro Salary Module on ' + new Date().toLocaleString(), pageWidth / 2, pageHeight - 15, { align: 'center' });

  return Buffer.from(pdf.output('arraybuffer'));
}
