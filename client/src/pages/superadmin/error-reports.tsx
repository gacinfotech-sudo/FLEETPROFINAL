import { useState, useEffect } from 'react';

export default function ErrorReports() {
  const [errors, setErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/saas/errors')
      .then(r => r.json())
      .then(data => {
        setErrors(data.errors || []);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8">Loading errors...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">🚨 Error Reports</h1>
        <p className="text-gray-600">{errors.length} unresolved errors</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold">Error ID</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Tenant</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Module</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Type</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Occurrences</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Severity</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {errors.map(error => (
              <tr key={error.id} className="border-b hover:bg-gray-50">
                <td className="px-6 py-4 font-mono text-sm font-semibold text-blue-600 cursor-pointer hover:underline">
                  {error.id}
                </td>
                <td className="px-6 py-4 text-sm">{error.tenantId}</td>
                <td className="px-6 py-4 text-sm">{error.module}</td>
                <td className="px-6 py-4 text-sm">{error.type}</td>
                <td className="px-6 py-4 text-sm font-semibold">{error.occurrences}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                    error.severity === 'high' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {error.severity}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">{error.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
