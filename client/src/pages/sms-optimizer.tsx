import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MessageSquare, Edit2, Save, BarChart3, Zap, AlertCircle } from 'lucide-react';

interface SMSTemplate {
  id: string;
  name: string;
  content: string;
  charCount: number;
  smsSegments: number;
  category: string;
  variables: string[];
  performance?: {
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    costPer1000: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface OptimizationTip {
  id: string;
  type: 'improvement' | 'warning' | 'best-practice';
  message: string;
  impact: 'high' | 'medium' | 'low';
  suggestedFix?: string;
}

interface SMSMetrics {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  avgDeliveryTime: number;
  costPerMessage: number;
  totalCost: number;
}

const SMS_PROVIDERS = [
  { name: 'Twilio', costPer1000: 0.0075, features: ['Global coverage', 'High reliability'] },
  { name: 'AWS SNS', costPer1000: 0.0645, features: ['AWS integration', 'Scalable'] },
  { name: 'Messagebird', costPer1000: 0.0375, features: ['Multi-channel', 'Advanced routing'] },
];

export default function SMSOptimizer() {
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<SMSTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [tips, setTips] = useState<OptimizationTip[]>([]);

  const { data: templatesData } = useQuery({
    queryKey: ['sms-templates'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/sms-templates');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      return data.templates || [];
    },
  });

  const { data: metrics } = useQuery({
    queryKey: ['sms-metrics'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/sms-metrics');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const data = await response.json();
      return data.metrics;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await fetch(`/api/notifications/sms-templates/${selectedTemplate?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to save');
      return response.json();
    },
  });

  if (templatesData) {
    setTemplates(templatesData);
  }

  const calculateSMSSegments = (text: string): number => {
    if (text.length <= 160) return 1;
    if (text.length <= 306) return 2;
    if (text.length <= 459) return 3;
    return Math.ceil(text.length / 153);
  };

  const analyzeContent = (content: string) => {
    const newTips: OptimizationTip[] = [];

    if (content.length > 160) {
      newTips.push({
        id: 'tip-1',
        type: 'warning',
        message: `Message will use ${calculateSMSSegments(content)} SMS segments (${content.length} chars)`,
        impact: 'high',
        suggestedFix: 'Shorten message to fit in single segment for lower cost'
      });
    }

    if (content.length < 20) {
      newTips.push({
        id: 'tip-2',
        type: 'warning',
        message: 'Message is very short. Consider adding more context or CTA.',
        impact: 'medium'
      });
    }

    if (!content.includes('http') && !content.toLowerCase().includes('reply')) {
      newTips.push({
        id: 'tip-3',
        type: 'best-practice',
        message: 'Consider adding a call-to-action or link to drive engagement',
        impact: 'medium',
        suggestedFix: 'Add a short URL or REPLY instruction'
      });
    }

    if (content.toUpperCase() === content && content.length > 20) {
      newTips.push({
        id: 'tip-4',
        type: 'best-practice',
        message: 'All caps text may appear aggressive. Use title case instead.',
        impact: 'low',
        suggestedFix: 'Convert to: ' + content.charAt(0).toUpperCase() + content.slice(1).toLowerCase()
      });
    }

    if (content.includes('$$') || content.includes('***')) {
      newTips.push({
        id: 'tip-5',
        type: 'improvement',
        message: 'Special characters can affect delivery. Use standard punctuation.',
        impact: 'medium'
      });
    }

    if (!content.includes(' ')) {
      newTips.push({
        id: 'tip-6',
        type: 'warning',
        message: 'Message contains no spaces. Ensure it will render correctly.',
        impact: 'medium'
      });
    }

    setTips(newTips);
  };

  const handleEditTemplate = (template: SMSTemplate) => {
    setSelectedTemplate(template);
    setEditContent(template.content);
    setIsEditing(true);
    analyzeContent(template.content);
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;

    const segments = calculateSMSSegments(editContent);
    const payload = {
      content: editContent,
      charCount: editContent.length,
      smsSegments: segments,
    };

    await saveMutation.mutateAsync(payload);
    setIsEditing(false);
    setSelectedTemplate(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">SMS Optimizer</h1>
          <p className="text-gray-600 mt-2">Optimize SMS content for delivery and cost</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Metrics Overview */}
        {metrics && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-gray-600 text-xs font-medium">TOTAL SENT</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">{metrics.totalSent.toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-gray-600 text-xs font-medium">DELIVERY RATE</p>
              <p className="text-2xl font-bold text-green-600 mt-2">
                {((metrics.totalDelivered / metrics.totalSent) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-gray-600 text-xs font-medium">COST / 1000</p>
              <p className="text-2xl font-bold text-orange-600 mt-2">${metrics.costPerMessage.toFixed(4)}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-gray-600 text-xs font-medium">TOTAL COST</p>
              <p className="text-2xl font-bold text-purple-600 mt-2">${metrics.totalCost.toFixed(2)}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-8">
          {/* Templates List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold">SMS Templates</h2>
            </div>
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {templates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => handleEditTemplate(template)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition ${
                    selectedTemplate?.id === template.id && isEditing ? 'bg-blue-50' : ''
                  }`}
                >
                  <h3 className="font-medium text-gray-900">{template.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{template.charCount} chars</p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {template.smsSegments} SMS
                    </span>
                    {template.performance && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        {(template.performance.deliveryRate * 100).toFixed(0)}% delivery
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Editor */}
          <div className="col-span-2">
            {isEditing && selectedTemplate ? (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Edit: {selectedTemplate.name}</h2>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    ✕
                  </button>
                </div>

                {/* Content Editor */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Message Content</label>
                  <textarea
                    value={editContent}
                    onChange={(e) => {
                      setEditContent(e.target.value);
                      analyzeContent(e.target.value);
                    }}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 font-mono text-sm"
                  />
                  <div className="flex justify-between items-center mt-2 text-sm">
                    <span className="text-gray-600">
                      {editContent.length} / 160 characters (Segment 1) or {editContent.length} / 306 characters (Segment 2)
                    </span>
                    <span className="font-semibold text-blue-600">
                      {calculateSMSSegments(editContent)} SMS segments
                    </span>
                  </div>
                </div>

                {/* Preview */}
                <div className="mb-6 bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs font-medium text-gray-700 mb-2">PREVIEW</p>
                  <div className="bg-white p-4 rounded border border-gray-300">
                    <p className="text-gray-900 text-sm">{editContent || '(Empty message)'}</p>
                  </div>
                </div>

                {/* Cost Analysis */}
                <div className="mb-6 bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-orange-900">Cost Impact</p>
                      <p className="text-xs text-orange-700 mt-1">
                        Using Twilio: ${(0.0075 * calculateSMSSegments(editContent)).toFixed(4)} per message
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-orange-600">
                        {calculateSMSSegments(editContent)} segments
                      </p>
                    </div>
                  </div>
                </div>

                {/* Optimization Tips */}
                {tips.length > 0 && (
                  <div className="mb-6 space-y-3">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Zap size={20} className="text-yellow-600" />
                      Optimization Tips
                    </h3>
                    {tips.map((tip) => (
                      <div
                        key={tip.id}
                        className={`p-4 rounded-lg border-l-4 ${
                          tip.type === 'warning'
                            ? 'bg-red-50 border-red-500'
                            : tip.type === 'improvement'
                            ? 'bg-yellow-50 border-yellow-500'
                            : 'bg-blue-50 border-blue-500'
                        }`}
                      >
                        <p className={`text-sm font-medium ${
                          tip.type === 'warning'
                            ? 'text-red-900'
                            : tip.type === 'improvement'
                            ? 'text-yellow-900'
                            : 'text-blue-900'
                        }`}>
                          {tip.message}
                        </p>
                        {tip.suggestedFix && (
                          <p className="text-xs text-gray-700 mt-2">💡 {tip.suggestedFix}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={handleSaveTemplate}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    <Save size={20} />
                    Save Template
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <MessageSquare size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 text-lg mb-4">Select a template to optimize</p>
                <p className="text-gray-500 text-sm">SMS optimization tips will appear here</p>
              </div>
            )}
          </div>
        </div>

        {/* Provider Comparison */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">SMS Provider Comparison</h2>
          <div className="grid grid-cols-3 gap-6">
            {SMS_PROVIDERS.map((provider) => (
              <div key={provider.name} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">{provider.name}</h3>
                <div className="bg-blue-50 p-3 rounded mb-3">
                  <p className="text-xs text-gray-600">Cost per 1000 SMS</p>
                  <p className="text-2xl font-bold text-blue-600">${provider.costPer1000.toFixed(4)}</p>
                </div>
                <ul className="text-sm text-gray-700 space-y-2">
                  {provider.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="text-green-600">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Best Practices */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-3">SMS Best Practices</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>✓ Keep messages under 160 characters to avoid multi-segment charges</li>
            <li>✓ Use short URLs (bit.ly, etc.) to save character space</li>
            <li>✓ Include clear call-to-action (Reply, Click, Learn More)</li>
            <li>✓ Avoid special characters that may not render on all devices</li>
            <li>✓ Test on real phones before sending to large audiences</li>
            <li>✓ Include sender ID or brand name for recognition</li>
            <li>✓ Personalize with customer name when possible</li>
            <li>✓ Always include unsubscribe option (STOP command)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
