import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Save, Plus, Trash2, Eye, Code } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  category: string;
  subject?: string;
  body: string;
  variables: string[];
  channel: 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';
  preview?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface TemplateVariable {
  name: string;
  value: string;
}

const CATEGORIES = ['alerts', 'promotions', 'updates', 'reminders', 'newsletters', 'transactional'];
const CHANNELS = ['EMAIL', 'SMS', 'PUSH', 'IN_APP'];

const VARIABLE_HINTS = {
  user_name: 'User\'s full name',
  user_email: 'User\'s email address',
  user_phone: 'User\'s phone number',
  company_name: 'Company/Tenant name',
  booking_id: 'Booking reference number',
  vehicle_name: 'Vehicle name/number',
  driver_name: 'Driver name',
  date: 'Current date',
  time: 'Current time',
  amount: 'Transaction amount',
  status: 'Status (confirmed/pending/cancelled)',
  action_url: 'Link for call-to-action',
};

export default function TemplateEditor() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [previewVariables, setPreviewVariables] = useState<TemplateVariable[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    category: 'alerts',
    channel: 'EMAIL' as const,
    subject: '',
    body: '',
  });

  const { data: templatesData } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/templates');
      if (!response.ok) throw new Error('Failed to fetch templates');
      const data = await response.json();
      return data.templates || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (template: typeof formData) => {
      const response = await fetch('/api/notifications/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });
      if (!response.ok) throw new Error('Failed to create template');
      return response.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (template: typeof formData) => {
      if (!selectedTemplate) return;
      const response = await fetch(`/api/notifications/templates/${selectedTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });
      if (!response.ok) throw new Error('Failed to update template');
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await fetch(`/api/notifications/templates/${templateId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete template');
      return response.json();
    },
  });

  useEffect(() => {
    if (templatesData) {
      setTemplates(templatesData);
    }
  }, [templatesData]);

  useEffect(() => {
    if (selectedTemplate) {
      setFormData({
        name: selectedTemplate.name,
        category: selectedTemplate.category as any,
        channel: selectedTemplate.channel,
        subject: selectedTemplate.subject || '',
        body: selectedTemplate.body,
      });
      extractVariables(selectedTemplate.body);
    }
  }, [selectedTemplate]);

  const extractVariables = (text: string) => {
    const regex = /\{\{(\w+)\}\}/g;
    const matches = [...text.matchAll(regex)];
    const vars = matches.map(m => m[1]);
    setPreviewVariables(vars.map(v => ({ name: v, value: '' })));
  };

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newBody = e.target.value;
    setFormData(prev => ({ ...prev, body: newBody }));
    extractVariables(newBody);
  };

  const handleSave = async () => {
    if (selectedTemplate) {
      await updateMutation.mutateAsync(formData);
    } else {
      await createMutation.mutateAsync(formData);
    }
    setIsCreating(false);
    setSelectedTemplate(null);
    setFormData({ name: '', category: 'alerts', channel: 'EMAIL', subject: '', body: '' });
  };

  const handleDelete = async (templateId: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      await deleteMutation.mutateAsync(templateId);
      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null);
      }
    }
  };

  const renderPreview = () => {
    let preview = formData.body;
    previewVariables.forEach(v => {
      if (v.value) {
        preview = preview.replace(`{{${v.name}}}`, v.value);
      }
    });
    return preview;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Template Editor</h1>
          <p className="text-gray-600 mt-2">Create and manage notification templates</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="grid grid-cols-3 gap-8">
          {/* Template List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Templates</h2>
              <button
                onClick={() => {
                  setIsCreating(true);
                  setSelectedTemplate(null);
                  setFormData({ name: '', category: 'alerts', channel: 'EMAIL', subject: '', body: '' });
                }}
                className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
              >
                <Plus size={20} />
              </button>
            </div>
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {templates.map(template => (
                <div
                  key={template.id}
                  onClick={() => {
                    setSelectedTemplate(template);
                    setIsCreating(false);
                  }}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition ${
                    selectedTemplate?.id === template.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
                >
                  <h3 className="font-medium text-gray-900">{template.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {template.channel} • {template.category}
                  </p>
                  <span className={`inline-block text-xs px-2 py-1 rounded mt-2 ${
                    template.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {template.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Editor */}
          <div className="col-span-2">
            {isCreating || selectedTemplate ? (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">{selectedTemplate ? 'Edit Template' : 'Create Template'}</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewMode(viewMode === 'edit' ? 'preview' : 'edit')}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      {viewMode === 'edit' ? (
                        <>
                          <Eye size={18} />
                          Preview
                        </>
                      ) : (
                        <>
                          <Code size={18} />
                          Edit
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Save size={18} />
                      Save
                    </button>
                  </div>
                </div>

                {viewMode === 'edit' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Template Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                        placeholder="e.g., Weekly Summary"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                        >
                          {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Channel</label>
                        <select
                          value={formData.channel}
                          onChange={(e) => setFormData(prev => ({ ...prev, channel: e.target.value as any }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                        >
                          {CHANNELS.map(ch => (
                            <option key={ch} value={ch}>{ch}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {['EMAIL', 'IN_APP'].includes(formData.channel) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                        <input
                          type="text"
                          value={formData.subject}
                          onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                          placeholder="Email subject or notification title"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Message Body</label>
                      <p className="text-xs text-gray-500 mb-2">Use {{variable}} syntax for dynamic content</p>
                      <textarea
                        value={formData.body}
                        onChange={handleBodyChange}
                        rows={12}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 font-mono text-sm"
                        placeholder="Write your message template here..."
                      />
                    </div>

                    {previewVariables.length > 0 && (
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-sm text-gray-900 mb-3">Variables in Template</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {previewVariables.map(v => (
                            <div key={v.name} className="text-xs">
                              <code className="bg-gray-200 px-2 py-1 rounded">{`{{${v.name}}}`}</code>
                              <p className="text-gray-600 mt-1">{VARIABLE_HINTS[v.name as keyof typeof VARIABLE_HINTS] || 'Custom variable'}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formData.subject && (
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <p className="text-sm text-gray-600">Subject:</p>
                        <p className="text-lg font-semibold text-gray-900">{formData.subject}</p>
                      </div>
                    )}
                    <div className="bg-white p-4 rounded-lg border border-gray-200 whitespace-pre-wrap text-sm text-gray-700">
                      {renderPreview() || 'Preview will appear here'}
                    </div>
                    {previewVariables.length > 0 && (
                      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <p className="text-sm font-medium text-yellow-900 mb-3">Test Variables (optional)</p>
                        <div className="space-y-2">
                          {previewVariables.map(v => (
                            <input
                              key={v.name}
                              type="text"
                              placeholder={`{{${v.name}}}`}
                              value={v.value}
                              onChange={(e) => setPreviewVariables(prev =>
                                prev.map(pv => pv.name === v.name ? { ...pv, value: e.target.value } : pv)
                              )}
                              className="w-full px-3 py-2 border border-yellow-300 rounded text-sm"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedTemplate && (
                  <button
                    onClick={() => handleDelete(selectedTemplate.id)}
                    className="mt-6 flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    <Trash2 size={18} />
                    Delete Template
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-600 text-lg mb-4">Select a template to edit or create a new one</p>
                <button
                  onClick={() => {
                    setIsCreating(true);
                    setFormData({ name: '', category: 'alerts', channel: 'EMAIL', subject: '', body: '' });
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus size={20} />
                  Create New Template
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
