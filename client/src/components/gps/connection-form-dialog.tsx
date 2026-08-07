import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useCreateGpsConnection, useUpdateGpsConnection } from './api';
import { KNOWN_PROVIDER_KEYS } from './capabilities';
import type { GpsAuthenticationType, GpsConnection } from './types';

const AUTH_TYPES: Array<{ value: GpsAuthenticationType; label: string }> = [
  { value: 'session_login', label: 'Session login (username/password)' },
  { value: 'basic_authentication', label: 'Basic authentication' },
  { value: 'bearer_token', label: 'Bearer token' },
  { value: 'api_key', label: 'API key' },
  { value: 'oauth_client_credentials', label: 'OAuth client credentials' },
  { value: 'custom_provider_authentication', label: 'Custom' },
];

const USERNAME_PASSWORD_TYPES: GpsAuthenticationType[] = ['session_login', 'basic_authentication'];
const TOKEN_TYPES: GpsAuthenticationType[] = ['bearer_token', 'api_key'];
const OAUTH_TYPES: GpsAuthenticationType[] = ['oauth_client_credentials'];

interface FormState {
  connectionName: string;
  providerKey: string;
  apiBaseUrl: string;
  authenticationType: GpsAuthenticationType;
  pollingIntervalSeconds: string;
  enabled: boolean;
  apiUsername: string;
  apiPassword: string;
  apiToken: string;
  clientId: string;
  clientSecret: string;
}

function emptyForm(): FormState {
  return {
    connectionName: '',
    providerKey: 'traccar',
    apiBaseUrl: '',
    authenticationType: 'session_login',
    pollingIntervalSeconds: '120',
    enabled: true,
    apiUsername: '',
    apiPassword: '',
    apiToken: '',
    clientId: '',
    clientSecret: '',
  };
}

/** Create or edit a GPS provider connection. Calls the existing
 * `/api/gps/connections` POST/PATCH routes only — connection CRUD is
 * TASK-GPS-CONNECTION-02's already-shipped backend, this is purely the
 * form in front of it. Credentials are write-only from this form's point
 * of view: an edit never pre-fills a password/token field with anything
 * (the API only ever returns a masked placeholder for configured fields),
 * so leaving a credential field blank on edit means "keep the existing
 * value", not "clear it" — the backend's PATCH already treats `undefined`
 * fields that way. */
