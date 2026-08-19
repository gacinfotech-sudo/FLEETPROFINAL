import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Phone, MessageCircle, CheckCircle, UserPlus } from 'lucide-react';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsappNumber: string;
  role: string;
}

export default function StaffWhatsAppManagement() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [editingStaff, setEditingStaff] = useState<{[key: string]: string}>({});
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addingStaff, setAddingStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'manager'
  });

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/staff/whatsapp-numbers');
      const data = await res.json();
      if (data.staff) {
        setStaff(data.staff);
        // Initialize editing state with current WhatsApp numbers
        const initialEditing: {[key: string]: string} = {};
        data.staff.forEach((s: StaffMember) => {
          initialEditing[s.id] = s.whatsappNumber || '';
        });
        setEditingStaff(initialEditing);
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const createNewStaff = async () => {
    try {
      if (!newStaff.name || !newStaff.email || !newStaff.phone) {
        setMessage('❌ All fields are required');
        return;
      }

      setAddingStaff(true);
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newStaff.name,
          email: newStaff.email,
          phone: newStaff.phone,
          role: newStaff.role,
          password: 'Staff@123'
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage('✅ New staff member created successfully!');
        setShowAddDialog(false);
        setNewStaff({ name: '', email: '', phone: '', role: 'manager' });
        fetchStaff(); // Refresh the list
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(`Error: ${data.message}`);
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setAddingStaff(false);
    }
  };

  const updateWhatsAppNumber = async (staffId: string) => {
    try {
      setSaving(staffId);
      const whatsappNumber = editingStaff[staffId];

      const res = await fetch(`/api/staff/${staffId}/whatsapp-number`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsappNumber }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage('✅ WhatsApp number updated successfully!');
        setStaff(prev => prev.map(s =>
          s.id === staffId ? { ...s, whatsappNumber: data.staff.whatsappNumber } : s
        ));
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(`Error: ${data.message}`);
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold mb-2">📱 Staff WhatsApp Numbers</h1>
          <p className="text-gray-600">Update WhatsApp numbers for staff to receive reminder notifications</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
              <UserPlus className="w-4 h-4" />
              Add New Staff
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Staff Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Rajesh Kumar"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="e.g., rajesh@fleetpro.com"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff(prev => ({ ...prev, email: e.target.value }))}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="e.g., 9876543210"
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff(prev => ({ ...prev, phone: e.target.value }))}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  value={newStaff.role}
                  onChange={(e) => setNewStaff(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button
                onClick={createNewStaff}
                disabled={addingStaff}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {addingStaff ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <UserPlus className="w-4 h-4 mr-2" />
                )}
                Create Staff
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {message && (
        <Alert className={`mb-6 ${message.includes('✅') ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <AlertDescription className={message.includes('✅') ? 'text-green-800' : 'text-red-800'}>
            {message}
          </AlertDescription>
        </Alert>
      )}

      {staff.length === 0 ? (
        <Card className="p-8 text-center">
          <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">No staff members found</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {staff.map((member) => (
            <Card key={member.id} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
                {/* Staff Info */}
                <div>
                  <p className="text-sm text-gray-600 font-medium">👤 Name</p>
                  <p className="text-lg font-semibold text-gray-900">{member.name}</p>
                  <p className="text-xs text-gray-500">{member.role}</p>
                </div>

                {/* Email */}
                <div>
                  <p className="text-sm text-gray-600 font-medium">📧 Email</p>
                  <p className="text-sm text-gray-900 break-all">{member.email}</p>
                </div>

                {/* Primary Phone */}
                <div>
                  <p className="text-sm text-gray-600 font-medium">📞 Primary Phone</p>
                  <p className="text-sm text-gray-900">{member.phone || '-'}</p>
                </div>

                {/* WhatsApp Number Input */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 font-medium mb-1">💬 WhatsApp Number</p>
                    <Input
                      type="tel"
                      placeholder="e.g., +91-9876543210"
                      value={editingStaff[member.id] || ''}
                      onChange={(e) => setEditingStaff(prev => ({
                        ...prev,
                        [member.id]: e.target.value
                      }))}
                      className="text-sm"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={() => updateWhatsAppNumber(member.id)}
                      disabled={saving === member.id}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      size="sm"
                    >
                      {saving === member.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-1" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Status Indicator */}
              {member.whatsappNumber && (
                <div className="mt-4 pt-4 border-t flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span>WhatsApp number configured: {member.whatsappNumber}</span>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Info Box */}
      <Alert className="mt-8 border-blue-200 bg-blue-50">
        <AlertDescription className="text-blue-900">
          <strong>ℹ️ How it works:</strong>
          <ul className="mt-2 ml-4 space-y-1 list-disc text-sm">
            <li>Staff members with WhatsApp numbers will receive reminder notifications</li>
            <li>Reminders are sent at 5min, 10min, 20min, 30min, 1hr, 2hrs, and 5hrs before bookings</li>
            <li>Use the format: +91-9876543210 or 919876543210</li>
            <li>This is especially useful for office managers and coordinators</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
