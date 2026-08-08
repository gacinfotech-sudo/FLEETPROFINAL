import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Wave 1-3 Components
import RevenueAnalyticsHeader from "./revenue-dashboard-header";
import { useTheme, ThemeSwitcher } from "./revenue-dashboard-theme";
import {
  RevenueByVehicleChart,
  RevenueByBookingTypeChart,
  ExpenseBreakdownChart
} from "./revenue-dashboard-charts";
import { KPICardsGrid } from "./revenue-kpi-cards";
import { TopVehiclesRanking } from "./top-vehicles-revenue-source";
import {
  formatIndianCurrency,
  formatDate,
  formatPercentage
} from "@/lib/revenue-dashboard-utils";

interface RevenueReportData {
  totalRevenue: number;
  totalExpenses: number;
  netRevenue: number;
  averageBookingValue: number;
  revenuePerVehicle: number;
  fleetUtilization: number;
  revenueByVehicleType: Array<{ type: string; revenue: number; count: number }>;
  revenueByBookingType: Array<{ type: string; revenue: number; count: number }>;
  topPerformingVehicles: Array<{ vehicle: any; revenue: number; bookings: number }>;
  completedBookings: number;
  expensesByCategory: Array<{ category: string; amount: number; count: number }>;
}

export default function RevenueReport() {
  const { currentTheme } = useTheme();
  const [timePeriod, setTimePeriod] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Apply theme to root element
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', currentTheme);
  }, [currentTheme]);

  // Generate date range based on selected period
  const getDateRange = () => {
    const now = new Date();
    let start, end;

    switch (timePeriod) {
      case "today":
        start = end = now.toISOString().split('T')[0];
        break;
      case "week":
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 7);
        start = weekStart.toISOString().split('T')[0];
        end = now.toISOString().split('T')[0];
        break;
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        break;
      case "quarter":
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        start = new Date(now.getFullYear(), quarterStart, 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), quarterStart + 3, 0).toISOString().split('T')[0];
        break;
      case "year":
        start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
        break;
      case "custom":
        start = startDate;
        end = endDate;
        break;
      default:
        start = "";
        end = "";
    }

    return { startDate: start, endDate: end };
  };

  const dateRange = getDateRange();

  const { data: reportData, isLoading } = useQuery<RevenueReportData>({
    queryKey: ["/api/reports/revenue", timePeriod, dateRange.startDate, dateRange.endDate],
    queryFn: ({ queryKey }) => {
      const [, , startDate, endDate] = queryKey;
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate as string);
      if (endDate) params.append('endDate', endDate as string);
      return fetch(`/api/reports/revenue?${params.toString()}`).then(res => res.json());
    },
    enabled: timePeriod === "all" || !!(dateRange.startDate && dateRange.endDate),
    staleTime: 0,
    gcTime: 0
  });

  const generateRevenueReportPDF = async () => {
    if (!reportData) {
      alert('No data available to export');
      return;
    }

    setIsExporting(true);
    try {
      const data = reportData;

      let businessProfile = null;
      try {
        const profileResponse = await fetch('/api/auth/business-profile-for-documents', {
          credentials: 'include'
        });
        if (profileResponse.ok) {
          businessProfile = await profileResponse.json();
        }
      } catch (error) {
        console.warn('Could not fetch business profile:', error);
      }

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const loadLogoImage = async (): Promise<string | null> => {
        if (!businessProfile?.businessDetails?.logoUrl) return null;

        try {
          const logoUrl = businessProfile.businessDetails.logoUrl;
          const fullUrl = logoUrl.startsWith('http') ? logoUrl : `${window.location.origin}${logoUrl}`;

          return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx?.drawImage(img, 0, 0);
                const imgData = canvas.toDataURL('image/jpeg', 0.8);
                resolve(imgData);
              } catch (error) {
                console.error('Error processing logo image:', error);
                resolve(null);
              }
            };

            img.onerror = () => {
              console.error('Error loading logo image');
              resolve(null);
            };

            img.src = fullUrl;
          });
        } catch (error) {
          console.error('Error in loadLogoImage:', error);
          return null;
        }
      };

      const addHeader = (pageTitle: string, logoImageData?: string | null) => {
        if (logoImageData) {
          try {
            pdf.addImage(logoImageData, 'JPEG', 20, 15, 25, 15);
          } catch (error) {
            console.error('Error adding logo to PDF:', error);
            pdf.setTextColor(59, 130, 246);
            pdf.setFontSize(16);
            pdf.setFont('helvetica', 'bold');
            pdf.text('🚗 FleetPro', 20, 25);
          }
        } else {
          pdf.setTextColor(59, 130, 246);
          pdf.setFontSize(16);
          pdf.setFont('helvetica', 'bold');
          pdf.text('🚗 FleetPro', 20, 25);
        }

        if (businessProfile && businessProfile.businessDetails) {
          const details = businessProfile.businessDetails;
          const rightColumnStart = pageWidth / 2 + 10;

          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(14);
          pdf.setFont('helvetica', 'bold');
          pdf.text(details.businessName || 'Business Name', pageWidth - 15, 20, { align: 'right' });

          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(75, 85, 99);
          let addressY = 26;

          if (details.businessAddress) {
            const maxWidth = pageWidth - rightColumnStart - 15;
            const addressLines = pdf.splitTextToSize(details.businessAddress, maxWidth);

            if (Array.isArray(addressLines)) {
              const limitedLines = addressLines.slice(0, 3);
              limitedLines.forEach((line, index) => {
                pdf.text(line, pageWidth - 15, addressY + (index * 3.5), { align: 'right' });
              });
              addressY += (limitedLines.length * 3.5);
            } else {
              pdf.text(addressLines, pageWidth - 15, addressY, { align: 'right' });
              addressY += 3.5;
            }
          }

          if (details.businessEmail && addressY < 36) {
            pdf.text(details.businessEmail, pageWidth - 15, addressY, { align: 'right' });
            addressY += 3.5;
          }

          if (details.businessPhone && addressY < 36) {
            pdf.text('Phone: ' + details.businessPhone, pageWidth - 15, addressY, { align: 'right' });
          }
        }

        pdf.setDrawColor(229, 231, 235);
        pdf.setLineWidth(0.5);
        pdf.line(20, 42, pageWidth - 20, 42);

        return 52;
      };

      const logoImageData = await loadLogoImage();
      let yPos = addHeader('Revenue Summary', logoImageData);

      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Revenue Summary', 20, yPos);
      yPos += 20;

      const periodText = timePeriod === 'all' ? 'All Time' :
                        timePeriod === 'today' ? 'Today' :
                        timePeriod === 'week' ? 'This Week' :
                        timePeriod === 'month' ? 'This Month' :
                        timePeriod === 'quarter' ? 'This Quarter' :
                        timePeriod === 'year' ? 'This Year' : 'Custom Range';

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text('Period: ' + periodText, 20, yPos);
      yPos += 25;

      const boxWidth = 88;
      const boxHeight = 65;
      const boxSpacing = 8;

      const kpis = [
        { title: formatIndianCurrency(data.totalRevenue || 0), subtitle: 'Revenue from bookings', label: 'Total Revenue' },
        { title: formatIndianCurrency(data.totalExpenses || 0), subtitle: 'Fleet maintenance & operations', label: 'Total Expenses' },
        { title: formatIndianCurrency(data.netRevenue || 0), subtitle: 'Revenue - Expenses', label: 'Net Revenue' },
        { title: (data.completedBookings || 0).toString(), subtitle: 'Completed trips', label: 'Total Bookings' }
      ];

      kpis.forEach((kpi, index) => {
        const row = Math.floor(index / 2);
        const col = index % 2;
        const x = 20 + col * (boxWidth + boxSpacing);
        const y = yPos + row * (boxHeight + boxSpacing);

        pdf.setFillColor(248, 250, 252);
        pdf.rect(x, y, boxWidth, boxHeight, 'F');

        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.5);
        pdf.rect(x, y, boxWidth, boxHeight);

        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(22);
        pdf.setFont('helvetica', 'bold');
        pdf.text(kpi.title, x + 8, y + 28);

        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(51, 65, 85);
        pdf.text(kpi.label, x + 8, y + 42);

        pdf.setFontSize(9);
        pdf.setTextColor(100, 116, 139);
        pdf.setFont('helvetica', 'normal');
        pdf.text(kpi.subtitle, x + 8, y + 52);
      });

      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text(`Page ${i} of ${totalPages}`, pageWidth - 30, pageHeight - 10);
        pdf.text('FleetPro Fleet Management System', 20, pageHeight - 10);
      }

      const filename = 'FleetPro_Revenue_Report_' + new Date().toISOString().split('T')[0] + '.pdf';
      pdf.save(filename);

    } catch (error) {
      console.error('Error generating PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert('Failed to generate PDF report. Error: ' + errorMessage);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const data = reportData || {
    totalRevenue: 0,
    totalExpenses: 0,
    netRevenue: 0,
    averageBookingValue: 0,
    revenuePerVehicle: 0,
    fleetUtilization: 0,
    revenueByVehicleType: [],
    revenueByBookingType: [],
    topPerformingVehicles: [],
    completedBookings: 0,
    expensesByCategory: []
  };

  return (
    <div className="w-full max-w-full overflow-hidden space-y-6">
      {/* Premium Header */}
      <RevenueAnalyticsHeader
        dateRange={timePeriod}
        onDateRangeChange={setTimePeriod}
        onExport={generateRevenueReportPDF}
        themeSwitcher={<ThemeSwitcher />}
      />

      {/* Custom Date Range */}
      {timePeriod === "custom" && (
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>
      )}

      {/* Main KPI Cards */}
      {data.totalRevenue !== undefined && (
        <>
          <KPICardsGrid
            totalRevenue={data.totalRevenue}
            totalExpenses={data.totalExpenses}
            netRevenue={data.netRevenue}
            averageBookingValue={data.averageBookingValue}
            revenuePerVehicle={data.revenuePerVehicle}
            fleetUtilization={data.fleetUtilization}
            completedBookings={data.completedBookings}
          />

          {/* Revenue Overview Chart - TODO: integrate with chart data */}

          {/* Revenue Breakdown Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.revenueByVehicleType.length > 0 && (
              <RevenueByVehicleChart vehicleData={data.revenueByVehicleType} />
            )}
            {data.revenueByBookingType.length > 0 && (
              <RevenueByBookingTypeChart bookingData={data.revenueByBookingType} />
            )}
          </div>

          {/* Expense Breakdown */}
          {data.expensesByCategory.length > 0 && (
            <ExpenseBreakdownChart expenseData={data.expensesByCategory} />
          )}

          {/* Top Vehicles */}
          {data.topPerformingVehicles.length > 0 && (
            <TopVehiclesRanking vehicles={data.topPerformingVehicles} />
          )}

          {/* Financial Transactions Table - TODO: fetch from backend */}
        </>
      )}
    </div>
  );
}
