import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Phone, Clock, Settings, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function TenantWhatsAppProfile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('company');
  const [formData, setFormData] = useState<any>({
    companyName: '',
    displayName: '',
    ownerName: '',
    ownerWhatsApp: '',
    emergencyContact: '',
    operationsWhatsApp: '',
    bookingContactNumber: '',
    driverSupportNumber: '',
    financeWhatsApp: '',
    customerSupportNumber: '',
    customerLanguage: 'en',
    driverLanguage: 'hi',
    ownerSummaryLanguage: 'hinglish',
    dailySummaryTime: '23:30',
    timezone: 'Asia/Kolkata',
    features: {},
    dailySummaryRecipients: {},
  });

  const { data: profile } = useQuery({
    queryKey: ['tenant-whatsapp-profile'],
    queryFn: async () => {
      const response = await fetch('/api/tenant/whatsapp-profile');
      if (!response.ok) throw new Error('Failed to fetch');
      return (await response.json()).profile || {};
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/tenant/whatsapp-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-whatsapp-profile'] });
      toast({ title: 'Success', description: 'WhatsApp profile updated' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update profile', variant: 'destructive' });
    },
  });

  React.useEffect(() => {
    if (profile) setFormData(profile);
  }, [profile]);

  const handleInputChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const tabs = [
    { id: 'company', label: '🏢 Company', icon: MessageCircle },
    { id: 'owner', label: '👤 Owner & Emergency', icon: Phone },
    { id: 'operations', label: '🚗 Operations', icon: Settings },
    { id: 'languages', label: '🌐 Languages', icon: MessageCircle },
    { id: 'daily', label: '📅 Daily Closing', icon: Clock },
    { id: 'features', label: '✨ Features', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-8 py-6">
          <div className="flex items-center gap-3 mb-2">
            <MessageCircle className="w-8 h-8 text-green-600" />
            <h1 className="text-3xl font-bold text-gray-900">WhatsApp Communication Profile</h1>
          </div>
          <p className="text-gray-600">Configure WhatsApp settings for tenant communication</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition ${
                activeTab === tab.id
                  ? 'bg-green-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Company Tab */}
        {activeTab === 'company' && (
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Company Name</label>
                  <Input
                    value={formData.companyName}
                    onChange={(e) => handleInputChange('companyName', e.target.value)}
                    placeholder="e.g., Shyam Travels"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Display Name</label>
                  <Input
                    value={formData.displayName}
                    onChange={(e) => handleInputChange('displayName', e.target.value)}
                    placeholder="WhatsApp display name"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Owner & Emergency Tab */}
        {activeTab === 'owner' && (
          <Card>
            <CardHeader>
              <CardTitle>Owner & Emergency Contacts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Owner Name</label>
                  <Input
                    value={formData.ownerName}
                    onChange={(e) => handleInputChange('ownerName', e.target.value)}
                    placeholder="Owner name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Owner WhatsApp</label>
                  <Input
                    value={formData.ownerWhatsApp}
                    onChange={(e) => handleInputChange('ownerWhatsApp', e.target.value)}
                    placeholder="91XXXXXXXXXX"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Emergency Contact</label>
                  <Input
                    value={formData.emergencyContact}
                    onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                    placeholder="Emergency number"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Secondary Owner</label>
                  <Input
                    value={formData.secondaryOwnerNumber}
                    onChange={(e) => handleInputChange('secondaryOwnerNumber', e.target.value)}
                    placeholder="Secondary owner number"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Operations Tab */}
        {activeTab === 'operations' && (
          <Card>
            <CardHeader>
              <CardTitle>Operations & Support Contacts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Operations WhatsApp</label>
                  <Input
                    value={formData.operationsWhatsApp}
                    onChange={(e) => handleInputChange('operationsWhatsApp', e.target.value)}
                    placeholder="Operations number"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Booking Contact</label>
                  <Input
                    value={formData.bookingContactNumber}
                    onChange={(e) => handleInputChange('bookingContactNumber', e.target.value)}
                    placeholder="Booking support"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Driver Support</label>
                  <Input
                    value={formData.driverSupportNumber}
                    onChange={(e) => handleInputChange('driverSupportNumber', e.target.value)}
                    placeholder="Driver support"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Finance WhatsApp</label>
                  <Input
                    value={formData.financeWhatsApp}
                    onChange={(e) => handleInputChange('financeWhatsApp', e.target.value)}
                    placeholder="Finance number"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium">Customer Support</label>
                  <Input
                    value={formData.customerSupportNumber}
                    onChange={(e) => handleInputChange('customerSupportNumber', e.target.value)}
                    placeholder="Customer support"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Languages Tab */}
        {activeTab === 'languages' && (
          <Card>
            <CardHeader>
              <CardTitle>Communication Languages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
                <p className="text-sm text-blue-900">Default: Customer = English, Driver = Hindi, Owner = Hinglish</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Customer Language</label>
                  <Select value={formData.customerLanguage} onValueChange={(val) => handleInputChange('customerLanguage', val)}>
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
                  <label className="text-sm font-medium">Driver Language</label>
                  <Select value={formData.driverLanguage} onValueChange={(val) => handleInputChange('driverLanguage', val)}>
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
                <div className="col-span-2">
                  <label className="text-sm font-medium">Owner/Daily Summary Language</label>
                  <Select value={formData.ownerSummaryLanguage} onValueChange={(val) => handleInputChange('ownerSummaryLanguage', val)}>
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
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daily Closing Tab */}
        {activeTab === 'daily' && (
          <Card>
            <CardHeader>
              <CardTitle>Daily Closing Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Daily Closing Time</label>
                  <Input
                    type="time"
                    value={formData.dailySummaryTime}
                    onChange={(e) => handleInputChange('dailySummaryTime', e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">Default: 23:30 (11:30 PM)</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Timezone</label>
                  <Select value={formData.timezone} onValueChange={(val) => handleInputChange('timezone', val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                      <SelectItem value="Asia/Mumbai">Asia/Mumbai (IST)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">Daily Report Recipients</h3>
                <div className="space-y-2">
                  {[
                    { key: 'owner', label: 'Owner' },
                    { key: 'coOwner', label: 'Co-Owner' },
                    { key: 'operationsManager', label: 'Operations Manager' },
                    { key: 'finance', label: 'Finance' },
                    { key: 'accountant', label: 'Accountant' },
                  ].map((recipient) => (
                    <label key={recipient.key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.dailySummaryRecipients?.[recipient.key] || false}
                        onChange={(e) =>
                          handleInputChange('dailySummaryRecipients', {
                            ...formData.dailySummaryRecipients,
                            [recipient.key]: e.target.checked,
                          })
                        }
                      />
                      <span className="text-sm">{recipient.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Features Tab */}
        {activeTab === 'features' && (
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { key: 'bookingConfirmation', label: '✅ Booking Confirmation Messages' },
                  { key: 'driverAssignment', label: '🚗 Driver Assignment Alerts' },
                  { key: 'paymentReceipt', label: '💳 Payment Receipt Messages' },
                  { key: 'tripCompletion', label: '🏁 Trip Completion Messages' },
                  { key: 'customerFeedback', label: '⭐ Customer Feedback Requests' },
                  { key: 'dailyClosingReport', label: '📊 Daily Closing Report' },
                ].map((feature) => (
                  <label key={feature.key} className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.features?.[feature.key] || false}
                      onChange={(e) =>
                        handleInputChange('features', {
                          ...formData.features,
                          [feature.key]: e.target.checked,
                        })
                      }
                    />
                    <span className="text-sm font-medium">{feature.label}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Save Button */}
        <div className="mt-8 flex gap-3">
          <Button
            onClick={() => updateMutation.mutate(formData)}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {updateMutation.isPending ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </div>
    </div>
  );
}
