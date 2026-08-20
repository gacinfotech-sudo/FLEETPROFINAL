import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Search, Phone, MapPin, Calendar, TrendingUp, CheckCircle } from "lucide-react";

interface Customer {
  _id: string;
  name: string;
  phone: string;
  primaryMobile?: string;
  email?: string;
  address?: string;
  city?: string;
  bookingCount?: number;
  lastBooking?: {
    date: string;
    pickup: string;
    drop: string;
    amount: number;
  };
  totalSpent?: number;
  averageAmount?: number;
}

interface CustomerAutocompleteProps {
  value: string;
  onSelect: (customer: Customer) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onPhoneChange?: (phone: string) => void;
}

export default function CustomerAutocomplete({
  value,
  onSelect,
  placeholder = "Enter customer phone number",
  autoFocus = true,
  onPhoneChange,
}: CustomerAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(value || "");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Fetch matching customers - Priority: Phone Number > Name
  const { data: customers = [], isLoading } = useQuery({
    queryKey: [`/api/customers/search?q=${searchQuery}`],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      try {
        const response = await fetch(
          `/api/customers/search?q=${encodeURIComponent(searchQuery)}`
        );
        if (!response.ok) return [];
        const results = await response.json();

        // Sort by phone number match first (EXACT or STARTS WITH)
        if (Array.isArray(results)) {
          return results.sort((a: Customer, b: Customer) => {
            const aPhone = a.phone || a.primaryMobile || "";
            const bPhone = b.phone || b.primaryMobile || "";
            const aExactMatch = aPhone.includes(searchQuery);
            const bExactMatch = bPhone.includes(searchQuery);
            return bExactMatch ? 1 : -1;
          });
        }
        return results;
      } catch (error) {
        console.error("Error fetching customers:", error);
        return [];
      }
    },
    enabled: searchQuery.length >= 2,
  });

  // Auto-select if phone number exactly matches
  useEffect(() => {
    if (customers.length > 0) {
      const phoneMatch = customers.find((c: Customer) => {
        const phone = c.phone || c.primaryMobile || "";
        return phone === searchQuery || phone.endsWith(searchQuery.slice(-10));
      });

      if (phoneMatch) {
        setSelectedCustomer(phoneMatch);
        onPhoneChange?.(phoneMatch.phone || phoneMatch.primaryMobile || "");
      }
    }
  }, [customers, searchQuery, onPhoneChange]);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSearchQuery(customer.phone || customer.primaryMobile || customer.name);
    onSelect(customer);
    setOpen(false);
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          autoFocus={autoFocus}
          className="pl-10 pr-10"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-500" />
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {open && searchQuery.length >= 2 && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 shadow-lg border border-gray-200">
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading customers...</span>
              </div>
            ) : customers.length > 0 ? (
              <div className="divide-y">
                {customers.map((customer) => (
                  <button
                    key={customer._id}
                    onClick={() => handleSelectCustomer(customer)}
                    className={`w-full p-3 text-left hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors border-l-4 ${
                      selectedCustomer?._id === customer._id ? 'border-blue-600 bg-blue-50' : 'border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {/* Phone Number (PRIMARY) */}
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <span className="font-bold text-gray-900 dark:text-white text-lg">
                            {customer.phone || customer.primaryMobile}
                          </span>
                          {selectedCustomer?._id === customer._id && (
                            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                          )}
                        </div>

                        {/* Customer Name */}
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {customer.name}
                        </div>

                        {/* Last Booking Info */}
                        {customer.lastBooking && (
                          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-2 rounded">
                            <div className="flex items-center gap-1 mb-1">
                              <Calendar className="w-3 h-3" />
                              <span className="font-medium">Last: {new Date(customer.lastBooking.date).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {customer.lastBooking.pickup} → {customer.lastBooking.drop}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Customer Stats */}
                      <div className="text-right whitespace-nowrap flex flex-col gap-1">
                        {customer.bookingCount !== undefined && (
                          <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                            {customer.bookingCount} trips
                          </div>
                        )}
                        {customer.totalSpent !== undefined && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                            ₹{customer.totalSpent?.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                No customers found
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Selected Customer Info Card */}
      {selectedCustomer && !open && (
        <Card className="mt-2 p-4 bg-green-50 dark:bg-green-950/20 border-2 border-green-300 dark:border-green-800">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-bold text-gray-900 dark:text-white text-lg">
                  {selectedCustomer.name}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <Phone className="w-4 h-4" />
                  {selectedCustomer.phone || selectedCustomer.primaryMobile}
                </div>
              </div>
            </div>

            {/* Past Booking Details */}
            {selectedCustomer.lastBooking && (
              <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">📋 Last Booking:</p>
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1 ml-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    {new Date(selectedCustomer.lastBooking.date).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3" />
                    {selectedCustomer.lastBooking.pickup} → {selectedCustomer.lastBooking.drop}
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-3 h-3" />
                    Amount: ₹{selectedCustomer.lastBooking.amount?.toLocaleString()}
                  </div>
                </div>
              </div>
            )}

            {/* Customer Stats */}
            <div className="flex gap-3 mt-2 pt-2 border-t border-green-200 dark:border-green-800">
              <div className="text-xs">
                <div className="font-semibold text-gray-700 dark:text-gray-300">{selectedCustomer.bookingCount || 0}</div>
                <div className="text-gray-500 dark:text-gray-400">Total Trips</div>
              </div>
              <div className="text-xs">
                <div className="font-semibold text-gray-700 dark:text-gray-300">₹{selectedCustomer.totalSpent?.toLocaleString() || '0'}</div>
                <div className="text-gray-500 dark:text-gray-400">Total Spent</div>
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Click field to change customer
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
