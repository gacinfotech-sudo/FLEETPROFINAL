// ============================================================================
// FLEET COMPLIANCE UI - COMPONENT TESTS
// Phase 3: UI Components
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ComplianceStatusCard from '../compliance-status-card';
import CriticalAlertPopup from '../critical-alert-popup';
import DocumentUploadModal from '../document-upload-modal';
import { VehicleReadiness, DocumentStatus } from '../../../types/fleet-compliance.types';

// Setup
const queryClient = new QueryClient();

const renderWithQuery = (component: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

// ============================================================================
// COMPLIANCE STATUS CARD TESTS
// ============================================================================

describe('ComplianceStatusCard', () => {
  it('should display vehicle license plate and status', () => {
    render(
      <ComplianceStatusCard
        licensePlate="MP09AB1234"
        overallStatus={VehicleReadiness.ROAD_READY}
        compliancePercentage={100}
        documents={[]}
        criticalCount={0}
        onViewDetails={() => {}}
      />
    );

    expect(screen.getByText('MP09AB1234')).toBeInTheDocument();
    expect(screen.getByText('Road Ready')).toBeInTheDocument();
  });

  it('should show road ready status with green color', () => {
    const { container } = render(
      <ComplianceStatusCard
        licensePlate="MP09AB1234"
        overallStatus={VehicleReadiness.ROAD_READY}
        compliancePercentage={100}
        documents={[]}
        criticalCount={0}
        onViewDetails={() => {}}
      />
    );

    const card = container.querySelector('[class*="bg-green"]');
    expect(card).toBeInTheDocument();
  });

  it('should show attention required status with yellow color', () => {
    const { container } = render(
      <ComplianceStatusCard
        licensePlate="MP09AB1234"
        overallStatus={VehicleReadiness.ATTENTION_REQUIRED}
        compliancePercentage={75}
        documents={[]}
        criticalCount={0}
        onViewDetails={() => {}}
      />
    );

    const card = container.querySelector('[class*="bg-yellow"]');
    expect(card).toBeInTheDocument();
  });

  it('should show not road ready status with red color', () => {
    const { container } = render(
      <ComplianceStatusCard
        licensePlate="MP09AB1234"
        overallStatus={VehicleReadiness.NOT_ROAD_READY}
        compliancePercentage={50}
        documents={[]}
        criticalCount={0}
        onViewDetails={() => {}}
      />
    );

    const card = container.querySelector('[class*="bg-red"]');
    expect(card).toBeInTheDocument();
  });

  it('should display compliance percentage', () => {
    render(
      <ComplianceStatusCard
        licensePlate="MP09AB1234"
        overallStatus={VehicleReadiness.ROAD_READY}
        compliancePercentage={85}
        documents={[]}
        criticalCount={0}
        onViewDetails={() => {}}
      />
    );

    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('should display document summary counts', () => {
    render(
      <ComplianceStatusCard
        licensePlate="MP09AB1234"
        overallStatus={VehicleReadiness.ATTENTION_REQUIRED}
        compliancePercentage={75}
        documents={[
          { documentType: 'RC', status: DocumentStatus.VALID, daysRemaining: 100 },
          { documentType: 'Insurance', status: DocumentStatus.EXPIRING_SOON, daysRemaining: 15 },
        ]}
        criticalCount={1}
        onViewDetails={() => {}}
      />
    );

    expect(screen.getByText('1')).toBeInTheDocument(); // valid
    expect(screen.getByText('1')).toBeInTheDocument(); // expiring
  });

  it('should show critical alert badge', () => {
    render(
      <ComplianceStatusCard
        licensePlate="MP09AB1234"
        overallStatus={VehicleReadiness.ATTENTION_REQUIRED}
        compliancePercentage={75}
        documents={[]}
        criticalCount={3}
        onViewDetails={() => {}}
      />
    );

    expect(screen.getByText('3')).toBeInTheDocument(); // critical count badge
  });

  it('should call onViewDetails when clicked', () => {
    const mockOnViewDetails = vi.fn();
    render(
      <ComplianceStatusCard
        licensePlate="MP09AB1234"
        overallStatus={VehicleReadiness.ROAD_READY}
        compliancePercentage={100}
        documents={[]}
        criticalCount={0}
        onViewDetails={mockOnViewDetails}
      />
    );

    const card = screen.getByText('MP09AB1234').closest('[class*="cursor-pointer"]');
    if (card) fireEvent.click(card);

    expect(mockOnViewDetails).toHaveBeenCalled();
  });
});

// ============================================================================
// CRITICAL ALERT POPUP TESTS
// ============================================================================

describe('CriticalAlertPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display critical alert title', async () => {
    renderWithQuery(
      <CriticalAlertPopup onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText(/VEHICLE COMPLIANCE ALERT/i)).toBeInTheDocument();
    });
  });

  it('should require acknowledgment before dismissal', async () => {
    renderWithQuery(
      <CriticalAlertPopup onClose={() => {}} />
    );

    await waitFor(() => {
      const closeButton = screen.getByText(/Close|Next Alert/i);
      expect(closeButton).toBeDisabled();
    });
  });

  it('should enable close after acknowledgment', async () => {
    renderWithQuery(
      <CriticalAlertPopup onClose={() => {}} />
    );

    await waitFor(() => {
      const checkbox = screen.getByLabelText(/I acknowledge/i) as HTMLInputElement;
      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
    });

    await waitFor(() => {
      const closeButton = screen.getByText(/Close|Next Alert/i);
      expect(closeButton).not.toBeDisabled();
    });
  });

  it('should have action buttons for upload and view', async () => {
    renderWithQuery(
      <CriticalAlertPopup onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText(/Upload\/Renew Document/i)).toBeInTheDocument();
      expect(screen.getByText(/Mark Renewal In Progress/i)).toBeInTheDocument();
      expect(screen.getByText(/View Vehicle Details/i)).toBeInTheDocument();
    });
  });

  it('should display expiry information', async () => {
    renderWithQuery(
      <CriticalAlertPopup onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText(/Expires in|EXPIRED|EXPIRES TODAY/i)).toBeInTheDocument();
    });
  });

  it('should show non-dismissible message', async () => {
    renderWithQuery(
      <CriticalAlertPopup onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText(/cannot be dismissed without taking action/i)).toBeInTheDocument();
    });
  });
});

