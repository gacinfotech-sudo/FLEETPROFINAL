import { useRef, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Upload, ExternalLink, Lock, CheckCircle2, XCircle } from "lucide-react";
import { useFormAutoSave, FormSubmitStatus } from "@/components/forms/form-enhancements";
import {
  DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_EXPIRY_BEARING,
  COMPLIANCE_STATUS_LABELS, complianceBadgeClass, documentComplianceStatus,
  accessClassificationBadgeClass, type DocumentType, type DriverDocumentListView,
} from "./driver-domain-constants";

interface Props {
  driverId: string;
}

export default function DriverDocumentsPanel({ driverId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType | "">("");
  const [label, setLabel] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const formData = { documentType, label, documentNumber, issueDate, expiryDate };
  const { save: autoSave } = useFormAutoSave("driver-documents-form", formData, 2000);

  useEffect(() => {
    autoSave();
  }, [formData, autoSave]);

  const documentsQuery = useQuery<any>({ queryKey: [`/api/drivers/${driverId}/documents`] });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [`/api/drivers/${driverId}/documents`] });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const file = fileInputRef.current?.files?.[0];
      if (!file) throw new Error("Choose a file to upload.");
      const body = new FormData();
      body.append("file", file);
      body.append("documentType", documentType);
      if (label) body.append("label", label);
      if (documentNumber) body.append("documentNumber", documentNumber);
      if (issueDate) body.append("issueDate", issueDate);
      if (expiryDate) body.append("expiryDate", expiryDate);
      const res = await apiRequest("POST", `/api/drivers/${driverId}/documents`, body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Document uploaded" });
      setDocumentType(""); setLabel(""); setDocumentNumber(""); setIssueDate(""); setExpiryDate("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowUploadForm(false);
      invalidate();
    },
    onError: (err: any) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ documentId, status }: { documentId: string; status: "verified" | "rejected" }) => {
      const reason = status === "rejected" ? window.prompt("Reason for rejection (required):") : undefined;
      if (status === "rejected" && !reason) throw new Error("A reason is required to reject a document.");
      return (await apiRequest("POST", `/api/driver-documents/${documentId}/verify`, { status, reason })).json();
    },
    onSuccess: () => { toast({ title: "Document verification updated" }); invalidate(); },
    onError: (err: any) => toast({ title: "Could not update verification", description: err.message, variant: "destructive" }),
  });

  if (documentsQuery.isLoading) return <p className="text-sm text-gray-500">Loading documents…</p>;
  if (documentsQuery.isError) {
    return (
      <p className="text-sm text-gray-500">
        Documents are not available yet — this feature depends on TASK-DRIVER-DOCUMENTS-03's
        document API and a configured tenant Google Drive connection, neither of which are
        mounted/configured on this server build.
      </p>
    );
  }

  const data = documentsQuery.data;
  const documents: DriverDocumentListView[] = Array.isArray(data) ? data : (data?.documents ?? []);

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> Documents</h3>
          <p className="text-xs text-gray-500">Compliance and expiry status shown per document.</p>
        </div>
        <Button size="sm" onClick={() => setShowUploadForm((v) => !v)} className="w-full sm:w-auto">
          <Upload className="h-4 w-4 mr-1" /> Upload Document
        </Button>
      </div>

      {showUploadForm && (
        <div className="border rounded-lg p-4 space-y-3 bg-gray-50/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Document Type</Label>
              <Select value={documentType} onValueChange={(v) => setDocumentType(v as DocumentType)}>
                <SelectTrigger><SelectValue placeholder="Select document type" /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>File</Label>
              <Input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" />
            </div>
            {documentType === "other" && (
              <div className="sm:col-span-2">
                <Label>Label (required for "Other")</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Human-readable label for this document" />
              </div>
            )}
            <div>
              <Label>Document Number (optional)</Label>
              <Input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} placeholder="Stored encrypted; masked below High tier" />
            </div>
            {documentType && DOCUMENT_TYPE_EXPIRY_BEARING[documentType] && (
              <>
                <div>
                  <Label>Issue Date</Label>
                  <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                </div>
                <div>
                  <Label>Expiry Date</Label>
                  <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
                </div>
              </>
            )}
          </div>
          <FormSubmitStatus
            status={uploadMutation.isPending ? "loading" : uploadMutation.isError ? "error" : "idle"}
            successMessage="Document uploaded successfully"
            errorMessage="Could not upload document"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowUploadForm(false)}>Cancel</Button>
            <Button
              type="button" size="sm"
              disabled={!documentType || (documentType === "other" && !label) || uploadMutation.isPending}
              onClick={() => uploadMutation.mutate()}
            >
              {uploadMutation.isPending ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </div>
      )}

      {documents.length === 0 ? (
        <p className="text-sm text-gray-500">No documents uploaded yet.</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const compliance = documentComplianceStatus(doc);
            return (
              <div key={doc.id} className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium truncate">{DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType}{doc.label ? ` — ${doc.label}` : ""}</p>
                    <Badge variant="outline" className={complianceBadgeClass(compliance)}>{COMPLIANCE_STATUS_LABELS[compliance]}</Badge>
                    <Badge variant="outline" className={accessClassificationBadgeClass(doc.accessClassification)}>{doc.accessClassification} tier</Badge>
                    {!doc.hasFileAccess && <Badge variant="outline" className="flex items-center gap-1"><Lock className="h-3 w-3" /> Restricted</Badge>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {doc.maskedDocumentNumber ? `# ${doc.maskedDocumentNumber} · ` : ""}
                    {doc.expiryDate ? `Expires ${new Date(doc.expiryDate).toLocaleDateString()} · ` : ""}
                    v{doc.currentVersionNumber} ({doc.versionCount} version{doc.versionCount === 1 ? "" : "s"})
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {doc.hasFileAccess && (
                    <a href={`/api/driver-documents/${doc.id}/file`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline"><ExternalLink className="h-4 w-4 mr-1" /> View</Button>
                    </a>
                  )}
                  {doc.verificationStatus === "pending" && (
                    <>
                      <Button size="sm" variant="ghost" title="Verify" onClick={() => verifyMutation.mutate({ documentId: doc.id, status: "verified" })}>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button size="sm" variant="ghost" title="Reject" onClick={() => verifyMutation.mutate({ documentId: doc.id, status: "rejected" })}>
                        <XCircle className="h-4 w-4 text-red-600" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
