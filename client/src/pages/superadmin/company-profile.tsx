import { useState, useEffect } from 'react';

interface Profile {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  timezone: string;
  supportEmail: string;
}

export default function SuperAdminCompanyProfile() {
  const [profile, setProfile] = useState<Profile>({
    name: 'FleetPro Platform',
    email: 'admin@fleetpro.com',
    phone: '+91-XXXXX-XXXXX',
    address: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    timezone: 'Asia/Kolkata',
    supportEmail: 'support@fleetpro.com'
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (field: keyof Profile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/saas/admin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      alert('Profile updated');
    } catch (err) {
      console.error('Save failed:', err);
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🏛️ Company Profile</h1>
        <p className="text-gray-600">Platform company settings</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-8 max-w-2xl">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
            <input type="text" value={profile.name} onChange={e => handleChange('name', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input type="email" value={profile.email} onChange={e => handleChange('email', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
              <input type="tel" value={profile.phone} onChange={e => handleChange('phone', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
            <input type="text" value={profile.address} onChange={e => handleChange('address', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
              <input type="text" value={profile.city} onChange={e => handleChange('city', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
              <input type="text" value={profile.country} onChange={e => handleChange('country', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
              <select value={profile.timezone} onChange={e => handleChange('timezone', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>Asia/Kolkata</option>
                <option>UTC</option>
                <option>Asia/Bangkok</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Support Email</label>
              <input type="email" value={profile.supportEmail} onChange={e => handleChange('supportEmail', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="flex gap-4">
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
