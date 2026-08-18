import React, { useState } from "react";
import {
  useGetTickets,
  useGetSupportAnalytics,
  useGetAgents,
  useGetFAQs,
  useCreateTicket,
  useAddMessage,
  useResolveTicket,
  useRecordSatisfaction,
} from "../../hooks/useSupport";
import { LoadingSpinner } from "../common/LoadingSpinner";

export const SupportDashboard: React.FC = () => {
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "tickets" | "analytics" | "faqs" | "create"
  >("tickets");
  const [newMessage, setNewMessage] = useState("");
  const [showResolutionDialog, setShowResolutionDialog] = useState(false);
  const [resolutionForm, setResolutionForm] = useState({
    type: "resolved",
    description: "",
    compensationAmount: 0,
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useGetTickets();
  const { data: analytics, isLoading: analyticsLoading } =
    useGetSupportAnalytics();
  const { data: agents = [] } = useGetAgents();
  const { data: faqs = [] } = useGetFAQs();

  const createTicket = useCreateTicket();
  const addMessage = useAddMessage();
  const resolveTicket = useResolveTicket();
  const recordSatisfaction = useRecordSatisfaction();

  const selectedTicketData = tickets.find(
    (t: any) => t.ticketId === selectedTicket
  );

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    createTicket.mutate({
      category: formData.get("category") as string,
      subject: formData.get("subject") as string,
      description: formData.get("description") as string,
    });
    (e.target as HTMLFormElement).reset();
  };

  const handleAddMessage = async () => {
    if (!selectedTicket || !newMessage.trim()) return;
    addMessage.mutate({
      ticketId: selectedTicket,
      content: newMessage,
    });
    setNewMessage("");
  };

  const handleResolveTicket = async () => {
    if (!selectedTicket) return;
    resolveTicket.mutate({
      ticketId: selectedTicket,
      resolutionType: resolutionForm.type,
      description: resolutionForm.description,
      compensation:
        resolutionForm.compensationAmount > 0
          ? { type: "credit", amount: resolutionForm.compensationAmount }
          : undefined,
    });
    setShowResolutionDialog(false);
  };

  const handleRecordSatisfaction = (score: number) => {
    if (!selectedTicket) return;
    recordSatisfaction.mutate({
      ticketId: selectedTicket,
      score,
      comments: "",
    });
  };

  if (ticketsLoading || analyticsLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Support Center
        </h1>
        <span className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full text-sm font-medium">
          {tickets.length} Active Tickets
        </span>
      </div>

      {/* Analytics Overview */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Open Tickets
            </div>
            <div className="text-3xl font-bold text-blue-600">
              {analytics.openTickets}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Resolved
            </div>
            <div className="text-3xl font-bold text-green-600">
              {analytics.resolvedTickets}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Avg Resolution (min)
            </div>
            <div className="text-3xl font-bold text-purple-600">
              {analytics.avgResolutionTime}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Satisfaction
            </div>
            <div className="text-3xl font-bold text-orange-600">
              {analytics.avgSatisfactionScore.toFixed(1)}/5
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              FCR Rate
            </div>
            <div className="text-3xl font-bold text-indigo-600">
              {analytics.firstContactResolutionRate}%
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700">
        {["tickets", "analytics", "faqs", "create"].map((tab) => (
          <button
            key={tab}
            onClick={() =>
              setActiveTab(tab as "tickets" | "analytics" | "faqs" | "create")
            }
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === tab
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tickets Tab */}
      {activeTab === "tickets" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Ticket List */}
          <div className="md:col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-bold text-gray-900 dark:text-white">
                Tickets
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
              {tickets.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  No tickets
                </div>
              ) : (
                tickets.map((ticket: any) => (
                  <div
                    key={ticket.ticketId}
                    onClick={() => setSelectedTicket(ticket.ticketId)}
                    className={`p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      selectedTicket === ticket.ticketId
                        ? "bg-blue-50 dark:bg-blue-900"
                        : ""
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                        {ticket.subject}
                      </h3>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          ticket.priority === "critical"
                            ? "bg-red-100 text-red-800 dark:bg-red-900"
                            : ticket.priority === "high"
                            ? "bg-orange-100 text-orange-800 dark:bg-orange-900"
                            : "bg-green-100 text-green-800 dark:bg-green-900"
                        }`}
                      >
                        {ticket.priority.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Status: {ticket.status}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Ticket Detail */}
          <div className="md:col-span-2">
            {selectedTicketData ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                {/* Ticket Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        {selectedTicketData.subject}
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        #{selectedTicketData.ticketId}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        selectedTicketData.status === "resolved"
                          ? "bg-green-100 text-green-800 dark:bg-green-900"
                          : selectedTicketData.status === "escalated"
                          ? "bg-red-100 text-red-800 dark:bg-red-900"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900"
                      }`}
                    >
                      {selectedTicketData.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Category: {selectedTicketData.category}
                  </p>
                </div>

                {/* Messages */}
                <div className="p-4 max-h-64 overflow-y-auto bg-gray-50 dark:bg-gray-700">
                  <div className="space-y-3">
                    {selectedTicketData.messages.map((msg: any) => (
                      <div key={msg.messageId}>
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-sm text-gray-900 dark:text-white">
                            {msg.senderName}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              msg.sender === "agent"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900"
                                : msg.sender === "customer"
                                ? "bg-gray-100 text-gray-800 dark:bg-gray-700"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-700"
                            }`}
                          >
                            {msg.sender}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 p-2 rounded">
                          {msg.content}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {new Date(msg.sentAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Message Input */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Add a message..."
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    />
                    <button
                      onClick={handleAddMessage}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                    >
                      Send
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                  {selectedTicketData.status !== "resolved" && (
                    <>
                      <button
                        onClick={() => setShowResolutionDialog(true)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                      >
                        Resolve
                      </button>
                      <button className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700">
                        Escalate
                      </button>
                    </>
                  )}
                  {selectedTicketData.status === "resolved" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRecordSatisfaction(80)}
                        className="px-3 py-2 bg-yellow-400 text-white rounded-lg text-sm font-medium hover:bg-yellow-500"
                      >
                        ⭐ Satisfied
                      </button>
                      <button
                        onClick={() => handleRecordSatisfaction(50)}
                        className="px-3 py-2 bg-gray-400 text-white rounded-lg text-sm font-medium hover:bg-gray-500"
                      >
                        😐 Neutral
                      </button>
                      <button
                        onClick={() => handleRecordSatisfaction(20)}
                        className="px-3 py-2 bg-red-400 text-white rounded-lg text-sm font-medium hover:bg-red-500"
                      >
                        😞 Unsatisfied
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500 dark:text-gray-400">
                Select a ticket to view details
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === "analytics" && analytics && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="font-bold text-gray-900 dark:text-white mb-4">
              Top Issue Categories
            </h2>
            <div className="space-y-2">
              {analytics.topIssueCategories.map((cat: any) => (
                <div key={cat.category} className="flex justify-between">
                  <span>{cat.category}</span>
                  <span className="font-bold">{cat.count} tickets</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3">
                Customer Sentiment
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Positive</span>
                  <span className="text-green-600">
                    {analytics.customerSentiment.positive}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Neutral</span>
                  <span className="text-gray-600">
                    {analytics.customerSentiment.neutral}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Negative</span>
                  <span className="text-red-600">
                    {analytics.customerSentiment.negative}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3">
                Agent Performance
              </h3>
              <div className="space-y-2 text-sm">
                {agents.slice(0, 2).map((agent: any) => (
                  <div key={agent.agentId}>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {agent.name}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Rating: {agent.avgSatisfactionScore.toFixed(1)}/5
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAQs Tab */}
      {activeTab === "faqs" && (
        <div className="space-y-3">
          {faqs.map((faq: any) => (
            <div
              key={faq.faqId}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"
            >
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {faq.question}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {faq.answer}
              </p>
              <div className="flex gap-4 mt-2 text-xs text-gray-500">
                <span>✓ {faq.helpfulCount} helpful</span>
                <span>Category: {faq.category}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Ticket Tab */}
      {activeTab === "create" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 max-w-2xl">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Create New Support Ticket
          </h2>
          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Category
              </label>
              <select
                name="category"
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value="payment">Payment Issue</option>
                <option value="booking">Booking Problem</option>
                <option value="driver">Driver Issue</option>
                <option value="ride">Ride Problem</option>
                <option value="account">Account</option>
                <option value="refund">Refund Request</option>
                <option value="safety">Safety Concern</option>
                <option value="complaint">Complaint</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Subject
              </label>
              <input
                type="text"
                name="subject"
                required
                placeholder="Brief description of issue"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Description
              </label>
              <textarea
                name="description"
                required
                rows={5}
                placeholder="Provide detailed information about your issue"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              Create Ticket
            </button>
          </form>
        </div>
      )}

      {/* Resolution Dialog */}
      {showResolutionDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 max-w-md">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Resolve Ticket
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Resolution Type
                </label>
                <select
                  value={resolutionForm.type}
                  onChange={(e) =>
                    setResolutionForm({ ...resolutionForm, type: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="resolved">Resolved</option>
                  <option value="workaround_provided">Workaround Provided</option>
                  <option value="feature_request">Feature Request</option>
                  <option value="duplicate">Duplicate</option>
                  <option value="cannot_help">Cannot Help</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Resolution Description
                </label>
                <textarea
                  value={resolutionForm.description}
                  onChange={(e) =>
                    setResolutionForm({
                      ...resolutionForm,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Compensation Amount (₹)
                </label>
                <input
                  type="number"
                  value={resolutionForm.compensationAmount}
                  onChange={(e) =>
                    setResolutionForm({
                      ...resolutionForm,
                      compensationAmount: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleResolveTicket}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                >
                  Resolve
                </button>
                <button
                  onClick={() => setShowResolutionDialog(false)}
                  className="flex-1 px-4 py-2 bg-gray-400 text-white rounded-lg font-medium hover:bg-gray-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
