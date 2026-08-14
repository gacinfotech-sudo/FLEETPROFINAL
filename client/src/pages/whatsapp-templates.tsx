import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit2, Plus, Trash2, Eye, Copy, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface Template {
  _id: string;
  templateType: string;
  messageType: string;
  name: string;
  language: string;
  subject?: string;
  body: string;
  variables: string[];
  isActive: boolean;
  isCustom: boolean;
}

const TEMPLATE_TYPES = [
  { value: 'customer', label: '👤 Customer Messages' },
  { value: 'driver', label: '🚗 Driver Messages' },
  { value: 'owner', label: '👨‍💼 Owner Messages' },
  { value: 'finance', label: '💳 Finance Messages' },
  { value: 'payment', label: '💰 Payment Messages' },
  { value: 'daily_summary', label: '📊 Daily Summary' },
];

const MESSAGE_TYPES = {
  customer: ['booking_confirmation', 'payment_receipt', 'trip_completion', 'feedback_request'],
  driver: ['booking_assignment', 'trip_started', 'trip_completed', 'payment_alert'],
  owner: ['booking_alert', 'daily_summary', 'alert'],
  finance: ['payment_received', 'collection_alert', 'outstanding_alert'],
  payment: ['receipt', 'reminder', 'confirmation'],
  daily_summary: ['owner_summary', 'operations_summary', 'finance_summary'],
};

const COMMON_VARIABLES = [
  '{{companyName}}',
  '{{bookingId}}',
  '{{customerName}}',
  '{{customerPhone}}',
  '{{driverName}}',
  '{{driverPhone}}',
  '{{vehicleName}}',
  '{{vehicleNumber}}',
  '{{pickup}}',
  '{{drop}}',
  '{{itinerary}}',
  '{{pickupDate}}',
  '{{pickupTime}}',
  '{{bookingAmount}}',
  '{{amountReceived}}',
  '{{balanceDue}}',
  '{{driverCollectAmount}}',
  '{{supportPhone}}',
];

