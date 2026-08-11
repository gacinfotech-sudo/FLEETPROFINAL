// Notification Template Manager - Create and manage templates
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2, Eye } from 'lucide-react';

interface Template {
  _id: string;
  name: string;
  category: string;
  title: string;
  body: string;
  icon?: string;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

export const NotificationTemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: 'general',
    title: '',
    body: '',
    icon: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/notification-templates/list');
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.slice(2, -2)))];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const variables = [
      ...extractVariables(formData.title),
      ...extractVariables(formData.body)
    ];

    const payload = {
      ...formData,
      variables
    };

    try {
      const url = editingId
        ? `/api/notification-templates/${editingId}`
        : '/api/notification-templates/create';
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setFormData({ name: '', category: 'general', title: '', body: '', icon: '' });
        setEditingId(null);
        setShowForm(false);
        fetchTemplates();
      }
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  };

  const handleEdit = (template: Template) => {
    setFormData({
      name: template.name,
      category: template.category,
      title: template.title,
      body: template.body,
      icon: template.icon || ''
    });
    setEditingId(template._id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;

    try {
      const response = await fetch(`/api/notification-templates/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchTemplates();
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading templates...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingId ? 'Edit Template' : 'Create New Template'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="Template Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="px-3 py-2 border rounded-md"
                >
                  <option value="general">General</option>
                  <option value="booking">Booking</option>
                  <option value="payment">Payment</option>
                  <option value="promotion">Promotion</option>
                  <option value="alert">Alert</option>
                </select>
              </div>

              <Input
                placeholder="Title (supports {{variable}})"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />

              <Textarea
                placeholder="Body (supports {{variable}})"
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                rows={4}
                required
              />

              <Input
                placeholder="Icon (emoji or icon name)"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              />

              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingId ? 'Update' : 'Create'} Template
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    setFormData({ name: '', category: 'general', title: '', body: '', icon: '' });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Templates List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Templates</CardTitle>
            <CardDescription>Total: {templates.length} templates</CardDescription>
          </div>
          {!showForm && (
            <Button onClick={() => setShowForm(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No templates created yet</p>
          ) : (
            <div className="space-y-3">
              {templates.map(template => (
                <div key={template._id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {template.icon && <span className="text-lg">{template.icon}</span>}
                        <h4 className="font-semibold">{template.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {template.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{template.title}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {template.body}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(template)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(template._id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {template.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {template.variables.map(variable => (
                        <Badge key={variable} variant="secondary" className="text-xs">
                          {variable}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground mt-2">
                    Updated: {new Date(template.updatedAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationTemplateManager;
