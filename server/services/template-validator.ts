export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

const VALID_VARIABLES = [
  'bookingId',
  'pickup',
  'drop',
  'itinerary',
  'pickupDate',
  'pickupTime',
  'customerName',
  'customerPhone',
  'driverName',
  'driverPhone',
  'vehicleName',
  'vehicleNumber',
  'bookingAmount',
  'amountReceived',
  'balanceDue',
  'driverCollectAmount',
  'companyName',
  'supportPhone',
  'ownerPhone',
  'totalBookings',
  'completedBookings',
  'totalReceived',
  'outstanding',
  'driverHeld',
  'activeVehicles',
  'vehiclesOnBooking',
  'availableVehicles',
  'utilization',
];

const REQUIRED_VARIABLES_BY_MESSAGE_TYPE: Record<string, string[]> = {
  'driver_duty_assigned': ['bookingId', 'customerName', 'pickup', 'pickupTime'],
  'booking_confirmation': ['bookingId', 'pickup', 'drop'],
  'payment_received': ['bookingId', 'amountReceived'],
  'daily_summary': ['totalBookings', 'totalReceived'],
  'trip_started': ['bookingId', 'customerName'],
  'trip_completed': ['bookingId', 'driverName'],
};

export class TemplateValidator {
  /**
   * Extract variables from template body
   */
  static extractVariables(body: string): string[] {
    const regex = /{{(\w+)}}/g;
    const matches = [...body.matchAll(regex)];
    return [...new Set(matches.map((m) => m[1]))];
  }

  /**
   * Validate template for errors and warnings
   */
  static validate(body: string, messageType?: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!body || body.trim().length === 0) {
      errors.push('Message body is required');
      return { isValid: false, errors, warnings };
    }

    const extractedVariables = this.extractVariables(body);

    // Check for invalid variables
    extractedVariables.forEach((variable) => {
      if (!VALID_VARIABLES.includes(variable)) {
        errors.push(`Unknown variable: {{${variable}}}`);
      }
    });

    // Check for required variables by message type
    if (messageType && REQUIRED_VARIABLES_BY_MESSAGE_TYPE[messageType]) {
      const requiredVars = REQUIRED_VARIABLES_BY_MESSAGE_TYPE[messageType];
      requiredVars.forEach((required) => {
        if (!extractedVariables.includes(required)) {
          warnings.push(`Missing important variable: {{${required}}} (highly recommended)`);
        }
      });
    }

    // Warn if message is very short
    if (body.length < 20) {
      warnings.push('Message is very short. Consider adding more details.');
    }

    // Warn if message is excessively long
    if (body.length > 4000) {
      warnings.push('Message exceeds recommended length. Consider splitting into multiple messages.');
    }

    // Warn about SMS segments
    const smsSegments = Math.ceil(body.length / 160);
    if (smsSegments > 3) {
      warnings.push(`Message requires ${smsSegments} SMS segments. Consider reducing length.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Sanitize template for safe rendering
   */
  static renderWithSampleData(body: string, customData?: Record<string, string>): string {
    const defaultSampleData: Record<string, string> = {
      bookingId: 'BK7A92',
      customerName: 'Shyam',
      customerPhone: '98XXXXXXXX',
      driverName: 'Ravi Sharma',
      driverPhone: '98XXXXXXXX',
      vehicleName: 'Innova Crysta',
      vehicleNumber: 'MP09 XX 1234',
      pickup: 'Indore Airport',
      drop: 'Ujjain',
      itinerary: 'Indore → Ujjain → Omkareshwar',
      pickupDate: '18 Aug 2026',
      pickupTime: '08:00 AM',
      bookingAmount: '₹8,500',
      amountReceived: '₹3,000',
      balanceDue: '₹5,500',
      driverCollectAmount: '₹5,500',
      companyName: 'Shyam Travels',
      supportPhone: '98XXXXXXXX',
      ownerPhone: '98XXXXXXXX',
      totalBookings: '12',
      completedBookings: '8',
      totalReceived: '₹92,000',
      outstanding: '₹33,000',
      driverHeld: '₹25,000',
      activeVehicles: '30',
      vehiclesOnBooking: '18',
      availableVehicles: '8',
      utilization: '60%',
    };

    const sampleData = { ...defaultSampleData, ...customData };
    let rendered = body;

    Object.entries(sampleData).forEach(([key, value]) => {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    return rendered;
  }

  /**
   * Check for safety rendering - missing variables
   */
  static checkSafetyIssues(body: string): string[] {
    const issues: string[] = [];
    const extractedVariables = this.extractVariables(body);

    // Variables that should never be null/undefined
    const criticalVariables = ['bookingId', 'customerName', 'driverName', 'companyName'];

    const criticalMissing = criticalVariables.filter((v) => !extractedVariables.includes(v));
    if (criticalMissing.length > 0) {
      issues.push(`Missing critical variables: ${criticalMissing.map((v) => `{{${v}}}`).join(', ')}`);
    }

    return issues;
  }
}

export default TemplateValidator;