// ============================================================================
// DOCUMENT UPLOAD MODAL TESTS
// ============================================================================

describe('DocumentUploadModal', () => {
  const mockOnSuccess = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display modal title with document type and vehicle', () => {
    render(
      <DocumentUploadModal
        vehicleId="vehicle-1"
        licensePlate="MP09AB1234"
        documentType="RC"
        onSuccess={mockOnSuccess}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/Upload RC/i)).toBeInTheDocument();
    expect(screen.getByText('MP09AB1234')).toBeInTheDocument();
  });

  it('should have all required form fields', () => {
    render(
      <DocumentUploadModal
        vehicleId="vehicle-1"
        licensePlate="MP09AB1234"
        documentType="RC"
        onSuccess={mockOnSuccess}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByLabelText(/Document Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Issue Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Valid From/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Expiry Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Issuing Authority/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Document File/i)).toBeInTheDocument();
  });

  it('should require all mandatory fields', async () => {
    render(
      <DocumentUploadModal
        vehicleId="vehicle-1"
        licensePlate="MP09AB1234"
        documentType="RC"
        onSuccess={mockOnSuccess}
        onClose={mockOnClose}
      />
    );

    const submitButton = screen.getByText('✓ Upload');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Document number is required/i)).toBeInTheDocument();
    });
  });

  it('should validate date order', async () => {
    render(
      <DocumentUploadModal
        vehicleId="vehicle-1"
        licensePlate="MP09AB1234"
        documentType="RC"
        onSuccess={mockOnSuccess}
        onClose={mockOnClose}
      />
    );

    const issueDate = screen.getByLabelText(/Issue Date/i);
    const validFrom = screen.getByLabelText(/Valid From/i);

    fireEvent.change(issueDate, { target: { value: '2026-12-31' } });
    fireEvent.change(validFrom, { target: { value: '2026-01-01' } });

    const submitButton = screen.getByText('✓ Upload');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Issue date must be before valid from date/i)).toBeInTheDocument();
    });
  });

  it('should close modal when cancel is clicked', () => {
    render(
      <DocumentUploadModal
        vehicleId="vehicle-1"
        licensePlate="MP09AB1234"
        documentType="RC"
        onSuccess={mockOnSuccess}
        onClose={mockOnClose}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should close modal when backdrop is clicked', () => {
    const { container } = render(
      <DocumentUploadModal
        vehicleId="vehicle-1"
        licensePlate="MP09AB1234"
        documentType="RC"
        onSuccess={mockOnSuccess}
        onClose={mockOnClose}
      />
    );

    const backdrop = container.querySelector('[class*="bg-black"][class*="bg-opacity"]');
    if (backdrop) fireEvent.click(backdrop);

    expect(mockOnClose).toHaveBeenCalled();
  });
});

// ============================================================================
// EXPORT TEST COUNT
// ============================================================================

// Total UI test cases: 15+ ✓
