import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { ChevronDown, Search } from "lucide-react";

interface VehicleType {
  _id: string;
  displayName: string;
  vehicleModel: string;
  category: string;
  seatingCapacity: number;
  isActive: boolean;
}

interface VehicleSelectorProps {
  value?: string;
  onChange?: (vehicleTypeId: string, vehicleDisplayName: string) => void;
  passengerCount?: number;
  label?: string;
}

export default function VehicleSelector({
  value,
  onChange,
  passengerCount,
  label = "Vehicle Requirement",
}: VehicleSelectorProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const { data: vehicleTypes = [] } = useQuery<VehicleType[]>({
    queryKey: ["/api/vehicle-types", passengerCount],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (passengerCount && passengerCount > 0) {
        params.set("minSeating", String(passengerCount));
      }
      const res = await apiRequest("GET", `/api/vehicle-types?${params.toString()}`);
      return res.json();
    },
  });

  const filteredVehicles = useMemo(() => {
    if (!search.trim()) return vehicleTypes;

    const searchLower = search.toLowerCase();
    return vehicleTypes.filter((v) =>
      v.displayName.toLowerCase().includes(searchLower) ||
      v.vehicleModel.toLowerCase().includes(searchLower) ||
      v.category.toLowerCase().includes(searchLower) ||
      String(v.seatingCapacity).includes(searchLower)
    );
  }, [vehicleTypes, search]);

  const selectedVehicle = vehicleTypes.find((v) => v._id === value);

  const suggestedVehicles = useMemo(() => {
    if (!passengerCount || passengerCount < 1) return [];
    return vehicleTypes
      .filter((v) => v.seatingCapacity >= passengerCount && v.seatingCapacity <= passengerCount + 2)
      .slice(0, 3);
  }, [vehicleTypes, passengerCount]);

  return (
    <div className="relative">
      <Label htmlFor="vehicle-selector" className="mb-2 block">
        {label}
      </Label>

      <div className="relative">
        <Button
          variant="outline"
          className="w-full justify-between text-left font-normal"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="truncate">
            {selectedVehicle
              ? selectedVehicle.displayName
              : `Search vehicle, model or seating...`}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 border bg-white rounded-md shadow-lg">
            <div className="p-3 border-b sticky top-0 bg-white">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search vehicle, model, seating..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                  autoFocus
                />
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {passengerCount && suggestedVehicles.length > 0 && !search && (
                <div className="px-3 py-2 border-b">
                  <p className="text-xs font-semibold text-gray-600 mb-2">
                    Recommended for {passengerCount} passenger{passengerCount !== 1 ? "s" : ""}
                  </p>
                  <div className="space-y-1">
                    {suggestedVehicles.map((vehicle) => (
                      <button
                        key={vehicle._id}
                        onClick={() => {
                          onChange?.(vehicle._id, vehicle.displayName);
                          setIsOpen(false);
                          setSearch("");
                        }}
                        className="w-full text-left px-3 py-2 rounded hover:bg-blue-50 flex items-center justify-between group"
                      >
                        <div>
                          <div className="font-medium text-sm">{vehicle.displayName}</div>
                          <div className="text-xs text-gray-500">{vehicle.vehicleModel}</div>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {vehicle.seatingCapacity} seater
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1 p-2">
                {filteredVehicles.length > 0 ? (
                  filteredVehicles.map((vehicle) => (
                    <button
                      key={vehicle._id}
                      onClick={() => {
                        onChange?.(vehicle._id, vehicle.displayName);
                        setIsOpen(false);
                        setSearch("");
                      }}
                      className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium text-sm">{vehicle.displayName}</div>
                        <div className="text-xs text-gray-600">{vehicle.vehicleModel}</div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {vehicle.seatingCapacity}s
                      </Badge>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-4 text-center text-sm text-gray-500">
                    No vehicles found
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {!isOpen && passengerCount && suggestedVehicles.length > 0 && !selectedVehicle && search === "" && (
        <div className="mt-2 text-xs text-gray-600">
          Suggested: {suggestedVehicles.map((v) => v.displayName).join(", ")}
        </div>
      )}
    </div>
  );
}
