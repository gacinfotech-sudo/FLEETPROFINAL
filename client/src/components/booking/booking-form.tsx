import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "../../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar, MapPin, Clock, Car, User, CreditCard, ArrowRight, ArrowLeft, Check, Phone, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useFormAutoSave, FormSubmitStatus } from "@/components/forms/form-enhancements";
import BookingAssistant from "./booking-assistant";
import CustomerAutocomplete from "./customer-autocomplete";

const bookingSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  vehicleId: z.number().optional(),
  driverId: z.number().optional(),
  bookingType: z.enum(["self_drive", "with_driver"]).optional(),
  tripType: z.enum(["one_way", "round_trip", "local", "airport"]).optional(),
  pickupLocation: z.string().optional(),
  dropoffLocation: z.string().optional(),
  pickupDate: z.string().optional(),
  pickupTime: z.string().optional(),
  returnDate: z.string().optional(),
  returnTime: z.string().optional(),
  amount: z.number().optional(),
  notes: z.string().optional(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

interface BookingFormProps {
  onSuccess: () => void;
}

export default function BookingForm({ onSuccess }: BookingFormProps) {
  const [step, setStep] = useState(1);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const totalSteps = 4;

  // Handle customer selection from autocomplete
  const handleCustomerSelect = (customer: any) => {
    setSelectedCustomerId(customer._id);
    form.setValue("customerName", customer.name);
    form.setValue("customerPhone", customer.primaryMobile || customer.phone || "");
    form.setValue("customerEmail", customer.email || "");

    // Auto-fill location if available from last booking
    if (customer.lastBooking) {
      form.setValue("pickupLocation", customer.lastBooking.pickup || "");
      form.setValue("dropoffLocation", customer.lastBooking.drop || "");
    }

    toast({
      title: "✅ Customer selected",
      description: `${customer.name} • ${customer.bookingCount || 0} previous trips`,
    });
  };

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      vehicleId: 0,
      bookingType: "self_drive",
      tripType: "one_way",
      pickupLocation: "",
      dropoffLocation: "",
      pickupDate: "",
      pickupTime: "",
      returnDate: "",
      returnTime: "",
      amount: 0,
      notes: "",
    },
  });

  const watchedValues = form.watch();

  // Fetch available vehicles when dates are selected
  const { data: availableVehicles = [] } = useQuery({
    queryKey: ["/api/vehicles/available", watchedValues.pickupDate, watchedValues.returnDate],
    queryFn: async () => {
      if (!watchedValues.pickupDate || !watchedValues.returnDate) return [];
      const response = await fetch(`/api/vehicles/available?pickupDate=${watchedValues.pickupDate}&returnDate=${watchedValues.returnDate}`);
      if (!response.ok) throw new Error('Failed to fetch available vehicles');
      return response.json();
    },
    enabled: !!(watchedValues.pickupDate && watchedValues.returnDate),
  });

  // Fetch available drivers when needed
  const { data: availableDrivers = [] } = useQuery({
    queryKey: ["/api/drivers/available", watchedValues.pickupDate, watchedValues.returnDate],
    queryFn: async () => {
      if (!watchedValues.pickupDate || !watchedValues.returnDate) return [];
      const response = await fetch(`/api/drivers/available?pickupDate=${watchedValues.pickupDate}&returnDate=${watchedValues.returnDate}`);
      if (!response.ok) throw new Error('Failed to fetch available drivers');
      return response.json();
    },
    enabled: !!(watchedValues.pickupDate && watchedValues.returnDate && watchedValues.bookingType === "with_driver"),
  });

  const createBookingMutation = useMutation({
    mutationFn: async (data: BookingFormData) => {
      const response = await apiRequest("POST", "/api/bookings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Success",
        description: "Booking created successfully",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create booking",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: BookingFormData) => {
    await createBookingMutation.mutateAsync(data);
  };

  const handleDateSelection = () => {
    setStep(2);
  };

  const handleVehicleSelection = (vehicleId: number) => {
    const vehicle = availableVehicles.find((v: any) => v.id === vehicleId);
    if (vehicle) {
      form.setValue("vehicleId", vehicleId);
      
      // Calculate amount based on dates and vehicle rate
      const pickupDate = new Date(watchedValues.pickupDate);
      const returnDate = new Date(watchedValues.returnDate);
      const days = Math.ceil((returnDate.getTime() - pickupDate.getTime()) / (1000 * 60 * 60 * 24));
      const amount = days * parseFloat(vehicle.ratePerDay);
      form.setValue("amount", amount);
      
      setStep(3);
    }
  };

  const stepConfig = [
    { number: 1, title: "Trip Details", icon: MapPin, color: "bg-blue-500" },
    { number: 2, title: "Vehicle & Service", icon: Car, color: "bg-green-500" },
    { number: 3, title: "Customer Info", icon: User, color: "bg-purple-500" },
    { number: 4, title: "Review & Pay", icon: CreditCard, color: "bg-orange-500" }
  ];

  const renderProgressBar = () => (
    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl border border-blue-200 dark:border-blue-700 p-3 md:p-4 mb-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">📝 Create Booking</h2>
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300">Step {step} of {totalSteps}</p>
        </div>
        <div className="flex gap-1">
          {stepConfig.map((config) => (
            <div
              key={config.number}
              className={`h-2 flex-1 rounded-full transition-all ${
                step > config.number ? 'bg-green-500' : step === config.number ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 md:p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <FormField
                    control={form.control}
                    name="pickupDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs md:text-sm">📅 Pickup</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} min={new Date().toISOString().split('T')[0]} className="text-sm h-9 md:h-10" />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="returnDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs md:text-sm">📅 Return</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} min={watchedValues.pickupDate || new Date().toISOString().split('T')[0]} className="text-sm h-9 md:h-10" />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <FormField
                    control={form.control}
                    name="pickupTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs md:text-sm">⏰ Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} className="text-sm h-9 md:h-10" />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="returnTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs md:text-sm">⏰ Return</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} className="text-sm h-9 md:h-10" />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <FormField
                    control={form.control}
                    name="pickupLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs md:text-sm">📍 From</FormLabel>
                        <FormControl>
                          <Input placeholder="Pickup location" {...field} className="text-sm h-9 md:h-10" />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dropoffLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs md:text-sm">📍 To</FormLabel>
                        <FormControl>
                          <Input placeholder="Drop-off location" {...field} className="text-sm h-9 md:h-10" />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <Button
                    size="sm"
                    onClick={handleDateSelection}
                    className="text-xs md:text-sm"
                  >
                    Next <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 md:p-6">
              {availableVehicles.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-600 dark:text-gray-300 text-sm md:text-base">No vehicles available</p>
                  <Button size="sm" variant="outline" onClick={() => setStep(1)} className="mt-3">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Change Dates
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {availableVehicles.map((vehicle: any) => (
                    <div
                      key={vehicle.id}
                      onClick={() => handleVehicleSelection(vehicle.id)}
                      className="p-3 md:p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-200 dark:border-blue-700 cursor-pointer hover:shadow-md hover:border-blue-400 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">
                            {vehicle.make} {vehicle.model}
                          </h3>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{vehicle.registrationNumber}</p>
                        </div>
                        <span className="text-2xl">🚗</span>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="font-bold text-blue-600 dark:text-blue-400 text-sm">₹{vehicle.ratePerDay}/day</span>
                        <Badge className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">✓</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 md:p-6">
              <div className="space-y-3 md:space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="bookingType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs md:text-sm">👤 Type</FormLabel>
                        <FormControl>
                          <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-2 mt-1">
                            <div className="flex items-center space-x-1 flex-1 p-2 border rounded text-xs">
                              <RadioGroupItem value="self_drive" id="self_drive" />
                              <Label htmlFor="self_drive" className="text-xs cursor-pointer">Self</Label>
                            </div>
                            <div className="flex items-center space-x-1 flex-1 p-2 border rounded text-xs">
                              <RadioGroupItem value="with_driver" id="with_driver" />
                              <Label htmlFor="with_driver" className="text-xs cursor-pointer">Driver</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tripType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs md:text-sm">🗺️ Trip</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="text-xs h-9 md:h-10">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="one_way">One Way</SelectItem>
                            <SelectItem value="round_trip">Round</SelectItem>
                            <SelectItem value="local">Local</SelectItem>
                            <SelectItem value="airport">Airport</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                {watchedValues.bookingType === "with_driver" && (
                  <FormField
                    control={form.control}
                    name="driverId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs md:text-sm">🚕 Driver</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                          <FormControl>
                            <SelectTrigger className="text-xs h-9 md:h-10">
                              <SelectValue placeholder="Select driver" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableDrivers.map((driver: any) => (
                              <SelectItem key={driver.id} value={driver.id.toString()}>
                                {driver.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                )}

                <div className="space-y-3">
                  {/* Customer Autocomplete */}
                  <div>
                    <FormLabel className="text-xs md:text-sm block mb-2">👤 Customer (Search by name or phone)</FormLabel>
                    <CustomerAutocomplete
                      value={watchedValues.customerName || ""}
                      onSelect={handleCustomerSelect}
                      placeholder="Type customer name or phone number..."
                      autoFocus={true}
                    />
                  </div>

                  {/* Manual override fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs md:text-sm">Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Name" {...field} className="text-xs h-9 md:h-10" disabled={!!selectedCustomerId} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="customerPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs md:text-sm">📱 Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="Phone" {...field} className="text-xs h-9 md:h-10" disabled={!!selectedCustomerId} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="customerEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs md:text-sm">📧 Email (Optional)</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Email" {...field} className="text-xs h-9 md:h-10" />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs md:text-sm">💰 Amount</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Amount" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value))} className="text-xs h-9 md:h-10" />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs md:text-sm">📝 Notes</FormLabel>
                      <FormControl>
                        <Input placeholder="Notes (optional)" {...field} className="text-xs h-9 md:h-10" />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2 justify-end pt-2">
                  <Button size="sm" variant="outline" onClick={() => setStep(2)} className="text-xs md:text-sm">
                    <ArrowLeft className="w-3 h-3 md:w-4 md:h-4 mr-1" /> Back
                  </Button>
                  <Button
                    size="sm"
                    onClick={form.handleSubmit(onSubmit)}
                    disabled={createBookingMutation.isPending}
                    className="text-xs md:text-sm"
                  >
                    {createBookingMutation.isPending ? "Creating..." : "Create"}
                    <Check className="w-3 h-3 md:w-4 md:h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  // Form auto-save
  const { save: autoSave } = useFormAutoSave("booking-form", form.watch(), 2000);
  useEffect(() => {
    autoSave();
  }, [form.watch(), autoSave]);

  return (
    <Form {...form}>
      <FormSubmitStatus
        status={createBookingMutation.isPending ? "loading" : createBookingMutation.isSuccess ? "success" : createBookingMutation.isError ? "error" : "idle"}
        successMessage="Booking created successfully!"
        errorMessage={(createBookingMutation.error as any)?.message || "Failed to create booking"}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Booking Assistant - Intelligent Guide */}
        <BookingAssistant
          tripType={watchedValues.tripType}
          vehicleSelected={!!watchedValues.vehicleId}
          dateSelected={!!watchedValues.pickupDate && !!watchedValues.returnDate}
          routeSet={!!watchedValues.pickupLocation && !!watchedValues.dropoffLocation}
          priceCalculated={!!watchedValues.amount}
        />
        {/* Progress Steps */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-center overflow-x-auto pb-2">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-max px-4 sm:px-0">
              <div className="flex items-center">
                <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                  step >= 1 ? "bg-blue-600 text-white" : "bg-gray-300 text-gray-600"
                }`}>
                  <span className="text-xs sm:text-sm font-medium">1</span>
                </div>
                <span className="ml-1 sm:ml-2 text-xs sm:text-sm font-medium text-gray-900 whitespace-nowrap">Date Selection</span>
              </div>
              <div className="w-8 sm:w-16 h-0.5 bg-gray-300"></div>
              <div className="flex items-center">
                <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                  step >= 2 ? "bg-blue-600 text-white" : "bg-gray-300 text-gray-600"
                }`}>
                  <span className="text-xs sm:text-sm font-medium">2</span>
                </div>
                <span className="ml-1 sm:ml-2 text-xs sm:text-sm text-gray-600 whitespace-nowrap">Vehicle Selection</span>
              </div>
              <div className="w-8 sm:w-16 h-0.5 bg-gray-300"></div>
              <div className="flex items-center">
                <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                  step >= 3 ? "bg-blue-600 text-white" : "bg-gray-300 text-gray-600"
                }`}>
                  <span className="text-xs sm:text-sm font-medium">3</span>
                </div>
                <span className="ml-1 sm:ml-2 text-xs sm:text-sm text-gray-600 whitespace-nowrap">Customer Info</span>
              </div>
            </div>
          </div>
        </div>

        {renderStep()}
      </div>
    </Form>
  );
}
