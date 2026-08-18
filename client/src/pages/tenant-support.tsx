import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Plus, Send } from "lucide-react";

const CATEGORIES = [
  { value: "bug", label: "🐛 Bug Report" },
  { value: "feature_request", label: "✨ Feature Request" },
  { value: "billing", label: "💳 Billing" },
  { value: "general", label: "❓ General" },
];

const PRIORITIES = [
  { value: "low", label: "🟢 Low" },
  { value: "normal", label: "🟡 Normal" },
  { value: "high", label: "🔴 High" },
  { value: "urgent", label: "🔥 Urgent" },
];

export default function TenantSupportPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [showTicketDetail, setShowTicketDetail] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

  // Form state
  const [formData, setFormData] = useState({
    subject: "",
    message: "",
    category: "general",
    priority: "normal",
  });

  const [replyMessage, setReplyMessage] = useState("");

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["/api/tenant/support-tickets"],
  });

  const createTicketMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/tenant/support-ticket", formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/support-tickets"] });
      setFormData({ subject: "", message: "", category: "general", priority: "normal" });
      setShowNewTicket(false);
      toast({ variant: "success", title: "Ticket created", description: "Our team will respond shortly." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create ticket", description: error.message, variant: "destructive" });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/tenant/support-tickets/${selectedTicket._id}/reply`, {
        message: replyMessage,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/support-tickets"] });
      setReplyMessage("");
      toast({ variant: "success", title: "Reply sent" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to send reply", description: error.message, variant: "destructive" });
    },
  });

  const filteredTickets = tickets.filter((ticket: any) =>
    filterStatus === "all" || ticket.status === filterStatus
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="gradient-header bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">💬 Support Tickets</h1>
            <p className="text-blue-100 mt-1">Get help from our support team • Track your requests</p>
          </div>
          <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
            <DialogTrigger asChild>
              <Button className="bg-white text-blue-600 hover:bg-blue-50 font-semibold">
                <Plus className="w-4 h-4 mr-2" /> New Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Support Ticket</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="subject">Subject *</Label>
                  <Input
                    id="subject"
                    placeholder="Brief description of your issue..."
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category">Category *</Label>
                    <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                      <SelectTrigger id="category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="priority">Priority *</Label>
                    <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                      <SelectTrigger id="priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map(pri => (
                          <SelectItem key={pri.value} value={pri.value}>{pri.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="message">Message *</Label>
                  <Textarea
                    id="message"
                    placeholder="Tell us what you need help with..."
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowNewTicket(false)}>Cancel</Button>
                  <Button
                    onClick={() => createTicketMutation.mutate()}
                    disabled={!formData.subject || !formData.message || createTicketMutation.isPending}
                  >
                    {createTicketMutation.isPending ? "Creating..." : "Create Ticket"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-medium">📊 TOTAL</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">{tickets.length}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-medium">📂 OPEN</p>
            <p className="text-2xl font-bold text-yellow-600 mt-2">
              {tickets.filter((t: any) => t.status === "open").length}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-medium">⏳ IN PROGRESS</p>
            <p className="text-2xl font-bold text-purple-600 mt-2">
              {tickets.filter((t: any) => t.status === "in_progress").length}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-medium">✅ RESOLVED</p>
            <p className="text-2xl font-bold text-green-600 mt-2">
              {tickets.filter((t: any) => t.status === "resolved").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={filterStatus === "all" ? "default" : "outline"}
          onClick={() => setFilterStatus("all")}
          size="sm"
        >
          All
        </Button>
        <Button
          variant={filterStatus === "open" ? "default" : "outline"}
          onClick={() => setFilterStatus("open")}
          size="sm"
        >
          Open
        </Button>
        <Button
          variant={filterStatus === "in_progress" ? "default" : "outline"}
          onClick={() => setFilterStatus("in_progress")}
          size="sm"
        >
          In Progress
        </Button>
        <Button
          variant={filterStatus === "resolved" ? "default" : "outline"}
          onClick={() => setFilterStatus("resolved")}
          size="sm"
        >
          Resolved
        </Button>
      </div>

      {/* Tickets List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse h-20 bg-gray-100 rounded-lg" />
          ))}
        </div>
      ) : filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto opacity-20 mb-2" />
            <p className="font-medium">No support tickets yet</p>
            <p className="text-sm">Need help? Create a support ticket to get in touch with our team!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket: any) => (
            <Card
              key={ticket._id}
              className="cursor-pointer hover:shadow-md transition"
              onClick={() => {
                setSelectedTicket(ticket);
                setShowTicketDetail(true);
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">{ticket.subject}</h4>
                      <Badge variant={
                        ticket.priority === "urgent" ? "destructive" :
                        ticket.priority === "high" ? "default" :
                        "secondary"
                      }>
                        {ticket.priority}
                      </Badge>
                      <Badge variant="outline">{ticket.status}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">{ticket.message}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>🏷️ {ticket.category}</span>
                      <span>💬 {ticket.messages?.length || 0} messages</span>
                      <span>📅 {new Date(ticket.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline">View</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Ticket Detail Dialog */}
      <Dialog open={showTicketDetail} onOpenChange={setShowTicketDetail}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedTicket.subject}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Ticket Info */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-600">Status</p>
                    <Badge className="mt-1">{selectedTicket.status}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Priority</p>
                    <Badge className="mt-1" variant={
                      selectedTicket.priority === "urgent" ? "destructive" : "default"
                    }>
                      {selectedTicket.priority}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Category</p>
                    <p className="text-sm font-medium mt-1 capitalize">{selectedTicket.category}</p>
                  </div>
                </div>

                {/* Messages */}
                <div className="space-y-3 bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <p className="text-sm font-semibold mb-3">Conversation</p>
                  {selectedTicket.messages?.map((msg: any, idx: number) => (
                    <div key={idx} className={`p-3 rounded-lg ${
                      msg.authorRole === "admin"
                        ? "bg-blue-100 border-l-4 border-blue-500"
                        : "bg-gray-100 border-l-4 border-gray-500"
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold">
                          {msg.authorRole === "admin" ? "👨‍💼 Support Team" : "👤 You"}
                        </span>
                        <span className="text-xs text-gray-600">
                          {new Date(msg.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  ))}
                </div>

                {/* Reply Section */}
                {selectedTicket.status !== "closed" && (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Type your reply..."
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      rows={3}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowTicketDetail(false)}>
                        Close
                      </Button>
                      <Button
                        onClick={() => replyMutation.mutate()}
                        disabled={!replyMessage || replyMutation.isPending}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        {replyMutation.isPending ? "Sending..." : "Send Reply"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
