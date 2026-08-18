import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const fmtMoney = (n: number) => `₹${n.toLocaleString('en-IN')}`;

interface Driver {
  id: string;
  _id?: string;
  name: string;
  phone: string;
  email?: string;
  status: string;
  dateOfJoining?: string;
  licenseNumber?: string;
  rating?: number;
  hasSalaryConfig: boolean;
  salaryStatus: string;
  baseSalary: number;
}

interface DriverSearchProps {
  onSelectDriver: (driver: Driver) => void;
  selectedDriverIds?: string[];
}

export function DriverSearch({ onSelectDriver, selectedDriverIds = [] }: DriverSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Fetch drivers
  const { data: driversData = { data: [], count: 0 }, isLoading } = useQuery({
    queryKey: ['/api/drivers', statusFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (searchTerm) params.append('search', searchTerm);

      const res = await fetch(`/api/drivers?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch drivers');
      return res.json();
    }
  });

  // Fetch driver details
  const { data: driverDetails } = useQuery({
    queryKey: [`/api/drivers/${selectedDriver?.id}/complete-profile`],
    queryFn: async () => {
      const res = await fetch(`/api/drivers/${selectedDriver?.id}/complete-profile`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch driver details');
      return res.json();
    },
    enabled: !!selectedDriver?.id && showDetails
  });

  const drivers = driversData?.data || [];

  const handleSelectDriver = (driver: Driver) => {
    setSelectedDriver(driver);
    setShowDetails(true);
  };

  const handleConfirmSelection = () => {
    if (selectedDriver) {
      onSelectDriver(selectedDriver);
      setShowDetails(false);
      setSelectedDriver(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter */}
      <Card className="p-4">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Search Driver</label>
            <Input
              placeholder="Search by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <div className="flex gap-2">
              {['active', 'inactive', 'all'].map((status) => (
                <Badge
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setStatusFilter(status)}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Drivers List */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">
          Available Drivers ({drivers.length})
        </h3>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading drivers...</div>
        ) : drivers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No drivers found</div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {drivers.map((driver: Driver) => (
              <div
                key={driver.id || driver._id}
                className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => handleSelectDriver(driver)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{driver.name}</div>
                    <div className="text-sm text-gray-500">{driver.phone}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={driver.status === 'active' ? 'default' : 'secondary'}>
                      {driver.status}
                    </Badge>
                    {driver.hasSalaryConfig ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        {fmtMoney(driver.baseSalary)}/mo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-orange-50 text-orange-700">
                        No salary config
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Driver Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedDriver?.name} - Complete Profile
            </DialogTitle>
          </DialogHeader>

          {driverDetails?.data ? (
            <Tabs defaultValue="basic" className="w-full">
              <TabsList>
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="salary">Salary</TabsTrigger>
                <TabsTrigger value="attendance">Attendance</TabsTrigger>
                <TabsTrigger value="advances">Advances</TabsTrigger>
                <TabsTrigger value="penalties">Penalties</TabsTrigger>
              </TabsList>

              {/* Basic Tab */}
              <TabsContent value="basic" className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Name</p>
                    <p className="font-medium">{driverDetails.data.driver.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="font-medium">{driverDetails.data.driver.phone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="font-medium">{driverDetails.data.driver.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Status</p>
                    <p className="font-medium">{driverDetails.data.driver.status}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">License</p>
                    <p className="font-medium">{driverDetails.data.driver.licenseNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Rating</p>
                    <p className="font-medium">⭐ {driverDetails.data.driver.rating || 'N/A'}</p>
                  </div>
                </div>
              </TabsContent>

              {/* Salary Tab */}
              <TabsContent value="salary" className="space-y-3">
                {driverDetails.data.salary ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Base Salary</p>
                      <p className="font-medium text-lg text-green-600">
                        {fmtMoney(driverDetails.data.salary.baseSalary)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Status</p>
                      <p className="font-medium">
                        <Badge variant="default">{driverDetails.data.salary.status}</Badge>
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Configured At</p>
                      <p className="font-medium">
                        {new Date(driverDetails.data.salary.configuredAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-orange-600">
                    ⚠️ No salary configuration found. Please configure salary first.
                  </div>
                )}
              </TabsContent>

              {/* Attendance Tab */}
              <TabsContent value="attendance" className="space-y-3">
                {driverDetails.data.attendance ? (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-green-50 p-3 rounded">
                      <p className="text-xs text-gray-500">Present</p>
                      <p className="text-2xl font-bold text-green-600">
                        {driverDetails.data.attendance.presentDays}
                      </p>
                    </div>
                    <div className="bg-red-50 p-3 rounded">
                      <p className="text-xs text-gray-500">Absent</p>
                      <p className="text-2xl font-bold text-red-600">
                        {driverDetails.data.attendance.absentDays}
                      </p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded">
                      <p className="text-xs text-gray-500">Paid Leave</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {driverDetails.data.attendance.paidLeaveDays}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No attendance data for current month
                  </div>
                )}
              </TabsContent>

              {/* Advances Tab */}
              <TabsContent value="advances" className="space-y-3">
                {driverDetails.data.advances.count > 0 ? (
                  <>
                    <div className="bg-orange-50 p-3 rounded">
                      <p className="text-xs text-gray-500">Total Outstanding</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {fmtMoney(driverDetails.data.advances.total)}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {driverDetails.data.advances.items.map((adv: any) => (
                        <div key={adv.id} className="border p-2 rounded text-sm">
                          <div className="flex justify-between">
                            <span>{fmtMoney(adv.amount)}</span>
                            <Badge variant="outline">{adv.status}</Badge>
                          </div>
                          <div className="text-xs text-gray-500">
                            Remaining: {fmtMoney(adv.remaining)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No active advances
                  </div>
                )}
              </TabsContent>

              {/* Penalties Tab */}
              <TabsContent value="penalties" className="space-y-3">
                {driverDetails.data.penalties.count > 0 ? (
                  <>
                    <div className="bg-red-50 p-3 rounded">
                      <p className="text-xs text-gray-500">Total Penalties</p>
                      <p className="text-2xl font-bold text-red-600">
                        {fmtMoney(driverDetails.data.penalties.total)}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {driverDetails.data.penalties.items.map((pen: any) => (
                        <div key={pen.id} className="border p-2 rounded text-sm">
                          <div className="flex justify-between">
                            <span>{pen.reason}</span>
                            <span className="font-bold">{fmtMoney(pen.amount)}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            <Badge variant="outline">{pen.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No active penalties
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-8">Loading driver details...</div>
          )}

          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDetails(false)}>
              Close
            </Button>
            {!selectedDriverIds?.includes(selectedDriver?.id) && (
              <Button onClick={handleConfirmSelection}>
                Select Driver for Payroll
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
