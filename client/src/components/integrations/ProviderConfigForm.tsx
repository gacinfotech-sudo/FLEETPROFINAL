import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { PROVIDER_CONFIGS, type ProviderType } from '@/types/integrations';

interface ProviderConfigFormProps {
  provider: ProviderType;
  onSuccess?: () => void;
  onClose?: () => void;
}

export default function ProviderConfigForm({
  provider,
  onSuccess,
  onClose,
}: ProviderConfigFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    passed: boolean;
    message: string;
  } | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const config = PROVIDER_CONFIGS[provider as ProviderType];

  if (!config) {
    return (
      <Card className="w-full bg-red-50 border-red-200">
        <CardContent className="pt-6">
          <p className="text-red-700">Provider configuration not found</p>
        </CardContent>
      </Card>
    );
  }

  const handleInputChange = (fieldName: string, value: string) => {
    setCredentials(prev => ({
      ...prev,
      [fieldName]: value,
    }));
    // Clear error for this field
    if (errors[fieldName]) {
      setErrors(prev => ({
        ...prev,
        [fieldName]: '',
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    config.fields.forEach(field => {
      if (field.required && !credentials[field.name]) {
        newErrors[field.name] = `${field.label} is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleTestConnection = async () => {
    if (!validateForm()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await apiRequest('POST', `/api/integrations/${provider}/test`, {
        credentials,
      });

      if (response.result.testPassed) {
        setTestResult({
          passed: true,
          message: 'Connection test passed successfully!',
        });
        toast({
          title: 'Success',
          description: 'Provider connection verified',
        });
      } else {
        setTestResult({
          passed: false,
          message: response.result.errorMessage || 'Connection test failed',
        });
        toast({
          title: 'Connection Failed',
          description: response.result.errorMessage || 'Unable to connect to provider',
          variant: 'destructive',
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Test connection failed';
      setTestResult({
        passed: false,
        message,
      });
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfiguration = async () => {
    if (!validateForm()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      await apiRequest('POST', `/api/integrations/${provider}/configure`, {
        credentials,
      });

      toast({
        title: 'Success',
        description: `${config.name} configuration saved successfully`,
      });

      setCredentials({});
      setTestResult(null);
      onSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save configuration';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">⚙️</span>
          Configure {config.name}
        </CardTitle>
        <p className="text-sm text-gray-600 mt-2">{config.description}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Configuration Fields */}
        <div className="space-y-4">
          {config.fields.map(field => (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={field.name} className="flex items-center gap-1">
                {field.label}
                {field.required && <span className="text-red-500">*</span>}
              </Label>

              {field.type === 'select' ? (
                <Select
                  value={credentials[field.name] || ''}
                  onValueChange={value => handleInputChange(field.name, value)}
                >
                  <SelectTrigger id={field.name} className={errors[field.name] ? 'border-red-500' : ''}>
                    <SelectValue placeholder={field.placeholder || 'Select an option'} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={field.name}
                  type={field.type}
                  placeholder={field.placeholder}
                  value={credentials[field.name] || ''}
                  onChange={e => handleInputChange(field.name, e.target.value)}
                  className={errors[field.name] ? 'border-red-500' : ''}
                />
              )}

              {errors[field.name] && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle size={14} />
                  {errors[field.name]}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={`p-4 rounded-lg flex items-start gap-3 ${
            testResult.passed
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            {testResult.passed ? (
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className={testResult.passed ? 'text-green-800 font-medium' : 'text-red-800 font-medium'}>
                {testResult.passed ? 'Connection Successful' : 'Connection Failed'}
              </p>
              <p className={`text-sm mt-1 ${testResult.passed ? 'text-green-700' : 'text-red-700'}`}>
                {testResult.message}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end pt-4 border-t">
          {onClose && (
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading || isTesting}
            >
              Close
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={handleTestConnection}
            disabled={isLoading || isTesting}
            className="flex items-center gap-2"
          >
            {isTesting && <Loader2 size={16} className="animate-spin" />}
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>
          <Button
            type="button"
            onClick={handleSaveConfiguration}
            disabled={isLoading || isTesting}
            className="flex items-center gap-2"
          >
            {isLoading && <Loader2 size={16} className="animate-spin" />}
            {isLoading ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
