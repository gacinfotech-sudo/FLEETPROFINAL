import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Settings, Bell, MessageCircle, ArrowRight } from 'lucide-react';
import WhatsAppReminderSettings from './tenant/whatsapp-reminder-settings';

export default function WhatsAppSettingsHub() {
  const [activeTab, setActiveTab] = useState<'reminders'>('reminders');

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">⚙️ WhatsApp Settings</h1>
        <p className="text-gray-600">Manage your WhatsApp reminders and notifications</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-8 border-b">
        <Button
          onClick={() => setActiveTab('reminders')}
          variant={activeTab === 'reminders' ? 'default' : 'ghost'}
          className="flex items-center gap-2"
        >
          <Bell className="w-4 h-4" />
          Reminder Settings
        </Button>
      </div>

      {/* Tab Content */}
      {activeTab === 'reminders' && (
        <WhatsAppReminderSettings />
      )}
    </div>
  );
}
