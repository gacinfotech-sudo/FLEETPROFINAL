import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit2, Plus, Save, Eye, AlertCircle, CheckCircle, Copy, RotateCcw, History } from 'lucide-react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface Template {
  _id: string;
  tenantId: string;
  category: string;
  messageType: string;
  name: string;
  language: string;
  body: string;
  status: 'draft' | 'active' | 'inactive' | 'archived';
  requiredVariables: string[];
  extractedVariables: string[];
  isCustom: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

const TEMPLATE_CATEGORIES = [
  {
    name: 'Customer',
    value: 'customer',
    types: ['booking_confirmation', 'driver_assigned', 'vehicle_assigned', 'driver_changed', 'payment_received', 'payment_reminder', 'trip_started', 'trip_completed', 'feedback', 'cancellation', 'reschedule'],
  },
  {
    name: 'Driver',
    value: 'driver',
    types: ['duty_assigned', 'duty_updated', 'reassignment', 'vehicle_changed', 'collection_reminder', 'trip_reminder', 'trip_completion'],
  },
  {
    name: 'Owner / Operations',
    value: 'owner',
    types: ['booking_alert', 'booking_modification', 'payment_alert', 'collection_alert', 'critical_issue', 'daily_summary'],
  },
  {
    name: 'Finance',
    value: 'finance',
    types: ['payment_received', 'outstanding', 'driver_cash_pending', 'collection_summary'],
  },
];

const VARIABLE_GROUPS = {
  BOOKING: ['{{bookingId}}', '{{pickup}}', '{{drop}}', '{{itinerary}}', '{{pickupDate}}', '{{pickupTime}}'],
  CUSTOMER: ['{{customerName}}', '{{customerPhone}}'],
  DRIVER: ['{{driverName}}', '{{driverPhone}}'],
  VEHICLE: ['{{vehicleName}}', '{{vehicleNumber}}'],
  PAYMENT: ['{{bookingAmount}}', '{{amountReceived}}', '{{balanceDue}}', '{{driverCollectAmount}}'],
  COMPANY: ['{{companyName}}', '{{supportPhone}}', '{{ownerPhone}}'],
};

const REQUIRED_VARIABLES = {
  driver_duty_assigned: ['{{bookingId}}', '{{customerName}}', '{{pickup}}', '{{pickupTime}}'],
  booking_confirmation: ['{{bookingId}}', '{{pickup}}', '{{drop}}'],
  payment_received: ['{{bookingId}}', '{{amountReceived}}'],
  daily_summary: ['{{totalBookings}}', '{{totalReceived}}'],
};