export default function WhatsAppTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [formData, setFormData] = useState<Partial<Template>>({
    templateType: 'customer',
    language: 'en',
    isActive: true,
  });

  const { data: templatesData } = useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: async () => {
      const response = await fetch('/api/tenant/whatsapp-templates');
      if (!response.ok) throw new Error('Failed to fetch');
      return (await response.json()).templates || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Template>) => {
      const url = data._id ? `/api/tenant/whatsapp-templates/${data._id}` : '/api/tenant/whatsapp-templates';
      const method = data._id ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to save');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      toast({ title: 'Success', description: 'Template saved' });
      resetForm();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save template', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/tenant/whatsapp-templates/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      toast({ title: 'Success', description: 'Template deleted' });
    },
  });

  if (templatesData) setTemplates(templatesData);

  const resetForm = () => {
    setFormData({ templateType: 'customer', language: 'en', isActive: true });
    setSelectedTemplate(null);
    setIsEditing(false);
  };

  const handleEdit = (template: Template) => {
    setSelectedTemplate(template);
    setFormData(template);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.body) {
      toast({ title: 'Error', description: 'Name and body are required' });
      return;
    }
    saveMutation.mutate(formData);
  };

  const extractVariables = (text: string): string[] => {
    const regex = /{{(\w+)}}/g;
    const matches = [...text.matchAll(regex)];
    return [...new Set(matches.map((m) => `{{${m[1]}}}`))] as string[];
  };

  const renderPreview = (): string => {
    let preview = formData.body || '';
    const testData: Record<string, string> = {
      companyName: 'Shyam Travels',
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
      pickupDate: '18 August 2026',
      pickupTime: '08:00 AM',
      bookingAmount: '₹8,500',
      amountReceived: '₹3,000',
      balanceDue: '₹5,500',
      driverCollectAmount: '₹5,500',
      supportPhone: '98XXXXXXXX',
    };

    Object.entries(testData).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    return preview;
  };

  const messageTypes = MESSAGE_TYPES[formData.templateType as keyof typeof MESSAGE_TYPES] || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">WhatsApp Message Templates</h1>
          <p className="text-gray-600 mt-2">Manage custom message templates for tenant communication</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="grid grid-cols-3 gap-8">
          {/* Template List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Templates</h2>
              <Button size="sm" onClick={() => setIsEditing(true)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {templates.map((template) => (
                <div
                  key={template._id}
                  onClick={() => handleEdit(template)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition ${
                    selectedTemplate?._id === template._id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{template.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {template.templateType} • {template.language.toUpperCase()}
                      </p>
                    </div>
                    {!template.isCustom && <span className="text-xs bg-gray-100 px-2 py-1 rounded">Default</span>}
                  </div>
                  {!template.isActive && <p className="text-xs text-red-600 mt-2">Inactive</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Template Editor */}
          <div className="col-span-2">
            {isEditing ? (
              <div className="bg-white rounded-lg shadow p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">
                    {selectedTemplate ? 'Edit Template' : 'Create Template'}
                  </h2>
                  <Button variant="outline" size="sm" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Template Type</label>
                      <Select value={formData.templateType} onValueChange={(val) => setFormData({ ...formData, templateType: val })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TEMPLATE_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Message Type</label>
                      <Select value={formData.messageType || ''} onValueChange={(val) => setFormData({ ...formData, messageType: val })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select message type" />
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
                      <Select value={formData.language} onValueChange={(val) => setFormData({ ...formData, language: val })}>
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
                      <label className="text-sm font-medium">Template Name</label>
                      <Input
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Booking Confirmation"
                      />
                    </div>
                  </div>

                  {formData.templateType === 'daily_summary' && (
                    <div>
                      <label className="text-sm font-medium">Subject</label>
                      <Input
                        value={formData.subject || ''}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        placeholder="Email subject (optional)"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium">Message Body</label>
                    <Textarea
                      value={formData.body || ''}
                      onChange={(e) => {
                        setFormData({ ...formData, body: e.target.value });
                        setFormData((prev) => ({ ...prev, variables: extractVariables(e.target.value) }));
                      }}
                      placeholder="Use {{variableName}} for placeholders"
                      className="font-mono text-sm min-h-[200px]"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Available Variables</label>
                    <div className="grid grid-cols-2 gap-2">
                      {COMMON_VARIABLES.map((variable) => (
                        <button
                          key={variable}
                          onClick={() => {
                            setFormData({
                              ...formData,
                              body: (formData.body || '') + variable,
                            });
                          }}
                          className="text-left px-3 py-1 bg-gray-100 hover:bg-blue-100 rounded text-xs font-mono"
                        >
                          {variable}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isActive || false}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    <span className="text-sm">Active</span>
                  </label>

                  <div className="flex gap-2">
                    <Button onClick={() => setShowPreview(!showPreview)} variant="outline" size="sm">
                      <Eye className="w-4 h-4 mr-1" />
                      {showPreview ? 'Hide' : 'Preview'}
                    </Button>
                    <Button onClick={handleSave} disabled={saveMutation.isPending}>
                      <Save className="w-4 h-4 mr-1" />
                      Save Template
                    </Button>
                    {selectedTemplate && (
                      <Button
                        onClick={() => deleteMutation.mutate(selectedTemplate._id)}
                        variant="destructive"
                        size="sm"
                        disabled={!selectedTemplate.isCustom}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : selectedTemplate ? (
              <div className="bg-white rounded-lg shadow p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedTemplate.name}</h2>
                    <p className="text-gray-600 text-sm mt-1">
                      {selectedTemplate.templateType} • {selectedTemplate.language.toUpperCase()} • {selectedTemplate.messageType}
                    </p>
                  </div>
                  <Button onClick={() => handleEdit(selectedTemplate)} size="sm">
                    <Edit2 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">Template Content</h3>
                  <div className="bg-gray-50 p-4 rounded font-mono text-sm whitespace-pre-wrap break-words">
                    {selectedTemplate.body}
                  </div>
                </div>

                {selectedTemplate.variables.length > 0 && (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-2">Used Variables</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplate.variables.map((variable) => (
                        <span key={variable} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-mono">
                          {variable}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {!selectedTemplate.isCustom && (
                  <Alert>
                    <AlertDescription>This is a default template. Create a custom template to modify.</AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-600 text-lg">Select or create a template</p>
              </div>
            )}

            {showPreview && isEditing && (
              <div className="mt-4 bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold mb-3">Message Preview</h3>
                <div className="bg-gray-50 p-4 rounded whitespace-pre-wrap break-words text-sm">
                  {renderPreview()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
