import { useState, useEffect } from 'react';

interface Plan {
  id: string;
  name: string;
  price: number;
  features: string[];
  tenants: number;
}

export default function SuperAdminPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/subscription/plans')
      .then(r => r.json())
      .then(data => {
        setPlans(data.plans || [
          { id: '1', name: 'Starter', price: 999, features: ['50 bookings/month', 'Basic reporting'], tenants: 0 },
          { id: '2', name: 'Professional', price: 4999, features: ['Unlimited bookings', 'Analytics', 'GPS'], tenants: 0 },
          { id: '3', name: 'Enterprise', price: 9999, features: ['Custom features', 'Dedicated support'], tenants: 0 }
        ]);
        setLoading(false);
      })
      .catch(() => {
        setPlans([
          { id: '1', name: 'Starter', price: 999, features: ['50 bookings/month', 'Basic reporting'], tenants: 0 },
          { id: '2', name: 'Professional', price: 4999, features: ['Unlimited bookings', 'Analytics', 'GPS'], tenants: 0 },
          { id: '3', name: 'Enterprise', price: 9999, features: ['Custom features', 'Dedicated support'], tenants: 0 }
        ]);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8">Loading plans...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">💳 Plans & Pricing</h1>
        <p className="text-gray-600">Manage subscription plans</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map(plan => (
          <div key={plan.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
            <p className="text-3xl font-bold text-blue-600 mb-4">₹{plan.price}</p>
            <p className="text-sm text-gray-600 mb-4">{plan.tenants} tenants</p>
            <ul className="space-y-2 mb-6">
              {plan.features.map((f, i) => (
                <li key={i} className="text-sm text-gray-700 flex items-start">
                  <span className="text-green-600 mr-2">✓</span>{f}
                </li>
              ))}
            </ul>
            <button className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
              Edit
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
