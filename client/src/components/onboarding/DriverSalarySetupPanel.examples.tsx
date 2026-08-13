/**
 * DriverSalarySetupPanel - Usage Examples
 * Demonstrates various ways to use the DriverSalarySetupPanel component
 */

import { useState } from 'react';
import DriverSalarySetupPanel from './DriverSalarySetupPanel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/**
 * Example 1: Basic Usage
 * Simple integration in a page
 */
export function BasicExample() {
  const { toast } = useToast();

  return (
    <div className="max-w-2xl mx-auto p-4">
      <DriverSalarySetupPanel
        driverId="driver-001"
        driverName="Rajesh Kumar"
        onSalarySetupComplete={() => {
          toast({
            title: 'Success',
            description: 'Salary configuration saved successfully',
          });
        }}
        onCancel={() => {
          toast({
            title: 'Cancelled',
            description: 'Salary setup cancelled',
            variant: 'destructive',
          });
        }}
      />
    </div>
  );
}

/**
 * Example 2: Modal/Dialog Integration
 * Show component inside a dialog
 */
export function ModalExample() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  return (
    <div className="max-w-2xl mx-auto p-4">
      <Button onClick={() => setOpen(true)} className="mb-4">
        Configure Salary
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configure Driver Salary</DialogTitle>
            <DialogDescription>
              Set up salary structure, allowances, and payment details
            </DialogDescription>
          </DialogHeader>

          <DriverSalarySetupPanel
            driverId="driver-001"
            driverName="Rajesh Kumar"
            onSalarySetupComplete={() => {
              toast({
                title: 'Success',
                description: 'Salary configuration saved',
              });
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Example 3: Onboarding Workflow
 * Multi-step onboarding with salary setup as one step
 */
export function OnboardingWorkflowExample() {
  const [step, setStep] = useState<'personal' | 'salary' | 'documents' | 'complete'>(
    'personal'
  );
  const { toast } = useToast();

  const handleSalaryComplete = () => {
    toast({ title: 'Salary Configuration Complete' });
    setStep('documents');
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div
            className={`flex flex-col items-center ${
              ['personal', 'salary', 'documents', 'complete'].includes(step)
                ? 'text-green-600'
                : 'text-gray-400'
            }`}
          >
            <div className="text-2xl mb-2">1</div>
            <span className="text-sm">Personal Info</span>
          </div>
          <div className="flex-1 h-1 mx-2 bg-gray-200" />
          <div
            className={`flex flex-col items-center ${
              ['salary', 'documents', 'complete'].includes(step)
                ? 'text-green-600'
                : 'text-gray-400'
            }`}
          >
            <div className="text-2xl mb-2">2</div>
            <span className="text-sm">Salary Setup</span>
          </div>
          <div className="flex-1 h-1 mx-2 bg-gray-200" />
          <div
            className={`flex flex-col items-center ${
              ['documents', 'complete'].includes(step)
                ? 'text-green-600'
                : 'text-gray-400'
            }`}
          >
            <div className="text-2xl mb-2">3</div>
            <span className="text-sm">Documents</span>
          </div>
        </div>
      </div>

      {/* Step Content */}
      <Card>
        {step === 'personal' && (
          <CardContent className="pt-6">
            <div className="space-y-4">
              <h3 className="font-semibold">Step 1: Personal Information</h3>
              <p className="text-gray-600 text-sm">
                Enter driver personal details here...
              </p>
              <Button onClick={() => setStep('salary')}>Continue to Salary Setup</Button>
            </div>
          </CardContent>
        )}

        {step === 'salary' && (
          <CardContent className="pt-6">
            <DriverSalarySetupPanel
              driverId="driver-001"
              driverName="Rajesh Kumar"
              onSalarySetupComplete={handleSalaryComplete}
              onCancel={() => setStep('personal')}
            />
          </CardContent>
        )}

        {step === 'documents' && (
          <CardContent className="pt-6">
            <div className="space-y-4">
              <h3 className="font-semibold">Step 3: Documents</h3>
              <p className="text-gray-600 text-sm">
                Upload driver documents here...
              </p>
              <Button onClick={() => setStep('complete')}>Complete Onboarding</Button>
            </div>
          </CardContent>
        )}

        {step === 'complete' && (
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-green-600">
              <CheckCircle2 size={24} />
              <span className="text-lg font-semibold">Onboarding Complete!</span>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

/**
 * Example 4: Read-only Configuration Display
 * Display salary configuration without allowing edits
 */
export function ReadOnlyExample() {
  return (
    <div className="max-w-2xl mx-auto p-4">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Driver Salary Configuration (Locked)</CardTitle>
        </CardHeader>
      </Card>

      <DriverSalarySetupPanel
        driverId="driver-001"
        driverName="Rajesh Kumar"
        isReadOnly={true}
      />
    </div>
  );
}

/**
 * Example 5: Salary Configuration with Confirmation
 * Show confirmation after setup
 */
export function ConfirmationExample() {
  const [configured, setConfigured] = useState(false);
  const { toast } = useToast();

  const handleComplete = () => {
    setConfigured(true);
    toast({
      title: 'Salary Setup Complete',
      description: 'Driver salary configuration has been saved successfully',
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {configured ? (
              <>
                <CheckCircle2 className="text-green-600" />
                <span>Salary Configuration Complete</span>
              </>
            ) : (
              <>
                <XCircle className="text-gray-400" />
                <span>Pending Salary Configuration</span>
              </>
            )}
          </CardTitle>
        </CardHeader>
      </Card>

      {!configured && (
        <DriverSalarySetupPanel
          driverId="driver-001"
          driverName="Rajesh Kumar"
          onSalarySetupComplete={handleComplete}
        />
      )}

      {configured && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p>
                  <span className="font-semibold">Driver:</span> Rajesh Kumar
                </p>
                <p>
                  <span className="font-semibold">Status:</span>{' '}
                  <span className="text-green-600">Configured</span>
                </p>
                <p>
                  <span className="font-semibold">Configuration:</span> Complete
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button
              onClick={() => setConfigured(false)}
              variant="outline"
              className="flex-1"
            >
              Edit Configuration
            </Button>
            <Button className="flex-1 bg-green-600 hover:bg-green-700">
              Proceed to Next Step
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Example 6: Bulk Driver Onboarding
 * Set up multiple drivers' salaries in sequence
 */
export function BulkOnboardingExample() {
  const [drivers] = useState([
    { id: 'driver-001', name: 'Rajesh Kumar' },
    { id: 'driver-002', name: 'Amit Singh' },
    { id: 'driver-003', name: 'Priya Sharma' },
  ]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState<string[]>([]);
  const { toast } = useToast();

  const currentDriver = drivers[currentIndex];
  const isComplete = completed.length === drivers.length;

  const handleComplete = () => {
    setCompleted([...completed, currentDriver.id]);
    if (currentIndex < drivers.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
    toast({
      title: 'Driver configured',
      description: `${currentDriver.name} salary setup complete`,
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>
            Bulk Driver Salary Configuration ({completed.length}/{drivers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {drivers.map((driver) => (
              <div key={driver.id} className="flex items-center gap-2">
                {completed.includes(driver.id) ? (
                  <CheckCircle2 className="text-green-600" size={20} />
                ) : driver.id === currentDriver.id ? (
                  <div className="w-5 h-5 rounded-full border-2 border-blue-600 animate-pulse" />
                ) : (
                  <XCircle className="text-gray-400" size={20} />
                )}
                <span>{driver.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {!isComplete && (
        <DriverSalarySetupPanel
          driverId={currentDriver.id}
          driverName={currentDriver.name}
          onSalarySetupComplete={handleComplete}
        />
      )}

      {isComplete && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <CheckCircle2 size={48} className="mx-auto text-green-600" />
              <h3 className="text-lg font-semibold">All Drivers Configured</h3>
              <p className="text-gray-600">
                Salary configuration complete for all {drivers.length} drivers
              </p>
              <Button className="mt-4 bg-green-600 hover:bg-green-700">
                View All Configurations
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Example 7: Salary Templates
 * Quick setup using predefined templates
 */
export function SalaryTemplatesExample() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const templates = [
    {
      id: 'permanent-fixed',
      name: 'Permanent - Fixed Monthly',
      description: 'For permanent employees with fixed monthly salary',
    },
    {
      id: 'contract-daily',
      name: 'Contract - Daily Rate',
      description: 'For contract workers paid on daily basis',
    },
    {
      id: 'flexible-incentive',
      name: 'Flexible - Fixed + Incentive',
      description: 'For workers with base salary plus performance incentives',
    },
  ];

  return (
    <div className="max-w-2xl mx-auto p-4">
      {!selectedTemplate ? (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Select Salary Template</h2>
          <div className="grid gap-4">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="cursor-pointer hover:border-blue-500 transition-colors"
                onClick={() => setSelectedTemplate(template.id)}
              >
                <CardHeader>
                  <CardTitle>{template.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{template.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
            Back to Templates
          </Button>

          <DriverSalarySetupPanel
            driverId="driver-001"
            driverName="Rajesh Kumar"
            onSalarySetupComplete={() => {
              setSelectedTemplate(null);
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Export all examples
 */
export const Examples = {
  BasicExample,
  ModalExample,
  OnboardingWorkflowExample,
  ReadOnlyExample,
  ConfirmationExample,
  BulkOnboardingExample,
  SalaryTemplatesExample,
};
