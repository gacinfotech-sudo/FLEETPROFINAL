import { ReportDefinition, ReportExecution } from '../models/enterprise.models';
import { Booking, Invoice, Vehicle, Driver } from '../models';

/**
 * WAVE 21: Custom Report Builder Service
 * Drag-drop report builder with templates, filters, grouping, aggregations
 */
export class ReportBuilderService {
  /**
   * Create custom report definition
   */
  async createReportDefinition(tenantId: string, userId: string, data: any): Promise<any> {
    const reportDef = new ReportDefinition({
      tenantId,
      name: data.name,
      description: data.description,
      type: data.type || 'custom',
      dataSource: data.dataSource,
      filters: data.filters || [],
      grouping: data.grouping,
      aggregations: data.aggregations,
      sorting: data.sorting,
      scheduling: data.scheduling,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return reportDef.save();
  }

  /**
   * Execute report and generate results
   */
  async executeReport(tenantId: string, reportDefinitionId: string): Promise<any> {
    const reportDef = await ReportDefinition.findOne({
      _id: reportDefinitionId,
      tenantId,
    });

    if (!reportDef) {
      throw new Error('Report definition not found');
    }

    const execution = new ReportExecution({
      tenantId,
      reportDefinitionId,
      status: 'processing',
      executedAt: new Date(),
      createdAt: new Date(),
    });

    await execution.save();

    try {
      // Fetch data based on dataSource entity
      let data = await this.fetchData(tenantId, reportDef.dataSource);

      // Apply filters
      if (reportDef.filters && reportDef.filters.length > 0) {
        data = this.applyFilters(data, reportDef.filters);
      }

      // Apply grouping
      if (reportDef.grouping) {
        data = this.applyGrouping(data, reportDef.grouping);
      }

      // Apply aggregations
      let summary = {};
      if (reportDef.aggregations && reportDef.aggregations.length > 0) {
        summary = this.applyAggregations(data, reportDef.aggregations);
      }

      // Apply sorting
      if (reportDef.sorting) {
        data = this.applySorting(data, reportDef.sorting);
      }

      execution.status = 'completed';
      execution.result = {
        rows: data,
        summary,
        generatedAt: new Date(),
      };
      execution.completedAt = new Date();

      return execution.save();
    } catch (error: any) {
      execution.status = 'failed';
      execution.errorMessage = error.message;
      execution.completedAt = new Date();

      await execution.save();
      throw error;
    }
  }

  /**
   * Fetch data from entity
   */
  private async fetchData(tenantId: string, dataSource: any): Promise<any[]> {
    const selectFields = dataSource.fields.join(' ');

    switch (dataSource.entity) {
      case 'bookings':
        return (await Booking.find({ tenantId }).select(selectFields).lean()) as any[];
      case 'invoices':
        return (await Invoice.find({ tenantId }).select(selectFields).lean()) as any[];
      case 'vehicles':
        return (await Vehicle.find({ tenantId }).select(selectFields).lean()) as any[];
      case 'drivers':
        return (await Driver.find({ tenantId }).select(selectFields).lean()) as any[];
      default:
        return [];
    }
  }

  /**
   * Apply filters to data
   */
  private applyFilters(data: any[], filters: any[]): any[] {
    return data.filter((item) => {
      return filters.every((filter) => {
        const value = this.getNestedProperty(item, filter.field);

        switch (filter.operator) {
          case 'eq':
            return value === filter.value;
          case 'gt':
            return value > filter.value;
          case 'lt':
            return value < filter.value;
          case 'gte':
            return value >= filter.value;
          case 'lte':
            return value <= filter.value;
          case 'in':
            return filter.value.includes(value);
          case 'contains':
            return String(value).includes(String(filter.value));
          default:
            return true;
        }
      });
    });
  }

  /**
   * Apply grouping
   */
  private applyGrouping(data: any[], grouping: any[]): any[] {
    let grouped = data;

    for (const group of grouping) {
      const groupMap = new Map();

      grouped.forEach((item) => {
        const key = this.getNestedProperty(item, group.field);
        const existing = groupMap.get(key) || [];
        existing.push(item);
        groupMap.set(key, existing);
      });

      // Convert back to array format
      grouped = Array.from(groupMap.entries()).map(([key, items]) => ({
        [group.field]: key,
        items,
      }));
    }

    return grouped;
  }

  /**
   * Apply aggregations
   */
  private applyAggregations(data: any[], aggregations: any[]): Record<string, any> {
    const result: Record<string, any> = {};

    for (const agg of aggregations) {
      const values = data.map((item) => this.getNestedProperty(item, agg.field)).filter(Boolean);

      const alias = agg.alias || `${agg.function}_${agg.field}`;

      switch (agg.function) {
        case 'sum':
          result[alias] = values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          result[alias] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          break;
        case 'count':
          result[alias] = values.length;
          break;
        case 'max':
          result[alias] = Math.max(...values);
          break;
        case 'min':
          result[alias] = Math.min(...values);
          break;
      }
    }

    return result;
  }

  /**
   * Apply sorting
   */
  private applySorting(data: any[], sorting: any[]): any[] {
    return data.sort((a, b) => {
      for (const sort of sorting) {
        const aVal = this.getNestedProperty(a, sort.field);
        const bVal = this.getNestedProperty(b, sort.field);

        if (aVal !== bVal) {
          const comparison = aVal > bVal ? 1 : -1;
          return sort.order === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
  }

  /**
   * Get nested property
   */
  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
  }

  /**
   * Export report to format
   */
  async exportReport(tenantId: string, executionId: string, format: 'csv' | 'excel' | 'pdf'): Promise<string> {
    const execution = await ReportExecution.findOne({
      _id: executionId,
      tenantId,
    });

    if (!execution || !execution.result) {
      throw new Error('Report not found or not executed');
    }

    let exportData: string;

    switch (format) {
      case 'csv':
        exportData = this.convertToCSV(execution.result.rows);
        break;
      case 'excel':
        exportData = this.convertToExcel(execution.result.rows);
        break;
      case 'pdf':
        exportData = this.convertToPDF(execution.result.rows, execution.result.summary);
        break;
      default:
        throw new Error('Unsupported format');
    }

    // In production, upload to S3 and return signed URL
    execution.exportFormats = {
      ...execution.exportFormats,
      [format]: `/reports/${executionId}/export/${format}`,
    };

    await execution.save();

    return `/reports/${executionId}/export/${format}`;
  }

  /**
   * Convert to CSV
   */
  private convertToCSV(rows: any[]): string {
    if (rows.length === 0) return '';

    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            return typeof value === 'string' && value.includes(',')
              ? `"${value}"`
              : String(value);
          })
          .join(',')
      ),
    ].join('\n');

    return csvContent;
  }

  /**
   * Convert to Excel (simplified)
   */
  private convertToExcel(rows: any[]): string {
    // In production, use xlsx library
    return JSON.stringify(rows); // Placeholder
  }

  /**
   * Convert to PDF (simplified)
   */
  private convertToPDF(rows: any[], summary?: any): string {
    // In production, use pdfkit or similar
    return JSON.stringify({ rows, summary }); // Placeholder
  }

  /**
   * Schedule report delivery
   */
  async scheduleReportDelivery(tenantId: string, reportDefinitionId: string, scheduling: any): Promise<void> {
    const reportDef = await ReportDefinition.findOne({
      _id: reportDefinitionId,
      tenantId,
    });

    if (!reportDef) {
      throw new Error('Report definition not found');
    }

    reportDef.scheduling = {
      ...scheduling,
      enabled: true,
    };

    await reportDef.save();

    // In production, setup scheduler job (cron)
  }

  /**
   * List report definitions
   */
  async listReportDefinitions(tenantId: string): Promise<any[]> {
    return ReportDefinition.find({ tenantId }).sort({ createdAt: -1 });
  }

  /**
   * Get report execution history
   */
  async getReportExecutionHistory(tenantId: string, reportDefinitionId: string): Promise<any[]> {
    return ReportExecution.find({
      tenantId,
      reportDefinitionId,
    }).sort({ executedAt: -1 }).limit(50);
  }

  /**
   * Get predefined report templates
   */
  getReportTemplates(): any[] {
    return [
      {
        name: 'Asset Utilization Report',
        type: 'operational',
        description: 'Vehicle utilization metrics by day/week/month',
        template: {
          dataSource: { entity: 'bookings', fields: ['vehicleId', 'startDate', 'endDate', 'revenue'] },
          grouping: [{ field: 'vehicleId' }],
          aggregations: [
            { field: 'revenue', function: 'sum', alias: 'totalRevenue' },
            { field: '_id', function: 'count', alias: 'bookingCount' },
          ],
        },
      },
      {
        name: 'Revenue Report',
        type: 'financial',
        description: 'Revenue breakdown by customer, period, vehicle type',
        template: {
          dataSource: { entity: 'bookings', fields: ['customerId', 'revenue', 'startDate'] },
          grouping: [{ field: 'customerId' }],
          aggregations: [{ field: 'revenue', function: 'sum', alias: 'totalRevenue' }],
        },
      },
      {
        name: 'Outstanding Receivables',
        type: 'financial',
        description: 'Unpaid invoices by customer and aging bucket',
        template: {
          dataSource: { entity: 'invoices', fields: ['customerId', 'amount', 'dueDate', 'status'] },
          filters: [{ field: 'status', operator: 'eq', value: 'unpaid' }],
          grouping: [{ field: 'customerId' }],
          aggregations: [{ field: 'amount', function: 'sum', alias: 'totalOutstanding' }],
        },
      },
    ];
  }

  /**
   * Delete report definition
   */
  async deleteReportDefinition(tenantId: string, reportDefinitionId: string): Promise<void> {
    await ReportDefinition.deleteOne({
      _id: reportDefinitionId,
      tenantId,
    });

    // Clean up executions
    await ReportExecution.deleteMany({
      tenantId,
      reportDefinitionId,
    });
  }
}

export default new ReportBuilderService();
