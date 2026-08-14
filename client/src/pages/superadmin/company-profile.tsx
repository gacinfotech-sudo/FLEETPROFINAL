import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Save, AlertCircle } from 'lucide-react';

interface CompanyProfile {
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  gst?: string;
  pan?: string;
  bankName?: string;
  upiId?: string;
  supportEmail?: string;
  supportPhone?: string;
  supportWhatsapp?: string;
  termsOfServiceUrl?: string;
  privacyPolicyUrl?: string;
  logoUrl?: string;
  isActive: boolean;
}

export default function SuperAdminCompanyProfile() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<CompanyProfile>({
    name: '',
    email: '',
    phone: '',
    whatsapp: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    pincode: '',
    gst: '',
    pan: '',
    bankName: '',
    upiId: '',
    supportEmail: '',
    supportPhone: '',
    supportWhatsapp: '',
    termsOfServiceUrl: '',
    privacyPolicyUrl: '',
    logoUrl: '',
    isActive: true,
  });

  // Fetch current profile
  const { isLoading } = useQuery({
    queryKey: ['superadmin-company-profile'],
    queryFn: async () => {
      const res = await fetch('/api/superadmin/company-profile', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch profile');
      const data = await res.json();
      if (data.data?.company) {
        setFormData(data.data.company);
      }
      return data;
    },
  });

  // Update profile mutation
  const updateMutation = useMutation({
    mutationFn: async (data: CompanyProfile) => {
      const res = await fetch('/api/superadmin/company-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({
        description: '✅ Company profile updated successfully',
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        description: '❌ Failed to update company profile',
      });
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6">
        <div className="text-center py-12">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">🏢 Company Profile</h1>
          <p className="text-blue-100">FleetPro SaaS Platform Information</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Company Info */}
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Company Name</Label>
                  <Input
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="FleetPro Technologies"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="contact@fleetpro.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+91-..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>WhatsApp</Label>
                  <Input
                    name="whatsapp"
                    value={formData.whatsapp}
                    onChange={handleChange}
                    placeholder="+91-..."
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader>
              <CardTitle>Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Full Address</Label>
                <Input
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="123 Business Street"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label>City</Label>
                  <Input
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="Indore"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>State</Label>
                  <Input
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="Madhya Pradesh"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Country</Label>
                  <Input
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    placeholder="India"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Pincode</Label>
                  <Input
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    placeholder="452001"
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tax & Banking */}
          <Card>
            <CardHeader>
              <CardTitle>Tax & Banking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>GST Number</Label>
                  <Input
                    name="gst"
                    value={formData.gst}
                    onChange={handleChange}
                    placeholder="27AABCU..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>PAN Number</Label>
                  <Input
                    name="pan"
                    value={formData.pan}
                    onChange={handleChange}
                    placeholder="AAABP..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Bank Name</Label>
                  <Input
                    name="bankName"
                    value={formData.bankName}
                    onChange={handleChange}
                    placeholder="HDFC Bank"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>UPI ID</Label>
                  <Input
                    name="upiId"
                    value={formData.upiId}
                    onChange={handleChange}
                    placeholder="fleetpro@hdfc"
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Support */}
          <Card>
            <CardHeader>
              <CardTitle>Support Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Support Email</Label>
                  <Input
                    name="supportEmail"
                    type="email"
                    value={formData.supportEmail}
                    onChange={handleChange}
                    placeholder="support@fleetpro.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Support Phone</Label>
                  <Input
                    name="supportPhone"
                    value={formData.supportPhone}
                    onChange={handleChange}
                    placeholder="+91-..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Support WhatsApp</Label>
                  <Input
                    name="supportWhatsapp"
                    value={formData.supportWhatsapp}
                    onChange={handleChange}
                    placeholder="+91-..."
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* URLs */}
          <Card>
            <CardHeader>
              <CardTitle>Policy URLs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Terms of Service URL</Label>
                <Input
                  name="termsOfServiceUrl"
                  type="url"
                  value={formData.termsOfServiceUrl}
                  onChange={handleChange}
                  placeholder="https://..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Privacy Policy URL</Label>
                <Input
                  name="privacyPolicyUrl"
                  type="url"
                  value={formData.privacyPolicyUrl}
                  onChange={handleChange}
                  placeholder="https://..."
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Save className="w-4 h-4" />
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.history.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
