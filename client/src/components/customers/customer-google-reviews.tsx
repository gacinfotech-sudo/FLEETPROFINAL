import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ExternalLink, MessageCircle, Pencil, Send, Star } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const COMPLETED = new Set(['completed', 'payment_pending', 'closed']);

function newRequestId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `review_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function dateInput(value?: string | Date) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function reviewStatus(row?: any) {
  if (row?.reviewReceived) return `${row.reviewRating || '-'}★ received`;
  if (row?.reviewRequested) return 'Requested';
  return 'Not requested';
}

export default function CustomerGoogleReviews({ customerId, bookings }: { customerId: string; bookings: any[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const eligibleBookings = useMemo(() => bookings.filter((booking) => COMPLETED.has(booking.status)), [bookings]);
  const [requestOpen, setRequestOpen] = useState(false);
  const [receiving, setReceiving] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [requestForm, setRequestForm] = useState({ bookingId: '', channel: 'whatsapp', reviewPageUrl: '', confirmedSent: false });
  const [receivedForm, setReceivedForm] = useState({ reviewDate: dateInput(), reviewRating: '5', reviewLink: '', reviewReference: '', responseStatus: 'pending', notes: '', confirmedReceived: false });
  const [editForm, setEditForm] = useState({ reviewPageUrl: '', reviewLink: '', reviewReference: '', reviewRating: '', responseStatus: 'not_required', followUpRequired: false, notes: '' });

  const { data: reviews = [], isLoading } = useQuery<any[]>({ queryKey: [`/api/customers/${customerId}/google-reviews`] });
  const latest = reviews[0];
  const receivedBookingIds = new Set(reviews.filter((review: any) => review.reviewReceived && review.bookingId).map((review: any) => review.bookingId._id || review.bookingId));
  const requestableBookings = eligibleBookings.filter((booking) => !receivedBookingIds.has(booking._id));
  // Not received yet still legitimately doesn't equal "never asked" — a
  // staff member may deliberately follow up again. Rather than hiding an
  // already-requested booking (which would block a real, intended
  // re-request), it's still selectable but visually flagged, so a repeat
  // send is a conscious choice, not an accidental duplicate WhatsApp message.
  const requestedBookingIds = new Set(reviews.filter((review: any) => review.reviewRequested && !review.reviewReceived && review.bookingId).map((review: any) => review.bookingId._id || review.bookingId));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/google-reviews`] });
    queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/messages`] });
    queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/follow-ups`] });
    queryClient.invalidateQueries({ queryKey: ['/api/follow-ups'] });
    queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/timeline`] });
    queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/rewards`] });
    queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}`] });
    queryClient.invalidateQueries({ queryKey: ['/api/customers/segments'] });
    queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
  };

  const requestMutation = useMutation({
    mutationFn: async () => (await apiRequest('POST', `/api/customers/${customerId}/google-reviews/request`, {
      ...requestForm, requestId: newRequestId(), confirmedSent: requestForm.channel === 'whatsapp' ? undefined : requestForm.confirmedSent,
    })).json(),
    onSuccess: (result: any) => {
      toast({ title: result.alreadyProcessed ? 'Review request already recorded' : 'Google review request recorded' });
      setRequestOpen(false); invalidate();
    },
    onError: (error: any) => toast({ title: 'Review request not sent', description: error.message, variant: 'destructive' }),
  });

  const receivedMutation = useMutation({
    mutationFn: async () => (await apiRequest('PUT', `/api/customers/${customerId}/google-reviews/${receiving._id}/received`, {
      ...receivedForm, reviewRating: Number(receivedForm.reviewRating),
    })).json(),
    onSuccess: () => { toast({ title: 'Google review receipt confirmed' }); setReceiving(null); invalidate(); },
    onError: (error: any) => toast({ title: 'Review not confirmed', description: error.message, variant: 'destructive' }),
  });

  const editMutation = useMutation({
    mutationFn: async () => (await apiRequest('PUT', `/api/customers/${customerId}/google-reviews/${editing._id}`, {
      ...editForm, reviewRating: editForm.reviewRating ? Number(editForm.reviewRating) : undefined,
    })).json(),
    onSuccess: () => { toast({ title: 'Google review tracking updated' }); setEditing(null); invalidate(); },
    onError: (error: any) => toast({ title: 'Review tracking not updated', description: error.message, variant: 'destructive' }),
  });

  const addFollowUpMutation = useMutation({
    mutationFn: async (review: any) => (await apiRequest('PUT', `/api/customers/${customerId}/google-reviews/${review._id}`, { followUpRequired: true })).json(),
    onSuccess: () => { toast({ title: 'Google review follow-up added' }); invalidate(); },
    onError: (error: any) => toast({ title: 'Follow-up not added', description: error.message, variant: 'destructive' }),
  });

  const openRequest = () => {
    setRequestForm({ bookingId: requestableBookings[0]?._id || '', channel: 'whatsapp', reviewPageUrl: latest?.reviewPageUrl || '', confirmedSent: false });
    setRequestOpen(true);
  };

  const openReceived = (review: any) => {
    setReceivedForm({ reviewDate: dateInput(), reviewRating: '5', reviewLink: '', reviewReference: '', responseStatus: 'pending', notes: '', confirmedReceived: false });
    setReceiving(review);
  };

  const openEdit = (review: any) => {
    setEditForm({
      reviewPageUrl: review.reviewPageUrl || '', reviewLink: review.reviewLink || '', reviewReference: review.reviewReference || '',
      reviewRating: review.reviewRating ? String(review.reviewRating) : '', responseStatus: review.responseStatus || 'not_required',
      followUpRequired: !!review.followUpRequired, notes: review.notes || '',
    });
    setEditing(review);
  };

  return (
    <Card className="border-amber-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Star className="h-5 w-5 fill-amber-400 text-amber-500" /> Google Review Tracking</CardTitle>
            <p className="text-xs text-gray-500 mt-1">Received status requires staff confirmation plus an actual link or screenshot/reference.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{reviewStatus(latest)}</Badge>
            <Button size="sm" onClick={openRequest} disabled={!requestableBookings.length}><Send className="h-4 w-4 mr-1" /> Send Review Request</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-gray-500">Loading Google review status...</p> : reviews.length === 0 ? (
          <p className="text-sm text-gray-500">No Google review request has been recorded. Requests are available after a completed trip.</p>
        ) : <div className="space-y-3">{reviews.map((review: any) => (
          <div key={review._id} className="rounded-lg border p-3 text-sm space-y-2">
            <div className="flex justify-between gap-3 flex-wrap">
              <div>
                <p className="font-semibold">{review.bookingId?.bookingId || 'Customer-level review'}</p>
                <p className="text-xs text-gray-500">{review.bookingId ? `${review.bookingId.pickupLocation} → ${review.bookingId.dropoffLocation || '-'}` : ''}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge className={review.reviewReceived ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>{reviewStatus(review)}</Badge>
                {review.followUpRequired && <Badge variant="outline" className="border-amber-300 text-amber-700">Follow-up required</Badge>}
                {review.reviewReceived && <Badge variant="outline" className="capitalize">Response: {review.responseStatus?.replace(/_/g, ' ')}</Badge>}
                {review.rewardTransactionId && <Badge className="bg-purple-100 text-purple-800">+{review.rewardTransactionId.points} review reward points</Badge>}
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-2 text-xs text-gray-600">
              <p>Requested: {review.requestDate ? new Date(review.requestDate).toLocaleString('en-IN') : '-'} via {review.requestSentThrough?.replace(/_/g, ' ') || '-'}</p>
              <p>Received: {review.reviewDate ? new Date(review.reviewDate).toLocaleDateString('en-IN') : 'Not confirmed'}</p>
              <p>Evidence: {review.reviewReference || (review.reviewLink ? 'Review link saved' : 'Not added')}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {!review.reviewReceived && <Button size="sm" variant="outline" onClick={() => openReceived(review)}><CheckCircle2 className="h-4 w-4 mr-1" /> Mark Review Received</Button>}
              <Button size="sm" variant="ghost" onClick={() => openEdit(review)}><Pencil className="h-4 w-4 mr-1" /> Add Link / Edit Details</Button>
              {!review.followUpRequired && !review.reviewReceived && <Button size="sm" variant="ghost" onClick={() => addFollowUpMutation.mutate(review)}>Add Follow-up</Button>}
              {(review.reviewLink || review.reviewPageUrl) && <a href={review.reviewLink || review.reviewPageUrl} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost"><ExternalLink className="h-4 w-4 mr-1" /> Open Google Review Page</Button></a>}
            </div>
          </div>
        ))}</div>}
      </CardContent>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Google Review Request</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Completed Booking</Label><Select value={requestForm.bookingId} onValueChange={(value) => setRequestForm({ ...requestForm, bookingId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{requestableBookings.map((booking) => <SelectItem key={booking._id} value={booking._id}>{booking.bookingId} · {booking.pickupLocation} → {booking.dropoffLocation || '-'}{requestedBookingIds.has(booking._id) ? ' (already requested)' : ''}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Request Sent Through</Label><Select value={requestForm.channel} onValueChange={(value) => setRequestForm({ ...requestForm, channel: value, confirmedSent: false })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="sms">SMS</SelectItem><SelectItem value="phone">Phone</SelectItem><SelectItem value="in_person">In person</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
            <div><Label>Google Review Page URL</Label><Input type="url" placeholder="https://g.page/r/.../review" value={requestForm.reviewPageUrl} onChange={(event) => setRequestForm({ ...requestForm, reviewPageUrl: event.target.value })} /></div>
            {requestForm.channel === 'whatsapp' ? <div className="rounded-md bg-green-50 border border-green-100 p-3 text-sm flex gap-2"><MessageCircle className="h-4 w-4 text-green-700 mt-0.5" /> The consent-aware WhatsApp sender will log the message and prevent duplicate processing.</div> : <label className="flex items-center gap-2 text-sm"><Checkbox checked={requestForm.confirmedSent} onCheckedChange={(value) => setRequestForm({ ...requestForm, confirmedSent: !!value })} /> I confirm this request was actually sent through the selected channel.</label>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setRequestOpen(false)}>Cancel</Button><Button disabled={requestMutation.isPending || !requestForm.bookingId || !requestForm.reviewPageUrl || (requestForm.channel !== 'whatsapp' && !requestForm.confirmedSent)} onClick={() => requestMutation.mutate()}>{requestMutation.isPending ? 'Sending...' : requestForm.channel === 'whatsapp' ? 'Send & Record' : 'Record Confirmed Request'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receiving} onOpenChange={(open) => !open && setReceiving(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Google Review Received</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3"><div><Label>Review Date</Label><Input type="date" value={receivedForm.reviewDate} onChange={(event) => setReceivedForm({ ...receivedForm, reviewDate: event.target.value })} /></div><div><Label>Google Rating</Label><Select value={receivedForm.reviewRating} onValueChange={(value) => setReceivedForm({ ...receivedForm, reviewRating: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5].map((rating) => <SelectItem key={rating} value={String(rating)}>{rating} star{rating === 1 ? '' : 's'}</SelectItem>)}</SelectContent></Select></div></div>
            <div><Label>Actual Review Link</Label><Input type="url" value={receivedForm.reviewLink} onChange={(event) => setReceivedForm({ ...receivedForm, reviewLink: event.target.value })} /></div>
            <div><Label>Screenshot / Reference</Label><Input placeholder="Required when no direct review link is available" value={receivedForm.reviewReference} onChange={(event) => setReceivedForm({ ...receivedForm, reviewReference: event.target.value })} /></div>
            <div><Label>Review Response Status</Label><Select value={receivedForm.responseStatus} onValueChange={(value) => setReceivedForm({ ...receivedForm, responseStatus: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Response pending</SelectItem><SelectItem value="responded">Responded</SelectItem><SelectItem value="not_required">No response required</SelectItem></SelectContent></Select></div>
            <div><Label>Notes</Label><Textarea value={receivedForm.notes} onChange={(event) => setReceivedForm({ ...receivedForm, notes: event.target.value })} /></div>
            <label className="flex items-start gap-2 text-sm rounded-md border p-3"><Checkbox checked={receivedForm.confirmedReceived} onCheckedChange={(value) => setReceivedForm({ ...receivedForm, confirmedReceived: !!value })} /><span>I personally verified that this Google review exists and the rating/evidence above is accurate.</span></label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setReceiving(null)}>Cancel</Button><Button disabled={receivedMutation.isPending || !receivedForm.confirmedReceived || (!receivedForm.reviewLink && receivedForm.reviewReference.trim().length < 3)} onClick={() => receivedMutation.mutate()}>Confirm Review Received</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Google Review Tracking</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Google Review Page URL</Label><Input type="url" value={editForm.reviewPageUrl} onChange={(event) => setEditForm({ ...editForm, reviewPageUrl: event.target.value })} /></div>
            <div><Label>Actual Review Link</Label><Input type="url" value={editForm.reviewLink} onChange={(event) => setEditForm({ ...editForm, reviewLink: event.target.value })} /></div>
            <div><Label>Screenshot / Reference</Label><Input value={editForm.reviewReference} onChange={(event) => setEditForm({ ...editForm, reviewReference: event.target.value })} /></div>
            {editing?.reviewReceived && <div className="grid grid-cols-2 gap-3"><div><Label>Rating</Label><Select value={editForm.reviewRating} onValueChange={(value) => setEditForm({ ...editForm, reviewRating: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5].map((rating) => <SelectItem key={rating} value={String(rating)}>{rating} star{rating === 1 ? '' : 's'}</SelectItem>)}</SelectContent></Select></div><div><Label>Response Status</Label><Select value={editForm.responseStatus} onValueChange={(value) => setEditForm({ ...editForm, responseStatus: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="responded">Responded</SelectItem><SelectItem value="not_required">Not required</SelectItem></SelectContent></Select></div></div>}
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={editForm.followUpRequired} onCheckedChange={(value) => setEditForm({ ...editForm, followUpRequired: !!value })} /> Follow-up required</label>
            <div><Label>Notes</Label><Textarea value={editForm.notes} onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button disabled={editMutation.isPending || !editForm.reviewPageUrl} onClick={() => editMutation.mutate()}>Save Review Details</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
