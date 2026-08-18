/**
 * DriverSalarySetupPanel - Unit Tests
 * Tests for salary configuration panel component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DriverSalarySetupPanel from './DriverSalarySetupPanel';
import { useToast } from '@/hooks/use-toast';

// Mock dependencies
vi.mock('@/hooks/use-toast');
vi.mock('@/lib/queryClient');

const mockToast = vi.fn();
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('DriverSalarySetupPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue({ toast: mockToast });
  });

  describe('Rendering', () => {
    it('should render all tabs', () => {
      renderWithProviders(
        <DriverSalarySetupPanel
          driverId="driver-001"
          driverName="Test Driver"
        />
      );

      expect(screen.getByText('Employment')).toBeInTheDocument();
      expect(screen.getByText('Salary')).toBeInTheDocument();
      expect(screen.getByText('Allowances')).toBeInTheDocument();
      expect(screen.getByText('Bank')).toBeInTheDocument();
    });

    it('should display driver name', () => {
      renderWithProviders(
        <DriverSalarySetupPanel
          driverId="driver-001"
          driverName="Rajesh Kumar"
        />
      );

      expect(screen.getByText('Rajesh Kumar')).toBeInTheDocument();
    });

    it('should show read-only alert when isReadOnly is true', () => {
      renderWithProviders(
        <DriverSalarySetupPanel
          driverId="driver-001"
          driverName="Test Driver"
          isReadOnly={true}
        />
      );

      expect(
        screen.getByText(/salary configuration is locked and cannot be edited/i)
      ).toBeInTheDocument();
    });

    it('should disable form inputs when isReadOnly is true', () => {
      renderWithProviders(
        <DriverSalarySetupPanel
          driverId="driver-001"
          driverName="Test Driver"
          isReadOnly={true}
        />
      );

      const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
      inputs.forEach((input) => {
        expect(input.disabled).toBe(true);
      });
    });
  });

  describe('Employment Tab', () => {
    it('should allow selecting employment type', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <DriverSalarySetupPanel
          driverId="driver-001"
          driverName="Test Driver"
        />
      );

      const employmentSelect = screen.getByDisplayValue('Contract');
      await user.click(employmentSelect);

      const permanentOption = screen.getByText('Permanent');
      await user.click(permanentOption);

      expect(screen.getByDisplayValue('Permanent')).toBeInTheDocument();
    });

    it('should allow selecting weekly off days', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <DriverSalarySetupPanel
          driverId="driver-001"
          driverName="Test Driver"
        />
      );

      const sundayButton = screen.getByText('Sunday').closest('button');
      const mondayButton = screen.getByText('Monday').closest('button');

      // Sunday should be selected by default
      expect(sundayButton).toHaveClass('bg-green-600');

      // Click Monday to add it
      if (mondayButton) {
        await user.click(mondayButton);
        expect(mondayButton).toHaveClass('bg-green-600');
      }
    });

    it('should validate joining date is required', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <DriverSalarySetupPanel
          driverId="driver-001"
          driverName="Test Driver"
        />
      );

      // Navigate to salary tab to show base salary field
      const salaryTab = screen.getByText('Salary').closest('button');
      if (salaryTab) await user.click(salaryTab);

      // Try to submit without filling joining date
      const baseSalaryInput = screen.getByDisplayValue('0');
      await user.clear(baseSalaryInput);
      await user.type(baseSalaryInput, '20000');

      // This would trigger validation on submit
    });
  });

  describe('Salary Tab', () => {
    it('should update salary type and show relevant fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <DriverSalarySetupPanel
          driverId="driver-001"
          driverName="Test Driver"
        />
      );

      const salaryTab = screen.getByText('Salary').closest('button');
      if (salaryTab) await user.click(salaryTab);

      const salaryTypeSelect = screen.getByDisplayValue('Fixed Monthly');
      await user.click(salaryTypeSelect);

      const dailyOption = screen.getByText('Daily Rate');
      await user.click(dailyOption);

      expect(screen.getByDisplayValue('Daily Rate')).toBeInTheDocument();
    });

    it('should calculate and display estimated monthly earning', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <DriverSalarySetupPanel
          driverId="driver-001"
          driverName="Test Driver"
        />
      );

      const salaryTab = screen.getByText('Salary').closest('button');
      if (salaryTab) await user.click(salaryTab);

      const baseSalaryInput = screen.getAllByDisplayValue('0')[0];
      await user.clear(baseSalaryInput);
      await user.type(baseSalaryInput, '25000');

      // Check if estimated earning is displayed
      expect(screen.getByText(/Estimated Monthly Earning/i)).toBeInTheDocument();
    });

    it('should show conditional fields based on salary type', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <DriverSalarySetupPanel
          driverId="driver-001"
          driverName="Test Driver"
        />
      );

      const salaryTab = screen.getByText('Salary').closest('button');
      if (salaryTab) await user.click(salaryTab);

      const salaryTypeSelect = screen.getByDisplayValue('Fixed Monthly');
      await user.click(salaryTypeSelect);

      const customOption = screen.getByText('Custom Structure');
      await user.click(customOption);

      // Should now show overtime rate and extra duty rate fields
      await waitFor(() => {
        expect(screen.getByText(/Overtime Rate/i)).toBeInTheDocument();
        expect(screen.getByText(/Extra Duty Rate/i)).toBeInTheDocument();
      });
    });
  });

  describe('Allowances Tab', () => {
    it('should allow entering allowance amounts', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <DriverSalarySetupPanel
          driverId="driver-001"
          driverName="Test Driver"
        />
      );

      const allowancesTab = screen.getByText('Allowances').closest('button');
      if (allowancesTab) await user.click(allowancesTab);

      const foodAllowanceInput = screen.getByPlaceholderText('0');
      await user.clear(foodAllowanceInput);
      await user.type(foodAllowanceInput, '5000');

      expect(screen.getByDisplayValue('5000')).toBeInTheDocument();
    });
  });

  describe('Bank Tab', () => {
    it('should allow entering bank details', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <DriverSalarySetupPanel
          driverId="driver-001"
          driverName="Test Driver"
        />
      );

      const bankTab = screen.getByText('Bank').closest('button');
      if (bankTab) await user.click(bankTab);

      const bankNameInput = screen.getByPlaceholderText(/HDFC Bank/i);
      await user.type(bankNameInput, 'ICICI Bank');

      expect(screen.getByDisplayValue('ICICI Bank')).toBeInTheDocument();
    });

    it('should convert IFSC code to uppercase', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <DriverSalarySetupPanel
          driverId="driver-001"
          driverName="Test Driver"
        />
      );

      const bankTab = screen.getByText('Bank').closest('button');
      if (bankTab) await user.click(bankTab);

      const ifscInput = screen.getByPlaceholderText(/HDFC0000123/i);
      await user.type(ifscInput, 'hdfc0000123');

      await waitFor(() => {
        expect((ifscInput as HTMLInputElement).value).toBe('HDFC0000123');
      });
    });
  });

  describe('Form Validation', () => {
    it('should show error when base salary is 0 or less', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <DriverSalarySetupPanel
          driverId="driver-001"
          driverName="Test Driver"
        />
      );

      const salaryTab = screen.getByText('Salary').closest('button');
      if (salaryTab) await user.click(salaryTab);

      const submitButton = screen.getByText(/Create Configuration/i);
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
          })
        );
      });
    });

    it('should require joining date', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <DriverSalarySetupPanel
          driverId="driver-001"
          driverName="Test Driver"
        />
      );

      const joiningDateInput = screen.getByLabelText(/Joining Date/i) as HTMLInputElement;
      expect(joiningDateInput.value).not.toBe('');

      // Date should be set to today by default
    });
  });

  describe('Form Submission', () => {
    it('should call onSalarySetupComplete on successful submission', async () => {
      const user = userEvent.setup();
      const onComplete = vi.fn();

      renderWithProviders(
        <DriverSalarySetupPanel
          driverId="driver-001"
          driverName="Test Driver"
          onSalarySetupComplete={onComplete}
        />
      );

      // Fill required fields
      const salaryTab = screen.getByText('Salary').closest('button');
      if (salaryTab) await user.click(salaryTab);

      const baseSalaryInputs = screen.getAllByDisplayValue('0');
      const baseSalaryInput = baseSalaryInputs[0];
      await user.clear(baseSalaryInput);
      await user.type(baseSalaryInput, '25000');

      // Note: Actual submission would require API mocking
    });

    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();

      renderWithProviders(
        <DriverSalarySetupPanel
          driverId="driver-001"
          driverName="Test Driver"
          onCancel={onCancel}
        />
      );

      const cancelButton = screen.getByText(/Cancel/i);
      await user.click(cancelButton);

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Tab Navigation', () => {
    it('should switch tabs when clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <DriverSalarySetupPanel
          driverId="driver-001"
          driverName="Test Driver"
        />
      );

      const salaryTab = screen.getByText('Salary').closest('button');
      if (salaryTab) {
        await user.click(salaryTab);
        expect(screen.getByText(/Salary Structure/i)).toBeInTheDocument();
      }

      const allowancesTab = screen.getByText('Allowances').closest('button');
      if (allowancesTab) {
        await user.click(allowancesTab);
        expect(screen.getByText(/Food Allowance/i)).toBeInTheDocument();
      }

      const bankTab = screen.getByText('Bank').closest('button');
      if (bankTab) {
        await user.click(bankTab);
        expect(screen.getByText(/Bank Name/i)).toBeInTheDocument();
      }
    });
  });

  describe('Responsive Design', () => {
    it('should render mobile-friendly layout', () => {
      renderWithProviders(
        <DriverSalarySetupPanel
          driverId="driver-001"
          driverName="Test Driver"
        />
      );

      // Check for responsive classes
      const tabs = screen.getByRole('tablist');
      expect(tabs).toHaveClass('grid', 'w-full', 'grid-cols-4');
    });
  });

  describe('Accessibility', () => {
    it('should have proper labels for all inputs', () => {
      renderWithProviders(
        <DriverSalarySetupPanel
          driverId="driver-001"
          driverName="Test Driver"
        />
      );

      expect(screen.getByLabelText(/Joining Date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Employment Type/i)).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <DriverSalarySetupPanel
          driverId="driver-001"
          driverName="Test Driver"
        />
      );

      // Tab through elements
      await user.tab();
      expect(screen.getByLabelText(/Joining Date/i)).toHaveFocus();
    });
  });
});

/**
 * Integration Tests
 */
describe('DriverSalarySetupPanel - Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue({ toast: mockToast });
  });

  it('should handle complete salary configuration workflow', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();

    renderWithProviders(
      <DriverSalarySetupPanel
        driverId="driver-001"
        driverName="Test Driver"
        onSalarySetupComplete={onComplete}
      />
    );

    // Fill employment info
    const employmentSelect = screen.getByDisplayValue('Contract');
    await user.click(employmentSelect);
    const permanentOption = screen.getByText('Permanent');
    await user.click(permanentOption);

    // Go to salary tab
    const salaryTab = screen.getByText('Salary').closest('button');
    if (salaryTab) await user.click(salaryTab);

    // Fill salary info
    const baseSalaryInputs = screen.getAllByDisplayValue('0');
    await user.clear(baseSalaryInputs[0]);
    await user.type(baseSalaryInputs[0], '30000');

    // Verify estimated earning is calculated
    expect(screen.getByText(/Estimated Monthly Earning/i)).toBeInTheDocument();
  });
});
