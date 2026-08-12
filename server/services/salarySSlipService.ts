/**
 * PHASE 10: SALARY SLIP SERVICE
 * Generate professional salary slip PDFs
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { IDriverSalary, DriverSalary } from '../models/index';
import mongoose from 'mongoose';

export interface SalarySlipConfig {
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyLogo?: string;
}

/**
 * Generate salary slip PDF buffer
 */
export async function generateSalarySlip(
  tenantId: string | mongoose.Types.ObjectId,
  salaryId: string | mongoose.Types.ObjectId,
  config: Partial<SalarySlipConfig> = {}
): Promise<Buffer> {
  try {
    // Fetch salary record with populated driver info
    const salary = await DriverSalary.findOne({
      _id: new mongoose.Types.ObjectId(salaryId),
      tenantId: new mongoose.Types.ObjectId(tenantId)
    }).populate('driverId', 'name phone email');

    if (!salary) {
      throw new Error('Salary record not found');
    }

    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    let yPosition = 20;

    // Letterhead
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text(config.companyName || 'FleetPro Management', 20, yPosition);
    yPosition += 10;

    if (config.companyAddress) {
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      pdf.text(config.companyAddress, 20, yPosition);
      yPosition += 5;
    }

    // Title
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.text('SALARY SLIP', 20, yPosition + 5);
    yPosition += 15;

    // Employee and Period Info
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    pdf.text('Employee Information', 20, yPosition);
    yPosition += 7;

    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    const driver = (salary.driverId as any);
    const driverName = typeof driver === 'object' ? driver.name : 'Unknown';
    const driverPhone = typeof driver === 'object' ? driver.phone : 'N/A';

    const employeeInfo = [
      [`Name: ${driverName}`, `ID: ${salary.driverId}`],
      [`Phone: ${driverPhone}`, `Period: ${salary.salaryPeriodStart.toLocaleDateString()} to ${salary.salaryPeriodEnd.toLocaleDateString()}`],
    ];

    pdf.autoTable({
      head: [],
      body: employeeInfo,
      startY: yPosition,
      margin: { left: 20, right: 20 },
      styles: { fontSize: 10, cellPadding: 3 },
      bodyStyles: { textColor: [0, 0, 0] },
    } as any);

    yPosition = (pdf as any).lastAutoTable.finalY + 10;

    // Earnings Section
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    pdf.text('Earnings', 20, yPosition);
    yPosition += 7;

    const earningsData = [
      ['Base Salary', `₹${salary.baseMonthly.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
      [`Daily Rate (₹${(salary.dailyRate || 0).toFixed(2)}) × ${salary.payableDays} days`, `₹${salary.grossEarned.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
    ];

    if (salary.allowances && Object.keys(salary.allowances).length > 0) {
      for (const [key, value] of Object.entries(salary.allowances)) {
        if (value && typeof value === 'number' && value > 0) {
          earningsData.push([
            key.replace(/_/g, ' ').toUpperCase(),
            `₹${(value as number).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
          ]);
        }
      }
    }

    if (salary.incentives && Object.keys(salary.incentives).length > 0) {
      for (const [key, value] of Object.entries(salary.incentives)) {
        if (value && typeof value === 'number' && value > 0) {
          earningsData.push([
            key.replace(/_/g, ' ').toUpperCase(),
            `₹${(value as number).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
          ]);
        }
      }
    }

    earningsData.push(['', '']);
    earningsData.push([
      { content: 'Gross Earned', styles: { fontStyle: 'bold' } },
      { content: `₹${salary.grossEarned.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold' } }
    ]);

    pdf.autoTable({
      head: [],
      body: earningsData,
      startY: yPosition,
      margin: { left: 20, right: 20 },
      styles: { fontSize: 10, cellPadding: 3 },
      bodyStyles: { textColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { halign: 'right', cellWidth: 50 }
      },
    } as any);

    yPosition = (pdf as any).lastAutoTable.finalY + 10;

    // Deductions Section
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    pdf.text('Deductions', 20, yPosition);
    yPosition += 7;

    const deductionsData: any[] = [];

    if (salary.advanceDeduction && salary.advanceDeduction > 0) {
      deductionsData.push(['Salary Advance', `₹${salary.advanceDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`]);
    }

    if (salary.rechargeDeduction && salary.rechargeDeduction > 0) {
      deductionsData.push(['Recharge Deduction', `₹${salary.rechargeDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`]);
    }

    if (salary.recoveryDeduction && salary.recoveryDeduction > 0) {
      deductionsData.push(['Recovery Deduction', `₹${salary.recoveryDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`]);
    }

    if (deductionsData.length === 0) {
      deductionsData.push(['No Deductions', '₹0.00']);
    }

    deductionsData.push(['', '']);
    deductionsData.push([
      { content: 'Total Deductions', styles: { fontStyle: 'bold' } },
      { content: `₹${salary.totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold' } }
    ]);

    pdf.autoTable({
      head: [],
      body: deductionsData,
      startY: yPosition,
      margin: { left: 20, right: 20 },
      styles: { fontSize: 10, cellPadding: 3 },
      bodyStyles: { textColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { halign: 'right', cellWidth: 50 }
      },
    } as any);

    yPosition = (pdf as any).lastAutoTable.finalY + 10;

    // Net Salary Section (Highlighted)
    pdf.setDrawColor(0, 102, 204);
    pdf.setFillColor(230, 240, 250);
    pdf.rect(20, yPosition - 2, 170, 15, 'F');

    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(0, 102, 204);
    pdf.text('NET SALARY', 20, yPosition + 5);
    pdf.setFontSize(14);
    pdf.text(`₹${salary.netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 120, yPosition + 5);

    yPosition += 20;
    pdf.setTextColor(0, 0, 0);

    // Payment Status
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    const statusData = [
      ['Payment Status:', salary.status.replace(/_/g, ' ').toUpperCase()],
      ['Total Paid:', `₹${salary.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
      ['Remaining Balance:', `₹${salary.remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
    ];

    pdf.autoTable({
      head: [],
      body: statusData,
      startY: yPosition,
      margin: { left: 20, right: 20 },
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { halign: 'right', cellWidth: 50 }
      },
    } as any);

    yPosition = (pdf as any).lastAutoTable.finalY + 15;

    // Footer
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 20, yPosition);
    pdf.text('This is an electronically generated document. No signature is required.', 20, yPosition + 5);

    // Convert to buffer
    return Buffer.from(pdf.output('arraybuffer'));
  } catch (error) {
    console.error('Error generating salary slip:', error);
    throw error;
  }
}

/**
 * Generate salary slip and save to file (for testing)
 */
export async function generateAndSaveSalarySlip(
  tenantId: string | mongoose.Types.ObjectId,
  salaryId: string | mongoose.Types.ObjectId,
  outputPath: string,
  config?: Partial<SalarySlipConfig>
): Promise<string> {
  try {
    const buffer = await generateSalarySlip(tenantId, salaryId, config);
    const fs = require('fs').promises;
    await fs.writeFile(outputPath, buffer);
    return outputPath;
  } catch (error) {
    console.error('Error saving salary slip:', error);
    throw error;
  }
}

/**
 * Generate bulk salary slips for all drivers in a month
 */
export async function generateBulkSalarySslips(
  tenantId: string | mongoose.Types.ObjectId,
  month: number,
  year: number,
  config?: Partial<SalarySlipConfig>
): Promise<Array<{ driverId: string; salaryId: string; buffer: Buffer }>> {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const salaries = await DriverSalary.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      salaryPeriodStart: { $gte: startDate },
      salaryPeriodEnd: { $lte: endDate }
    });

    const slips = [];
    for (const salary of salaries) {
      try {
        const buffer = await generateSalarySlip(tenantId, salary._id!, config);
        slips.push({
          driverId: salary.driverId.toString(),
          salaryId: salary._id!.toString(),
          buffer
        });
      } catch (error) {
        console.error(`Failed to generate slip for salary ${salary._id}:`, error);
      }
    }

    return slips;
  } catch (error) {
    console.error('Error generating bulk salary slips:', error);
    throw error;
  }
}
