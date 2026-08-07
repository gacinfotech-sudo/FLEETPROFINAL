import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TabDataList } from "../tab-data-list";

/** Consumes TASK-VEHICLE-COMPLIANCE-02's proposed
 * `GET /api/vehicles/:vehicleId/documents` endpoint. */
export function ComplianceTab({ vehicleId }: { vehicleId: string }) {
  return (
    <TabDataList<any>
      queryKey={[`/api/vehicles/${vehicleId}/documents`]}
      queryFn={async () => {
        const res = await fetch(`/api/vehicles/${vehicleId}/documents`, { credentials: 'include' });
        if (!res.ok) throw new Error('not available');
        return res.json();
      }}
      emptyLabel="No compliance documents recorded yet."
      notYetAvailableLabel="Compliance registry is not yet mounted — see TASK-VEHICLE-COMPLIANCE-02's report for the pending route."
      renderRow={(doc: any) => (
        <Card key={doc._id}>
          <CardContent className="py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{doc.documentType.replace(/_/g, ' ')}</div>
              <div className="text-xs text-muted-foreground">
                {doc.documentNumber ?? 'No number recorded'} · Expires: {doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : 'N/A'}
              </div>
            </div>
            <Badge variant={doc.verificationStatus === 'verified' ? 'default' : 'outline'}>{doc.verificationStatus}</Badge>
          </CardContent>
        </Card>
      )}
    />
  );
}
