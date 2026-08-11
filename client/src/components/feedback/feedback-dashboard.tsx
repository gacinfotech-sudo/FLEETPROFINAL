import React, { useState } from "react";
import {
  useGetFeedbackStats,
  useGetPendingModeration,
  useGetReputation,
  useSubmitReview,
  useApproveReview,
  useRejectReview,
  useGetInsights,
  useRespondToReview,
} from "../../hooks/useFeedback";
import { LoadingSpinner } from "../common/LoadingSpinner";

export const FeedbackDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"overview" | "moderation" | "submit" | "insights">(
    "overview"
  );
  const [selectedEntity, setSelectedEntity] = useState("driver_001");
  const [showResponseDialog, setShowResponseDialog] = useState(false);
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [responseText, setResponseText] = useState("");

  const { data: stats, isLoading: statsLoading } = useGetFeedbackStats();
  const { data: pending = [], isLoading: pendingLoading } = useGetPendingModeration();
  const { data: reputation } = useGetReputation(selectedEntity);
  const { data: insights } = useGetInsights("driver", "30d");

  const submitReview = useSubmitReview();
  const approveReview = useApproveReview();
  const rejectReview = useRejectReview();
  const respondToReview = useRespondToReview();

  if (statsLoading || pendingLoading) {
    return <LoadingSpinner />;
  }

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    submitReview.mutate({
      entityId: formData.get("entityId") as string,
      entityType: formData.get("entityType") as "driver" | "service" | "booking",
      rating: parseInt(formData.get("rating") as string) as 1 | 2 | 3 | 4 | 5,
      title: formData.get("title") as string,
      comment: formData.get("comment") as string,
    });
    (e.target as HTMLFormElement).reset();
  };

  const handleApproveReview = (reviewId: string) => {
    approveReview.mutate({ reviewId });
  };

  const handleRejectReview = (reviewId: string) => {
    rejectReview.mutate({
      reviewId,
      reason: "Inappropriate content or violation of guidelines",
    });
  };

  const handleRespondToReview = () => {
    if (!selectedReview || !responseText) return;
    respondToReview.mutate({
      reviewId: selectedReview.reviewId,
      responseText,
    });
    setResponseText("");
    setShowResponseDialog(false);
  };

  const renderStars = (rating: number) => {
    return "⭐".repeat(rating) + "☆".repeat(5 - rating);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Feedback & Review Management
        </h1>
        <span className="px-3 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded-full text-sm font-medium">
          {stats?.totalReviews} Reviews
        </span>
      </div>

      {/* Key Metrics */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Average Rating
            </div>
            <div className="text-3xl font-bold text-blue-600">
              {stats.avgRating}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {renderStars(Math.round(stats.avgRating))}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Published
            </div>
            <div className="text-3xl font-bold text-green-600">
              {stats.publishedReviews}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Pending Moderation
            </div>
            <div className="text-3xl font-bold text-orange-600">
              {stats.pendingModeration}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Response Rate
            </div>
            <div className="text-3xl font-bold text-purple-600">
              {Math.round(stats.responseRate)}%
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700">
        {["overview", "moderation", "submit", "insights"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === tab
                ? "text-purple-600 border-b-2 border-purple-600"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && reputation && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Entity Reputation
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedEntity}
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-blue-600">
                  {reputation.avgRating.toFixed(1)}/5
                </div>
                <div className="text-sm text-gray-600">
                  {renderStars(Math.round(reputation.avgRating))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Total Reviews
                </span>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {reputation.totalReviews}
                </div>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Trust Score
                </span>
                <div className="text-2xl font-bold text-green-600">
                  {reputation.trustScore}/100
                </div>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Response Rate
                </span>
                <div className="text-2xl font-bold text-purple-600">
                  {reputation.responseRate}%
                </div>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Badges
                </span>
                <div className="text-sm font-bold text-gray-900 dark:text-white">
                  {reputation.badges.length}
                </div>
              </div>
            </div>

            {reputation.badges.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Badges
                </h3>
                <div className="flex flex-wrap gap-2">
                  {reputation.badges.map((badge) => (
                    <span
                      key={badge}
                      className="px-3 py-1 bg-gold-100 text-gold-800 dark:bg-gold-900 rounded-full text-sm font-medium"
                    >
                      🏆 {badge.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Rating Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">
              Rating Distribution
            </h3>
            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = reputation.detailedRatings[rating as 1 | 2 | 3 | 4 | 5] || 0;
                const percentage =
                  reputation.totalReviews > 0
                    ? (count / reputation.totalReviews) * 100
                    : 0;
                return (
                  <div key={rating} className="flex items-center gap-3">
                    <div className="w-12 text-sm font-medium text-gray-900 dark:text-white">
                      {rating} ⭐
                    </div>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          rating >= 4
                            ? "bg-green-600"
                            : rating >= 3
                            ? "bg-yellow-600"
                            : "bg-red-600"
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="w-12 text-right text-sm text-gray-600 dark:text-gray-400">
                      {count}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Moderation Tab */}
      {activeTab === "moderation" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-bold text-gray-900 dark:text-white">
              Pending Moderation ({pending.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
            {pending.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No pending reviews
              </div>
            ) : (
              pending.map((mod: any) => (
                <div key={mod.moderationId} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Review from {mod.reviewId}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Flags: {mod.flags.join(", ") || "None"}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        mod.status === "requires_review"
                          ? "bg-red-100 text-red-800 dark:bg-red-900"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900"
                      }`}
                    >
                      {mod.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleApproveReview(mod.reviewId)}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectReview(mod.reviewId)}
                      className="px-3 py-1 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Submit Review Tab */}
      {activeTab === "submit" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 max-w-2xl">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Submit Review
          </h2>
          <form onSubmit={handleSubmitReview} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Entity ID
                </label>
                <input
                  type="text"
                  name="entityId"
                  required
                  placeholder="driver_001"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Entity Type
                </label>
                <select
                  name="entityType"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="driver">Driver</option>
                  <option value="service">Service</option>
                  <option value="booking">Booking</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Rating (1-5)
              </label>
              <select
                name="rating"
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select rating</option>
                <option value="5">5 ⭐ Excellent</option>
                <option value="4">4 ⭐ Good</option>
                <option value="3">3 ⭐ Average</option>
                <option value="2">2 ⭐ Poor</option>
                <option value="1">1 ⭐ Terrible</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Title
              </label>
              <input
                type="text"
                name="title"
                required
                placeholder="Brief review title"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Comment
              </label>
              <textarea
                name="comment"
                required
                rows={5}
                placeholder="Detailed review comment"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
            >
              Submit Review
            </button>
          </form>
        </div>
      )}

      {/* Insights Tab */}
      {activeTab === "insights" && insights && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              30-Day Insights
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-blue-50 dark:bg-blue-900 rounded">
                <span className="text-xs text-blue-600 dark:text-blue-300">
                  Average Rating
                </span>
                <div className="text-2xl font-bold text-blue-600">
                  {insights.avgRating.toFixed(1)}
                </div>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900 rounded">
                <span className="text-xs text-green-600 dark:text-green-300">
                  Total Reviews
                </span>
                <div className="text-2xl font-bold text-green-600">
                  {insights.totalReviews}
                </div>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-900 rounded">
                <span className="text-xs text-purple-600 dark:text-purple-300">
                  Trend
                </span>
                <div className="text-2xl font-bold text-purple-600">
                  {insights.trend === "improving"
                    ? "📈"
                    : insights.trend === "declining"
                    ? "📉"
                    : "➡️"}
                </div>
              </div>
              <div className="p-4 bg-orange-50 dark:bg-orange-900 rounded">
                <span className="text-xs text-orange-600 dark:text-orange-300">
                  Sentiment
                </span>
                <div className="text-2xl font-bold text-orange-600">
                  {insights.sentimentBreakdown.very_positive > 0 ? "😊" : "😐"}
                </div>
              </div>
            </div>

            {insights.recommendations.length > 0 && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Recommendations
                </h3>
                <ul className="space-y-1 text-sm">
                  {insights.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-gray-600 dark:text-gray-300">
                      • {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Response Dialog */}
      {showResponseDialog && selectedReview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 max-w-md">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Respond to Review
            </h2>
            <textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              rows={4}
              placeholder="Your response..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={handleRespondToReview}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
              >
                Send
              </button>
              <button
                onClick={() => setShowResponseDialog(false)}
                className="flex-1 px-4 py-2 bg-gray-400 text-white rounded-lg font-medium hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
