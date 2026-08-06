import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Car } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Deliberately not using the staff useAuth()/AuthProvider — a driver
// session is a separate mechanism entirely (server/middleware/driverAuth.ts).
export default function DriverLoginPage() {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !pin) {
      toast({ title: "Enter your phone number and PIN", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/driver-auth/login", { phone, pin });
      await res.json();
      setLocation("/driver");
    } catch (error: any) {
      const raw = String(error?.message || "");
      const jsonStart = raw.indexOf("{");
      let description = "Invalid phone number or PIN";
      if (jsonStart !== -1) {
        try { description = JSON.parse(raw.slice(jsonStart)).message || description; } catch { /* keep default */ }
      }
      toast({ title: "Login Failed", description, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
            <Car className="h-6 w-6 text-white" />
          </div>
          <CardTitle>Driver Login</CardTitle>
          <CardDescription>Enter your registered phone number and PIN.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="driver-phone">Phone Number</Label>
              <Input
                id="driver-phone" type="tel" inputMode="numeric" placeholder="9876543210"
                value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus
              />
            </div>
            <div>
              <Label htmlFor="driver-pin">PIN</Label>
              <Input
                id="driver-pin" type="password" inputMode="numeric" maxLength={6} placeholder="••••"
                value={pin} onChange={(e) => setPin(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </Button>
            <p className="text-xs text-gray-500 text-center">
              Don't have a PIN yet? Ask your office to set one for you.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
