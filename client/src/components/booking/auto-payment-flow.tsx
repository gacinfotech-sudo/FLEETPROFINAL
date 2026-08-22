import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { QrCode, Banknote, Fuel, AlertCircle } from "lucide-react";

interface AutoPaymentFlowProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  bookingTotal: number;
  advanceReceived: number;
}

export default function AutoPaymentFlow({
  isOpen,
  onOpenChange,
  bookingId,
  bookingTotal,
  advanceReceived,
}: AutoPaymentFlowProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState<"qr" | "cash">("qr"); // Auto-select QR
  const [fuelExpense, setFuelExpense] = useState(0);
  const [otherExpense, setOtherExpense] = useState(0);
  const [otherExpenseReason, setOtherExpenseReason] = useState("");
  const [step, setStep] = useState<"method" | "expenses" | "summary">("method");

  const remainingBalance = bookingTotal - advanceReceived;
  const totalExpenses = fuelExpense + otherExpense;
  const finalPaymentDue = remainingBalance - totalExpenses;

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      return (
        await apiRequest("POST", `/api/bookings/${bookingId}/record-payment`, {
          paymentMethod,
          amount: finalPaymentDue,
          fuelExpense,
          otherExpense,
          otherExpenseReason,
          idempotencyKey: `${bookingId}_${Date.now()}`,
        })
      ).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: [`/api/bookings/${bookingId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/operations/payment-dues"] });

      toast({
        title: "✅ Payment Recorded",
        description: `₹${finalPaymentDue} collected via ${paymentMethod.toUpperCase()}`,
        variant: "default",
      });

      setStep("method");
      setFuelExpense(0);
      setOtherExpense(0);
      setOtherExpenseReason("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "❌ Error",
        description: error.message || "Failed to record payment",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600">
            {paymentMethod === "qr" ? (
              <QrCode className="w-5 h-5" />
            ) : (
              <Banknote className="w-5 h-5" />
            )}
            Payment Collection
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* STEP 1: Payment Method Selection */}
          {step === "method" && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="text-sm font-semibold text-blue-900 mb-2">Booking Summary</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Booking</span>
                    <span className="font-bold text-gray-900">₹{bookingTotal.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Advance Received</span>
                    <span className="font-bold text-green-700">-₹{advanceReceived.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="border-t border-blue-200 pt-1 flex justify-between">
                    <span className="font-semibold text-blue-900">Remaining Due</span>
                    <span className="font-bold text-lg text-blue-700">₹{remainingBalance.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold mb-3 block">Select Payment Method</Label>
                <div className="grid grid-cols-2 gap-3">
                  {/* QR Payment - Auto-selected */}
                  <button
                    onClick={() => setPaymentMethod("qr")}
                    className={`p-4 rounded-lg border-2 transition-all text-center ${
                      paymentMethod === "qr"
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 hover:border-blue-400"
                    }`}
                  >
                    <QrCode className={`w-8 h-8 mx-auto mb-2 ${paymentMethod === "qr" ? "text-blue-600" : "text-gray-600"}`} />
                    <p className={`text-sm font-semibold ${paymentMethod === "qr" ? "text-blue-700" : "text-gray-700"}`}>
                      QR Payment
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{paymentMethod === "qr" ? "✓ Selected" : "Recommended"}</p>
                  </button>

                  {/* Cash Payment */}
                  <button
                    onClick={() => setPaymentMethod("cash")}
                    className={`p-4 rounded-lg border-2 transition-all text-center ${
                      paymentMethod === "cash"
                        ? "border-green-600 bg-green-50"
                        : "border-gray-200 hover:border-green-400"
                    }`}
                  >
                    <Banknote className={`w-8 h-8 mx-auto mb-2 ${paymentMethod === "cash" ? "text-green-600" : "text-gray-600"}`} />
                    <p className={`text-sm font-semibold ${paymentMethod === "cash" ? "text-green-700" : "text-gray-700"}`}>
                      Cash
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{paymentMethod === "cash" ? "✓ Selected" : "Manual Entry"}</p>
                  </button>
                </div>
              </div>

              <Button onClick={() => setStep("expenses")} className="w-full bg-blue-600 hover:bg-blue-700">
                Next: Add Expenses
              </Button>
            </div>
          )}

          {/* STEP 2: Expense Tracking */}
          {step === "expenses" && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                <p className="text-sm font-semibold text-amber-900 mb-2">Due Amount</p>
                <p className="text-2xl font-bold text-amber-700">₹{remainingBalance.toLocaleString("en-IN")}</p>
              </div>

              {/* Fuel Expense */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Fuel className="w-4 h-4 text-orange-600" />
                  Driver Fuel Expense
                </Label>
                <Input
                  type="number"
                  value={fuelExpense || ""}
                  onChange={(e) => setFuelExpense(parseFloat(e.target.value) || 0)}
                  placeholder="e.g., 680"
                  className="border-2 border-orange-300 focus:border-orange-500"
                />
                <p className="text-xs text-gray-500">Amount driver spent on fuel</p>
              </div>

              {/* Other Expense */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Other Expense</Label>
                <Input
                  type="number"
                  value={otherExpense || ""}
                  onChange={(e) => setOtherExpense(parseFloat(e.target.value) || 0)}
                  placeholder="e.g., 200"
                  className="border-2 border-gray-300"
                />
                <Input
                  type="text"
                  value={otherExpenseReason}
                  onChange={(e) => setOtherExpenseReason(e.target.value)}
                  placeholder="Reason (e.g., toll, parking)"
                  className="border-2 border-gray-300 mt-2"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep("method")}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={() => setStep("summary")}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  Review Payment
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Payment Summary & Confirmation */}
          {step === "summary" && (
            <div className="space-y-4">
              <Card className="bg-gray-50">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Original Due</span>
                    <span className="font-semibold">₹{remainingBalance.toLocaleString("en-IN")}</span>
                  </div>

                  {fuelExpense > 0 && (
                    <div className="flex justify-between text-orange-700">
                      <span>- Fuel Expense</span>
                      <span className="font-semibold">-₹{fuelExpense.toLocaleString("en-IN")}</span>
                    </div>
                  )}

                  {otherExpense > 0 && (
                    <div className="flex justify-between text-blue-700">
                      <span>- {otherExpenseReason || "Other"}</span>
                      <span className="font-semibold">-₹{otherExpense.toLocaleString("en-IN")}</span>
                    </div>
                  )}

                  <div className="border-t border-gray-300 pt-3 flex justify-between bg-white p-3 rounded">
                    <span className="font-bold text-gray-900">Final Payment Due</span>
                    <span className="font-bold text-lg text-green-700">₹{finalPaymentDue.toLocaleString("en-IN")}</span>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 p-2 rounded flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-800">
                      Payment via <span className="font-bold">{paymentMethod.toUpperCase()}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep("expenses")}
                  className="flex-1"
                >
                  Edit Expenses
                </Button>
                <Button
                  onClick={() => recordPaymentMutation.mutate()}
                  disabled={recordPaymentMutation.isPending || finalPaymentDue <= 0}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {recordPaymentMutation.isPending ? "Recording..." : "Confirm Payment"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