export default function WhatsAppTemplateEditor() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('customer');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [changesSummary, setChangesSummary] = useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const [formData, setFormData] = useState<Partial<Template>>({
    category: 'customer',
    language: 'en',
    status: 'draft',
    extractedVariables: [],
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const { data: templatesData } = useQuery({
    queryKey: ['tenant-whatsapp-templates-full'],
    queryFn: async () => {
      const response = await fetch('/api/tenant/whatsapp-templates/full');
      if (!response.ok) throw new Error('Failed to fetch');
      return (await response.json()).templates || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Template>) => {
      const url = data._id ? `/api/tenant/whatsapp-templates/${data._id}` : '/api/tenant/whatsapp-templates';
      const method = data._id ? 'PUT' : 'POST';
      const payload = {
        ...data,
        changesSummary: changesSummary || 'Template updated',
      };
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to save');
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-whatsapp-templates-full'] });
      toast({ title: 'Success', description: 'Template saved' });
      // Create version after save
      if (result.template?._id && formData._id) {
        createVersion(result.template._id);
      }
      resetForm();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save template', variant: 'destructive' });
    },
  });

  const createVersion = async (templateId: string) => {
    try {
      await fetch(`/api/tenant/whatsapp-templates/${templateId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changesSummary: changesSummary || 'Template updated',
        }),
      });
    } catch (error) {
      console.error('Error creating version:', error);
    }
  };

  const submitForApproval = async (templateId: string, versionNumber: number) => {
    try {
      const response = await fetch(`/api/tenant/whatsapp-templates/${templateId}/submit-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionNumber }),
      });
      if (!response.ok) throw new Error('Failed to submit');
      const result = await response.json();
      if (result.status === 'pending') {
        toast({ title: 'Pending Approval', description: 'Template submitted for review' });
      } else if (result.status === 'auto-approved' || result.status === 'approved') {
        toast({ title: 'Auto-Approved', description: 'Template auto-approved and activated' });
      }
    } catch (error) {
      console.error('Error submitting for approval:', error);
    }
  };

  if (templatesData) setTemplates(templatesData);

  const extractVariables = (text: string): string[] => {
    const regex = /{{(\w+)}}/g;
    const matches = [...text.matchAll(regex)];
    return [...new Set(matches.map((m) => `{{${m[1]}}}`))] as string[];
  };

  const validateTemplate = (): boolean => {
    const errors: string[] = [];
    const warnings_list: string[] = [];

    if (!formData.name?.trim()) errors.push('Template name is required');
    if (!formData.body?.trim()) errors.push('Message body is required');
    if (!formData.messageType) errors.push('Message type is required');

    const extracted = extractVariables(formData.body || '');
    const allValidVariables = Object.values(VARIABLE_GROUPS).flat();

    extracted.forEach((variable) => {
      if (!allValidVariables.includes(variable)) {
        errors.push(`Unknown variable: ${variable}`);
      }
    });

    // Check required variables
    const requiredVars = REQUIRED_VARIABLES[formData.messageType as keyof typeof REQUIRED_VARIABLES] || [];
    requiredVars.forEach((required) => {
      if (!extracted.includes(required)) {
        warnings_list.push(`Missing important variable: ${required}`);
      }
    });

    setValidationErrors(errors);
    setWarnings(warnings_list);
    return errors.length === 0;
  };

  const handleBodyChange = (text: string) => {
    setFormData({ ...formData, body: text });
    const extracted = extractVariables(text);
    setFormData((prev) => ({ ...prev, extractedVariables: extracted }));
    validateTemplate();
  };

  const insertVariable = (variable: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const text = formData.body || '';
      const newText = text.substring(0, start) + variable + text.substring(end);
      handleBodyChange(newText);

      setTimeout(() => {
        textareaRef.current!.selectionStart = start + variable.length;
        textareaRef.current!.selectionEnd = start + variable.length;
        textareaRef.current!.focus();
      }, 0);
    }
  };

  const handleSave = () => {
    if (!validateTemplate()) {
      toast({ title: 'Validation Error', description: 'Please fix errors before saving', variant: 'destructive' });
      return;
    }
    saveMutation.mutate(formData);
  };

  const resetForm = () => {
    setFormData({ category: 'customer', language: 'en', status: 'draft', extractedVariables: [] });
    setSelectedTemplate(null);
    setIsEditing(false);
    setValidationErrors([]);
    setWarnings([]);
    setChangesSummary('');
  };

  const handleEdit = (template: Template) => {
    setSelectedTemplate(template);
    setFormData(template);
    setIsEditing(true);
  };

  const renderMobilePreview = (): string => {
    let preview = formData.body || '';
    const sampleData: Record<string, string> = {
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
      totalReceived: '₹92,000',
    };

    Object.entries(sampleData).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    return preview;
  };

  const filteredTemplates = templates.filter((t) => t.category === selectedCategory);
  const messageTypes = TEMPLATE_CATEGORIES.find((c) => c.value === selectedCategory)?.types || [];
  const charCount = formData.body?.length || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">WhatsApp Template Editor</h1>
          <p className="text-gray-600 mt-2">Customize your WhatsApp message templates</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="grid grid-cols-4 gap-8">
          {/* Category & Template List */}
          <div className="col-span-1 space-y-4">
            <div>
              <h3 className="font-semibold mb-3">Categories</h3>
              <div className="space-y-2">
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => {
                      setSelectedCategory(cat.value);
                      setSelectedTemplate(null);
                      setIsEditing(false);
                    }}
                    className={`w-full px-3 py-2 rounded text-left text-sm font-medium transition ${
                      selectedCategory === cat.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-sm">Templates</h3>
                <button onClick={() => setIsEditing(true)} size="sm" className="text-blue-600 hover:text-blue-700">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredTemplates.map((template) => (
                  <div
                    key={template._id}
                    onClick={() => handleEdit(template)}
                    className={`p-3 rounded cursor-pointer text-sm transition ${
                      selectedTemplate?._id === template._id
                        ? 'bg-blue-50 border border-blue-300'
                        : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <p className="font-medium text-gray-900">{template.name}</p>
                    <p className="text-xs text-gray-500 mt-1">v{template.version} • {template.status}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Editor & Preview */}
          <div className="col-span-3">
            {isEditing ? (
              <div className="space-y-4">
                {/* Editor Panel */}
                <Card>
                  <CardHeader>
                    <CardTitle>{selectedTemplate ? 'Edit Template' : 'Create Template'}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Template Name</label>
                        <Input
                          value={formData.name || ''}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g., Booking Confirmation"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Message Type</label>
                        <Select value={formData.messageType || ''} onValueChange={(val) => setFormData({ ...formData, messageType: val })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {messageTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type.replace(/_/g, ' ')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Language</label>
                        <Select value={formData.language || 'en'} onValueChange={(val) => setFormData({ ...formData, language: val })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="hi">Hindi</SelectItem>
                            <SelectItem value="hinglish">Hinglish</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Status</label>
                        <Select value={formData.status || 'draft'} onValueChange={(val) => setFormData({ ...formData, status: val as any })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Validation Errors */}
                    {validationErrors.length > 0 && (
                      <Alert className="bg-red-50 border-red-200">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800">
                          {validationErrors.map((error, i) => (
                            <div key={i}>• {error}</div>
                          ))}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Warnings */}
                    {warnings.length > 0 && (
                      <Alert className="bg-yellow-50 border-yellow-200">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <AlertDescription className="text-yellow-800">
                          {warnings.map((warning, i) => (
                            <div key={i}>⚠ {warning}</div>
                          ))}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Changes Summary (for version tracking) */}
                    {selectedTemplate && (
                      <div>
                        <label className="text-sm font-medium">What changed?</label>
                        <Input
                          value={changesSummary}
                          onChange={(e) => setChangesSummary(e.target.value)}
                          placeholder="e.g., Updated greeting and timing details"
                          className="text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          This will be tracked in the version history
                        </p>
                      </div>
                    )}

                    {/* Message Body */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium">Message Body</label>
                        <span className="text-xs text-gray-500">{charCount} characters</span>
                      </div>
                      <Textarea
                        ref={textareaRef}
                        value={formData.body || ''}
                        onChange={(e) => handleBodyChange(e.target.value)}
                        placeholder="Type your message using {{variables}}"
                        className="font-mono text-sm min-h-[200px]"
                      />
                    </div>

                    {/* Variable Insertion */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Insert Variable</label>
                      <div className="space-y-2">
                        {Object.entries(VARIABLE_GROUPS).map(([group, variables]) => (
                          <div key={group}>
                            <p className="text-xs font-semibold text-gray-600 mb-1">{group}</p>
                            <div className="flex flex-wrap gap-1">
                              {variables.map((variable) => (
                                <button
                                  key={variable}
                                  onClick={() => insertVariable(variable)}
                                  className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-xs font-mono"
                                >
                                  {variable}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-4 border-t">
                      <Button onClick={handleSave} disabled={saveMutation.isPending} className="flex-1">
                        <Save className="w-4 h-4 mr-1" />
                        Save Template
                      </Button>
                      <Button onClick={resetForm} variant="outline">
                        Cancel
                      </Button>
                      <Button onClick={() => setShowPreview(!showPreview)} variant="outline">
                        <Eye className="w-4 h-4 mr-1" />
                        {showPreview ? 'Hide' : 'Show'} Preview
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : selectedTemplate ? (
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{selectedTemplate.name}</CardTitle>
                      <p className="text-sm text-gray-600 mt-1">v{selectedTemplate.version} • {selectedTemplate.status}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => navigate(`/settings/whatsapp-template-history/${selectedTemplate._id}`)} variant="outline">
                        <History className="w-4 h-4 mr-1" />
                        History
                      </Button>
                      <Button onClick={() => handleEdit(selectedTemplate)}>
                        <Edit2 className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded font-mono text-sm whitespace-pre-wrap break-words">
                    {selectedTemplate.body}
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Variables Used:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplate.extractedVariables.map((v) => (
                        <span key={v} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-mono">
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-12 pb-12 text-center">
                  <p className="text-gray-600">Select or create a template</p>
                </CardContent>
              </Card>
            )}

            {/* Preview */}
            {showPreview && isEditing && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-lg">WhatsApp Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-3xl p-4 max-w-sm mx-auto">
                    <div className="bg-white rounded-2xl p-4 min-h-[300px] text-sm">
                      <div className="whitespace-pre-wrap break-words text-gray-800 font-sans">
                        {renderMobilePreview()}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-600">
                    <p className="font-medium mb-1">Message Stats:</p>
                    <p>• Length: {charCount} characters</p>
                    <p>• SMS Segments: {Math.ceil(charCount / 160)}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
