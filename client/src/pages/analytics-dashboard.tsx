import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, AlertTriangle, Users, TrendingDown } from 'lucide-react';
import { apiClient } from '../utils/api-client';

interface DemandForecast {
  date: string;
  predictedBookings: number;
  confidence: number;
  peakHours: number[];
}

interface ChurnPrediction {
  customerId: string;
  churnRisk: number;
  daysUntilChurn: number;
  recommendation: string;
  retentionActions: string[];
}

interface FraudScore {
  bookingId: string;
  fraudRisk: number;
  redFlags: string[];
  recommendation: 'approve' | 'review' | 'block';
}

interface Anomaly {
  type: string;
  severity: string;
  description: string;
  affectedEntities: string[];
  timestamp: Date;
}

export default function AnalyticsDashboard() {
  const [demandForecast, setDemandForecast] = useState<DemandForecast[]>([]);
  const [churnPredictions, setChurnPredictions] = useState<ChurnPrediction[]>([]);
  const [fraudScores, setFraudScores] = useState<FraudScore[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'forecast' | 'churn' | 'fraud' | 'anomalies'>('forecast');

  useEffect(() => {
    fetchPredictiveData();
  }, []);

  const fetchPredictiveData = async () => {
    try {
      setLoading(true);
      const [forecast, churn, fraud, anom] = await Promise.all([
        apiClient.get('/analytics/predictive/demand-forecast'),
        apiClient.get('/analytics/predictive/churn-risk?limit=10'),
        apiClient.get('/analytics/predictive/fraud-detection'),
        apiClient.get('/analytics/predictive/anomalies'),
      ]);

      setDemandForecast(forecast.forecast || []);
      setChurnPredictions(churn.predictions || []);
      setFraudScores(fraud.fraudScores || []);
      setAnomalies(anom.anomalies || []);
    } catch (error) {
      console.error('Failed to fetch predictive data:', error);
    } finally {
      setLoading(false);
    }
  };

  const avgChurnRisk = churnPredictions.length > 0
    ? Math.round(churnPredictions.reduce((sum, p) => sum + p.churnRisk, 0) / churnPredictions.length)
    : 0;

  const highRiskFraud = fraudScores.filter(f => f.recommendation === 'block').length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Predictive Analytics</h1>
        <button
          onClick={fetchPredictiveData}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Avg Churn Risk</p>
              <p className="text-2xl font-bold">{avgChurnRisk}%</p>
            </div>
            <TrendingDown className="text-red-500" size={32} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">At-Risk Customers</p>
              <p className="text-2xl font-bold">{churnPredictions.filter(p => p.churnRisk > 70).length}</p>
            </div>
            <AlertTriangle className="text-orange-500" size={32} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Fraud Alerts</p>
              <p className="text-2xl font-bold">{highRiskFraud}</p>
            </div>
            <AlertTriangle className="text-red-500" size={32} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Anomalies Detected</p>
              <p className="text-2xl font-bold">{anomalies.length}</p>
            </div>
            <TrendingUp className="text-yellow-500" size={32} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button
          onClick={() => setActiveTab('forecast')}
          className={`px-4 py-2 font-medium ${activeTab === 'forecast' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          Demand Forecast
        </button>
        <button
          onClick={() => setActiveTab('churn')}
          className={`px-4 py-2 font-medium ${activeTab === 'churn' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          Churn Risk
        </button>
        <button
          onClick={() => setActiveTab('fraud')}
          className={`px-4 py-2 font-medium ${activeTab === 'fraud' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          Fraud Detection
        </button>
        <button
          onClick={() => setActiveTab('anomalies')}
          className={`px-4 py-2 font-medium ${activeTab === 'anomalies' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          Anomalies
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <>
            {activeTab === 'forecast' && (
              <div>
                <h2 className="text-lg font-bold mb-4">7-Day Demand Forecast</h2>
                {demandForecast.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={demandForecast}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="predictedBookings"
                        stroke="#3b82f6"
                        name="Predicted Bookings"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500">No forecast data available</p>
                )}
              </div>
            )}

            {activeTab === 'churn' && (
              <div>
                <h2 className="text-lg font-bold mb-4">At-Risk Customers</h2>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {churnPredictions.filter(p => p.churnRisk > 50).map(prediction => (
                    <div key={prediction.customerId} className="border p-3 rounded hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">Customer {prediction.customerId.slice(0, 8)}</p>
                          <p className="text-gray-600 text-sm">{prediction.recommendation}</p>
                          <div className="mt-2 flex gap-1 flex-wrap">
                            {prediction.retentionActions.map((action, i) => (
                              <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                {action}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${prediction.churnRisk > 75 ? 'text-red-600' : prediction.churnRisk > 50 ? 'text-orange-600' : 'text-yellow-600'}`}>
                            {prediction.churnRisk}%
                          </p>
                          <p className="text-xs text-gray-500">{prediction.daysUntilChurn}d left</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'fraud' && (
              <div>
                <h2 className="text-lg font-bold mb-4">Suspicious Bookings</h2>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {fraudScores.filter(f => f.fraudRisk > 20).map(fraud => (
                    <div key={fraud.bookingId} className="border p-3 rounded hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">Booking {fraud.bookingId.slice(0, 8)}</p>
                          <div className="mt-2 flex gap-1 flex-wrap">
                            {fraud.redFlags.map((flag, i) => (
                              <span key={i} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                                {flag}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Recommendation: <span className="font-semibold">{fraud.recommendation}</span>
                          </p>
                        </div>
                        <p className={`text-lg font-bold ${fraud.recommendation === 'block' ? 'text-red-600' : fraud.recommendation === 'review' ? 'text-orange-600' : 'text-green-600'}`}>
                          {fraud.fraudRisk}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'anomalies' && (
              <div>
                <h2 className="text-lg font-bold mb-4">Detected Anomalies</h2>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {anomalies.map((anomaly, i) => (
                    <div
                      key={i}
                      className={`border-l-4 p-3 rounded ${
                        anomaly.severity === 'critical'
                          ? 'border-l-red-600 bg-red-50'
                          : anomaly.severity === 'high'
                          ? 'border-l-orange-600 bg-orange-50'
                          : anomaly.severity === 'medium'
                          ? 'border-l-yellow-600 bg-yellow-50'
                          : 'border-l-blue-600 bg-blue-50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-semibold text-sm capitalize">{anomaly.type}</p>
                          <p className="text-gray-600 text-sm">{anomaly.description}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded font-semibold ${
                          anomaly.severity === 'critical'
                            ? 'bg-red-600 text-white'
                            : anomaly.severity === 'high'
                            ? 'bg-orange-600 text-white'
                            : anomaly.severity === 'medium'
                            ? 'bg-yellow-600 text-white'
                            : 'bg-blue-600 text-white'
                        }`}>
                          {anomaly.severity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
