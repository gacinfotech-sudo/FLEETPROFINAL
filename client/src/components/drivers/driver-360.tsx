import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SetDriverPinDialog from "./set-driver-pin-dialog";
import DriverFeedbackProfile from "./driver-feedback-profile";
import DriverContactsPanel from "./driver-contacts-panel";
import DriverDocumentsPanel from "./driver-documents-panel";
import DriverEmploymentHistoryPanel from "./driver-employment-history-panel";
import DriverLifecyclePanel from "./driver-lifecycle-panel";
import DriverAttendanceLeavePanel from "./driver-attendance-leave-panel";
import {
  DEFAULT_LIFECYCLE_STAGE, LIFECYCLE_STAGE_LABELS, lifecycleStageBadgeClass,
  complianceBadgeClass, COMPLIANCE_STATUS_LABELS, documentComplianceStatus,
  maskAadharForDisplay, maskPanForDisplay, type LifecycleStage, type DriverDocumentListView,
} from "./driver-domain-constants";

interface Props {
  driver: any;
  onOpenBooking?: (booking: any) => void;
}

// Real Driver 360° view. Replaces the previous flat modal in dashboard.tsx
// that referenced viewingDriver.age / .licenseType / .licenseExpiry / .notes
// — none of which exist on the Driver schema (confirmed dead UI, see
// docs/driver-research/CURRENT-DRIVER-MODULE-AUDIT.md and
// DRIVER-LIFECYCLE-MANIFEST.md item 6). Resolution, field by field:
//   - age: no replacement field exists anywhere in TASK-DRIVER-DOMAIN-02's
//     shipped model either — removed.
//   - licenseType: same — no "license class" field exists on Driver or on
//     the new DriverDocument model — removed.
//   - licenseExpiry: DOES have a real backing field now — the driving_license
//     DriverDocument's own `expiryDate` (TASK-DRIVER-DOCUMENTS-03) — wired
//     below to that, with compliance-status coloring, instead of removed.
//   - notes: no generic driver-level notes field exists or was added;
//     replaced by the real per-record notes now available on contacts and
//     employment history (see their tabs) — removed as a standalone field.
export default function Driver360({ driver, onOpenBooking }: Props) {
  const driverId = driver._id || driver.id;

  const stageQuery = useQuery<any>({ queryKey: [`/api/drivers/${driverId}/lifecycle-stage`] });
  const documentsQuery = useQuery<any>({ queryKey: [`/api/drivers/${driverId}/documents`] });

  const currentStage: LifecycleStage = stageQuery.data?.lifecycleStage || DEFAULT_LIFECYCLE_STAGE;
  const documents: DriverDocumentListView[] = Array.isArray(documentsQuery.data)
    ? documentsQuery.data
    : (documentsQuery.data?.documents ?? []);
  const licenseDoc = documents.find((d) => d.documentType === "driving_license");

  return (
    <div className="space-y-6 min-w-0">
      {/* Header — Set Login PIN stays directly visible outside any tab, not
          buried behind a click, matching the existing
          pipeline-audit-driver-portal.spec.ts flow. */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-gray-50 rounded-lg min-w-0">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center shrink-0">
          <span className="text-green-600 text-2xl">👤</span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{driver.name}</h2>
          <p className="text-gray-600">{driver.phone}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge variant={driver.status === "available" ? "default" : driver.status === "on_duty" ? "secondary" : "destructive"}>
              {driver.status}
            </Badge>
            {!stageQuery.isError && (
              <Badge variant="outline" className={lifecycleStageBadgeClass(currentStage)}>
                {LIFECYCLE_STAGE_LABELS[currentStage]}
              </Badge>
            )}
          </div>
        </div>
        <div className="sm:ml-auto shrink-0">
          <SetDriverPinDialog driverId={driverId} driverName={driver.name} />
        </div>
      </div>

      <Tabs defaultValue="overview" className="min-w-0">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="w-max">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="employment">Employment</TabsTrigger>
            <TabsTrigger value="attendance-leave">Attendance &amp; Leave</TabsTrigger>
            <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Basic Information</h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Full Name</Label>
                  <p className="text-sm text-gray-900">{driver.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Phone Number</Label>
                  <p className="text-sm text-gray-900">{driver.phone}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Email</Label>
                  <p className="text-sm text-gray-900">{driver.email || "Not provided"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Experience</Label>
                  <p className="text-sm text-gray-900">{driver.experience || "Not provided"} years</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Legacy Manual Rating</Label>
                  <div className="flex items-center">
                    <span className="text-yellow-500">⭐</span>
                    <span className="ml-1 text-sm text-gray-900">{driver.rating ?? "Not rated"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">License Information</h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium text-gray-700">License Number</Label>
                  <p className="text-sm text-gray-900">{driver.licenseNumber || "Not provided"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">License Expiry</Label>
                  {documentsQuery.isError ? (
                    <p className="text-sm text-gray-500">Not available (Documents module not mounted).</p>
                  ) : licenseDoc?.expiryDate ? (
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-900">{new Date(licenseDoc.expiryDate).toLocaleDateString()}</p>
                      <Badge variant="outline" className={complianceBadgeClass(documentComplianceStatus(licenseDoc))}>
                        {COMPLIANCE_STATUS_LABELS[documentComplianceStatus(licenseDoc)]}
                      </Badge>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No driving license document uploaded yet — see the Documents tab.</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Current Status</Label>
                  <Badge variant={driver.status === "available" ? "default" : driver.status === "on_duty" ? "secondary" : "destructive"}>
                    {driver.status}
                  </Badge>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Personal Details</h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Permanent Address</Label>
                  <p className="text-sm text-gray-900">{driver.permanentAddress || "Not provided"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Current Address</Label>
                  <p className="text-sm text-gray-900">{driver.currentAddress || "Not provided"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Marital Status</Label>
                  <p className="text-sm text-gray-900">{driver.maritalStatus || "Not provided"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Date of Joining</Label>
                  <p className="text-sm text-gray-900">
                    {driver.dateOfJoining ? new Date(driver.dateOfJoining).toLocaleDateString() : "Not provided"}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Government Documents</h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Aadhar Number</Label>
                  <p className="text-sm text-gray-900">{maskAadharForDisplay(driver.aadharNumber)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">PAN Number</Label>
                  <p className="text-sm text-gray-900">{maskPanForDisplay(driver.panNumber)}</p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contacts">
          <DriverContactsPanel driverId={driverId} />
        </TabsContent>

        <TabsContent value="documents">
          <DriverDocumentsPanel driverId={driverId} />
        </TabsContent>

        <TabsContent value="employment">
          <DriverEmploymentHistoryPanel driverId={driverId} />
        </TabsContent>

        <TabsContent value="attendance-leave">
          <DriverAttendanceLeavePanel driverId={driverId} />
        </TabsContent>

        <TabsContent value="lifecycle">
          <DriverLifecyclePanel driverId={driverId} />
        </TabsContent>

        <TabsContent value="feedback">
          <DriverFeedbackProfile driverId={driverId} onOpenBooking={onOpenBooking} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
