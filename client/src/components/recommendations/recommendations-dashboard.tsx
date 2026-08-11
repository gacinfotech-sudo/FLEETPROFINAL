import { useState, useEffect } from "react";
import {
  Lightbulb,
  TrendingUp,
  Zap,
  Heart,
  Clock,
  DollarSign,
  Award,
  ChevronRight,
  Check,
  X,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface Recommendation {
  id: string;
  customerId: string;
  type: "booking" | "vehicle" | "route" | "driver" | "timing" | "price" | "loyalty";
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  suggestedAction: string;
  confidence: number;
  expectedBenefit: string;
  tags: string[];
  expiresAt: Date;
  createdAt: Date;
}

interface RecommendationsDashboardProps {
  recommendations?: Recommendation[];
  onAccept?: (recId: string) => void;
  onDismiss?: (recId: string) => void;
}

const RECOMMENDATION_ICONS: Record<string, React.ReactNode> = {
  booking: <TrendingUp className="h-5 w-5 text-blue-600" />,
  vehicle: <Award className="h-5 w-5 text-purple-600" />,
  route: <Zap className="h-5 w-5 text-orange-600" />,
  driver: <Heart className="h-5 w-5 text-red-600" />,
  timing: <Clock className="h-5 w-5 text-green-600" />,
  price: <DollarSign className="h-5 w-5 text-emerald-600" />,
  loyalty: <Award className="h-5 w-5 text-amber-600" />,
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-300",
  high: "bg-orange-100 text-orange-800 border-orange-300",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
  low: "bg-gray-100 text-gray-800 border-gray-300",
};

const TYPE_BG_COLORS: Record<string, string> = {
  booking: "bg-blue-50 border-blue-200",
  vehicle: "bg-purple-50 border-purple-200",
  route: "bg-orange-50 border-orange-200",
  driver: "bg-red-50 border-red-200",
  timing: "bg-green-50 border-green-200",
  price: "bg-emerald-50 border-emerald-200",
  loyalty: "bg-amber-50 border-amber-200",
};

export default function RecommendationsDashboard({
  recommendations = [],
  onAccept,
  onDismiss,
}: RecommendationsDashboardProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const filteredRecs = recommendations.filter(
    (rec) =>
      !dismissedIds.has(rec.id) && !acceptedIds.has(rec.id) && (!selectedType || rec.type === selectedType)
  );

  const stats = {
    total: recommendations.length,
    critical: recommendations.filter((r) => r.priority === "critical").length,
    avgConfidence: Math.round(recommendations.reduce((sum, r) => sum + r.confidence, 0) / Math.max(recommendations.length, 1)),
    accepted: acceptedIds.size,
  };

  const handleDismiss = (recId: string) => {
    setDismissedIds((prev) => new Set([...prev, recId]));
    onDismiss?.(recId);
  };

  const handleAccept = (recId: string) => {
    setAcceptedIds((prev) => new Set([...prev, recId]));
    onAccept?.(recId);
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">💡 Recommendations</p>
              <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
              <p className="text-xs text-gray-500 mt-1">personalized for you</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-pink-50 border-red-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">🚨 Critical</p>
              <p className="text-3xl font-bold text-red-600">{stats.critical}</p>
              <p className="text-xs text-gray-500 mt-1">time-sensitive offers</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">🧠 Confidence</p>
              <p className="text-3xl font-bold text-green-600">{stats.avgConfidence}%</p>
              <p className="text-xs text-gray-500 mt-1">avg accuracy</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">✅ Accepted</p>
              <p className="text-3xl font-bold text-purple-600">{stats.accepted}</p>
              <p className="text-xs text-gray-500 mt-1">recommendations used</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={!selectedType ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType(null)}
        >
          All ({recommendations.length})
        </Button>
        <Button
          variant={selectedType === "booking" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType("booking")}
        >
          📅 Booking
        </Button>
        <Button
          variant={selectedType === "vehicle" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType("vehicle")}
        >
          🚗 Vehicle
        </Button>
        <Button
          variant={selectedType === "price" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType("price")}
        >
          💰 Pricing
        </Button>
        <Button
          variant={selectedType === "loyalty" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType("loyalty")}
        >
          ⭐ Loyalty
        </Button>
        <Button
          variant={selectedType === "timing" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType("timing")}
        >
          🕐 Timing
        </Button>
      </div>

      {/* Recommendations List */}
      <div className="space-y-3">
        {filteredRecs.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <Lightbulb className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">
                {dismissedIds.size > 0 ? "No new recommendations at the moment" : "No recommendations yet"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredRecs.map((rec) => {
            const isExpiring =
              new Date().getTime() > new Date(rec.expiresAt).getTime() - 24 * 60 * 60 * 1000;

            return (
              <Card
                key={rec.id}
                className={`border-2 transition-all hover:shadow-lg ${TYPE_BG_COLORS[rec.type]} ${
                  acceptedIds.has(rec.id) ? "opacity-50" : ""
                }`}
              >
                <CardContent className="pt-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="text-2xl mt-1">{RECOMMENDATION_ICONS[rec.type]}</div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
                          {rec.title}
                          {isExpiring && (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={PRIORITY_COLORS[rec.priority]}>
                        {rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1)}
                      </Badge>
                    </div>
                  </div>

                  {/* Confidence Meter */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">Confidence</span>
                      <span className="font-medium">{rec.confidence}%</span>
                    </div>
                    <Progress value={rec.confidence} className="h-1.5" />
                  </div>

                  {/* Expected Benefit */}
                  <div className="mb-4 p-3 bg-white rounded border">
                    <p className="text-xs text-gray-600 font-medium">💰 Expected Benefit</p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">{rec.expectedBenefit}</p>
                  </div>

                  {/* Suggested Action */}
                  <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
                    <p className="text-xs text-gray-600 font-medium">✨ Suggested Action</p>
                    <p className="text-sm text-gray-900 mt-1">{rec.suggestedAction}</p>
                  </div>

                  {/* Tags & Expiry */}
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                    <div className="flex gap-1">
                      {rec.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <span>
                      🕐 Expires: {new Date(rec.expiresAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  {!acceptedIds.has(rec.id) && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleAccept(rec.id)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                        size="sm"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Accept Recommendation
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleDismiss(rec.id)}
                        size="sm"
                        className="flex-1"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Dismiss
                      </Button>
                    </div>
                  )}
                  {acceptedIds.has(rec.id) && (
                    <div className="flex items-center justify-center gap-2 p-2 bg-green-50 rounded border border-green-200">
                      <Check className="h-4 w-4 text-green-600" />
                      <p className="text-sm font-medium text-green-700">Recommendation accepted!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Show Dismissed */}
      {dismissedIds.size > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDismissedIds(new Set())}
          className="w-full text-gray-600"
        >
          Show {dismissedIds.size} dismissed recommendations
        </Button>
      )}

      {/* Bottom CTA */}
      {recommendations.length > 0 && filteredRecs.length > 0 && (
        <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Personalized Just For You</p>
                <p className="text-sm text-blue-100 mt-1">
                  These recommendations are based on your booking history, preferences, and current patterns.
                </p>
              </div>
              <ChevronRight className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
