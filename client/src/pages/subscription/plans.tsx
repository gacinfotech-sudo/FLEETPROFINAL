import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  code: string;
  description?: string;
  pricing: { monthly?: number; quarterly?: number; annual?: number; currency: string };
  limits: { vehicles: number; drivers: number; users: number };
  features: string[];
  trial: { enabled: boolean; daysCount: number };
}

export default function SubscriptionPlans() {
  const { data: response, isLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const res = await fetch('/api/plans', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch plans');
      return res.json();
    },
  });

  const plans: Plan[] = response?.data?.plans || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6">
        <div className="text-center py-12">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          <p className="mt-4 text-gray-600">Loading plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-2">💎 Choose Your Plan</h1>
          <p className="text-blue-100 max-w-2xl mx-auto">
            Flexible pricing designed for fleets of all sizes. Upgrade or downgrade anytime.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8">
        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {plans.map((plan) => {
            const monthlyPrice = plan.pricing.monthly || 0;
            const yearlyPrice = plan.pricing.annual || 0;
            const yearlyDiscount = yearlyPrice > 0 ? Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100) : 0;

            return (
              <Card
                key={plan.id}
                className="flex flex-col hover:shadow-xl transition-shadow border-2 hover:border-blue-500"
              >
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  {plan.description && (
                    <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
                  )}

                  {/* Trial Badge */}
                  {plan.trial.enabled && (
                    <div className="mt-3 inline-block bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full">
                      ✨ {plan.trial.daysCount} Day Free Trial
                    </div>
                  )}
                </CardHeader>

                <CardContent className="flex-1 space-y-6 pt-6">
                  {/* Pricing */}
                  <div>
                    {monthlyPrice > 0 && (
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-bold text-blue-600">
                            ₹{(monthlyPrice / 100).toLocaleString()}
                          </span>
                          <span className="text-gray-600">/month</span>
                        </div>
                        {yearlyPrice > 0 && (
                          <p className="text-sm text-gray-600 mt-2">
                            or ₹{(yearlyPrice / 100).toLocaleString()}/year
                            {yearlyDiscount > 0 && (
                              <span className="ml-2 text-green-600 font-semibold">
                                Save {yearlyDiscount}%
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Limits */}
                  <div className="border-t border-b py-4 space-y-3">
                    <h4 className="font-semibold text-gray-700">Includes</h4>
                    <div className="space-y-2 text-sm">
                      <p className="flex items-center gap-2">
                        <span className="text-lg">🚗</span>
                        <span>Up to <strong>{plan.limits.vehicles}</strong> vehicles</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <span className="text-lg">👤</span>
                        <span>Up to <strong>{plan.limits.drivers}</strong> drivers</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <span className="text-lg">⚙️</span>
                        <span>Up to <strong>{plan.limits.users}</strong> team members</span>
                      </p>
                    </div>
                  </div>

                  {/* Features */}
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-3">Features</h4>
                    <div className="space-y-2">
                      {plan.features.length > 0 ? (
                        plan.features.map((feature, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <span className="text-gray-700 capitalize">
                              {feature.split('-').join(' ')}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">Core features included</p>
                      )}
                    </div>
                  </div>

                  {/* CTA Button */}
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2"
                    onClick={() => window.location.href = '/dashboard/subscription/upgrade?plan=' + plan.code}
                  >
                    Get Started
                  </Button>

                  {/* Contact Sales for Enterprise */}
                  {plan.code === 'enterprise' && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => window.location.href = 'mailto:sales@fleetpro.com?subject=Enterprise Plan Inquiry'}
                    >
                      Contact Sales
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">Frequently Asked Questions</h2>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Can I change plans anytime?</CardTitle>
              </CardHeader>
              <CardContent>
                Yes! Upgrade or downgrade your plan anytime. Changes take effect immediately, and we'll prorate any applicable charges.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What payment methods do you accept?</CardTitle>
              </CardHeader>
              <CardContent>
                We accept all major credit cards, bank transfers, UPI, and offer offline payment options for enterprise customers.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Is there a setup fee?</CardTitle>
              </CardHeader>
              <CardContent>
                No setup fees! You can start your free trial immediately and only pay when you upgrade to a paid plan.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What if I need more vehicles/drivers?</CardTitle>
              </CardHeader>
              <CardContent>
                You can easily add individual vehicles or drivers beyond your plan limits. We'll charge you for the overages at a per-unit rate.
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