export function ConnectionFormDialog({
  connection,
  open,
  onOpenChange,
}: {
  connection: GpsConnection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const isEdit = Boolean(connection);
  const [form, setForm] = useState<FormState>(() =>
    connection
      ? {
          connectionName: connection.connectionName,
          providerKey: connection.providerKey,
          apiBaseUrl: connection.apiBaseUrl ?? '',
          authenticationType: connection.authenticationType,
          pollingIntervalSeconds: String(connection.pollingIntervalSeconds),
          enabled: connection.enabled,
          apiUsername: '',
          apiPassword: '',
          apiToken: '',
          clientId: '',
          clientSecret: '',
        }
      : emptyForm(),
  );

  const createMutation = useCreateGpsConnection();
  const updateMutation = useUpdateGpsConnection();
  const pending = createMutation.isPending || updateMutation.isPending;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const buildCredentials = () => {
    const credentials: Record<string, string> = {};
    if (USERNAME_PASSWORD_TYPES.includes(form.authenticationType)) {
      if (form.apiUsername.trim()) credentials.apiUsername = form.apiUsername.trim();
      if (form.apiPassword.trim()) credentials.apiPassword = form.apiPassword.trim();
    }
    if (TOKEN_TYPES.includes(form.authenticationType) && form.apiToken.trim()) {
      credentials.apiToken = form.apiToken.trim();
    }
    if (OAUTH_TYPES.includes(form.authenticationType)) {
      if (form.clientId.trim()) credentials.clientId = form.clientId.trim();
      if (form.clientSecret.trim()) credentials.clientSecret = form.clientSecret.trim();
    }
    return credentials;
  };

  const handleSubmit = () => {
    const pollingIntervalSeconds = Number(form.pollingIntervalSeconds) || 120;
    const payload = {
      connectionName: form.connectionName.trim(),
      providerKey: form.providerKey.trim().toLowerCase(),
      apiBaseUrl: form.apiBaseUrl.trim() || undefined,
      authenticationType: form.authenticationType,
      pollingIntervalSeconds,
      enabled: form.enabled,
    };
    const credentials = buildCredentials();

    if (isEdit && connection) {
      updateMutation.mutate(
        { connectionId: connection.id, input: payload },
        {
          onSuccess: () => {
            toast({ title: 'Connection updated' });
            onOpenChange(false);
          },
          onError: (error: any) => toast({ title: 'Update failed', description: error?.message, variant: 'destructive' }),
        },
      );
      return;
    }

    createMutation.mutate(
      { ...payload, credentials: Object.keys(credentials).length ? credentials : undefined },
      {
        onSuccess: () => {
          toast({ title: 'Connection created', description: 'Test the connection, then sync devices.' });
          onOpenChange(false);
        },
        onError: (error: any) => toast({ title: 'Could not create connection', description: error?.message, variant: 'destructive' }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit GPS connection' : 'Add GPS connection'}</DialogTitle>
          <DialogDescription>Connect a GPS/telematics provider account for this tenant.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <Label htmlFor="gps-conn-name">Connection name</Label>
            <Input id="gps-conn-name" value={form.connectionName} onChange={(e) => set('connectionName', e.target.value)} data-testid="gps-conn-name" />
          </div>

          <div>
            <Label htmlFor="gps-conn-provider">Provider</Label>
            <Input
              id="gps-conn-provider"
              value={form.providerKey}
              onChange={(e) => set('providerKey', e.target.value)}
              placeholder="traccar"
              list="gps-known-providers"
              data-testid="gps-conn-provider"
            />
            <datalist id="gps-known-providers">
              {KNOWN_PROVIDER_KEYS.map((key) => <option key={key} value={key} />)}
            </datalist>
            <p className="text-xs text-muted-foreground mt-1">
              Only a provider with a registered adapter (currently: Traccar) can be tested successfully.
            </p>
          </div>

          <div>
            <Label htmlFor="gps-conn-url">API base URL</Label>
            <Input id="gps-conn-url" value={form.apiBaseUrl} onChange={(e) => set('apiBaseUrl', e.target.value)} placeholder="https://your-traccar-server.example.com" data-testid="gps-conn-url" />
          </div>

          <div>
            <Label>Authentication type</Label>
            <Select value={form.authenticationType} onValueChange={(v) => set('authenticationType', v as GpsAuthenticationType)}>
              <SelectTrigger data-testid="gps-conn-auth-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AUTH_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {USERNAME_PASSWORD_TYPES.includes(form.authenticationType) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="gps-conn-username">Username</Label>
                <Input id="gps-conn-username" value={form.apiUsername} onChange={(e) => set('apiUsername', e.target.value)} placeholder={isEdit ? 'Leave blank to keep existing' : ''} />
              </div>
              <div>
                <Label htmlFor="gps-conn-password">Password</Label>
                <Input id="gps-conn-password" type="password" value={form.apiPassword} onChange={(e) => set('apiPassword', e.target.value)} placeholder={isEdit ? 'Leave blank to keep existing' : ''} />
              </div>
            </div>
          )}

          {TOKEN_TYPES.includes(form.authenticationType) && (
            <div>
              <Label htmlFor="gps-conn-token">API token</Label>
              <Input id="gps-conn-token" type="password" value={form.apiToken} onChange={(e) => set('apiToken', e.target.value)} placeholder={isEdit ? 'Leave blank to keep existing' : ''} />
            </div>
          )}

          {OAUTH_TYPES.includes(form.authenticationType) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="gps-conn-client-id">Client ID</Label>
                <Input id="gps-conn-client-id" value={form.clientId} onChange={(e) => set('clientId', e.target.value)} placeholder={isEdit ? 'Leave blank to keep existing' : ''} />
              </div>
              <div>
                <Label htmlFor="gps-conn-client-secret">Client secret</Label>
                <Input id="gps-conn-client-secret" type="password" value={form.clientSecret} onChange={(e) => set('clientSecret', e.target.value)} placeholder={isEdit ? 'Leave blank to keep existing' : ''} />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="gps-conn-interval">Polling interval (seconds)</Label>
            <Input id="gps-conn-interval" type="number" min={30} max={86400} value={form.pollingIntervalSeconds} onChange={(e) => set('pollingIntervalSeconds', e.target.value)} />
          </div>

          <div className="flex items-center justify-between border rounded-md px-3 py-2">
            <div>
              <Label htmlFor="gps-conn-enabled" className="cursor-pointer">Enabled</Label>
              <p className="text-xs text-muted-foreground">Disabled connections are never polled or testable.</p>
            </div>
            <Switch id="gps-conn-enabled" checked={form.enabled} onCheckedChange={(v) => set('enabled', v)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!form.connectionName.trim() || !form.providerKey.trim() || pending} data-testid="gps-conn-submit">
            {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create connection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
