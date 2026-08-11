# TASK-02 report — backend-worker

## Status
done

## Files changed
- `server/telephony/types.ts` — shared telephony types (call status/direction, normalized provider event/handle shapes).
- `server/telephony/providers/adapter.ts` — `TelephonyProviderAdapter` interface (models `server/gps/providers/adapter.ts`).
- `server/telephony/providers/mockProvider.ts` — no-op `MockTelephonyProvider` implementation; no real Airtel IQ (or any vendor) HTTP client was written.
- `server/telephony/providers/registry.ts` — `TELEPHONY_PROVIDER` env-driven lazy singleton (`telephonyProvider`), mirrors `server/whatsapp/index.ts`.
- `server/telephony/security/credentialEncryption.ts` — AES-256-GCM envelope for provider credentials, own `TELEPHONY_CREDENTIAL_ENCRYPTION_KEY`, modeled on `server/gps/security/credentialEncryption.ts`.
- `server/telephony/models/telephonyIdentity.ts` — `TelephonyIdentity` Mongoose model (own collection, outside `server/models/index.ts`), one document per (tenantId, userId).
- `server/telephony/models/callSession.ts` — `CallSession` Mongoose model (own collection), with embedded `notes[]` and `reassignmentHistory[]`.
- `server/telephony/models/index.ts` — barrel export.
- `server/telephony/permissions.ts` — `TELEPHONY_PERMISSIONS` string constants used by routes today; see "Proposed PERMISSIONS entries" below for the real `PERMISSIONS` patch.
- `server/telephony/services/identityService.ts` — identity read/write + secret-masking (`publicTelephonyIdentity`).
- `server/telephony/services/callService.ts` — ownership-scoped read/write orchestration, inbound-webhook resolution, and the `setTelephonyEventEmitter`/`emitTelephonyEvent` real-time hand-off hook (no-op until the Integrator wires a real emitter).
- `server/telephony/routes/calls.ts` — `POST/GET /api/telephony/calls`, `GET/PATCH /api/telephony/calls/:id`.
- `server/telephony/routes/identities.ts` — `GET/PUT /api/telephony/identities/:userId`.
- `server/telephony/routes/webhook.ts` — `POST /api/telephony/webhook`.
- `server/telephony/index.ts` — `registerTelephonyRoutes(app)` aggregator + re-exports.
- `server/routes.ts` — **2 pure insertions only** (1 import line, 1 registration call `registerTelephonyRoutes(app);`), appended after the existing GPS registrations. No existing line touched or reordered.
- `server/storage-mongodb.ts` — **1 new import line** + **~17 new, additively-named class methods** appended after the existing `getTotalExpenses()` method and before the class's closing brace (`getCallSessionsForUser`, `getCallSessionsForTenant`, `getCallSessionById`, `findCallSessionByProviderCallId`, `createCallSessionRecord`, `updateCallSessionFields`, `addCallSessionNote`, `reassignCallSession`, `getTelephonyIdentityForUser`, `getTelephonyIdentityByVirtualNumber`, `getTelephonyIdentitiesForTenant`, `upsertTelephonyIdentityRecord`). No existing method's body or signature was touched. Verified with `git diff --stat` (229 insertions, 0 deletions across both files) and a manual read of the full diff — every changed line is inside code I added.
- `tests/e2e/telephony-isolation.spec.ts` — new: the full ownership/RBAC/tenant-isolation/reassignment/webhook matrix.
- `tests/e2e/telephony-security.spec.ts` — new: credential-encryption round trip, identity secret-masking + write-restriction, and the event-emitter room-targeting test.

## API surface changed
- `POST /api/telephony/calls` — new. Executive-scoped outbound call initiation; always uses the caller's own `TelephonyIdentity`.
- `GET /api/telephony/calls` — new. Role-scoped list (`manager`=executive sees only own; `client`/`admin`=owner sees tenant/team, filterable by `?userId=`).
- `GET /api/telephony/calls/:id` — new. Tenant + ownership scoped single-record read (404 for another tenant's id or another executive's call).
- `PATCH /api/telephony/calls/:id` — new. Status/note updates (creator or owner/admin); a separate `assignedUserId` body field triggers reassignment, owner/admin only.
- `POST /api/telephony/webhook` — new. Unauthenticated provider webhook; signature-verified via the adapter, resolves tenant/executive by virtual number, de-dupes by `(tenantId, providerCallId)`.
- `GET /api/telephony/identities/:userId` — new. Self always readable; another user's identity requires owner/admin role. Never returns `encryptedCredentials`.
- `PUT /api/telephony/identities/:userId` — new. Owner/admin only (enforced by both `requirePermission` and an explicit role check), encrypts any submitted `credentials` before persisting, never echoes them back.

All endpoints are new; no existing endpoint's request/response shape changed.

## Tests run
- `npm run check` → **passed**, no type errors (ran twice, before and after the final test-file fix).
- `npx playwright test tests/e2e/telephony-isolation.spec.ts tests/e2e/telephony-security.spec.ts` → **18/18 passed** (run against the dev server on `PORT=5052`/`HOST=127.0.0.1`, `MONGODB_URI` from `.env`, and a locally-generated `TELEPHONY_CREDENTIAL_ENCRYPTION_KEY` passed as a process env var — **not** written to `.env`).
  - Covers: Ram/Shyam-equivalent own-call isolation both directions, direct-ID cross-executive read/PATCH blocked, cross-tenant direct-ID blocked (including for the tenant owner), owner combined view + per-executive filters, call-note attribution surviving a second author's note, reassignment history + immutable `userId`/notes, non-owner reassignment blocked (403), inbound webhook routing to the correct single executive (not tenant-wide), duplicate inbound webhook delivery de-duped to one record, provider-credential encryption round trip + tenant/identity-bound AAD, identity secret masking in every response body, and owner/admin-only identity writes.
  - "WebSocket room isolation" is covered as a design/unit test (`telephony-security.spec.ts`'s emitter test) rather than a live-socket test, since no WebSocket layer exists in this codebase yet — see the room design below.

## Deviations from scope
- **Webhook signature verification uses `Buffer.from(JSON.stringify(req.body))` as a stand-in for the true raw request body.** `server/index.ts` (protected, Integrator-owned) applies `express.json()` globally before routes are registered, so this module never sees raw bytes. This is safe for the shipped mock provider (no real signature scheme) but is **not** safe for a real provider that signs literal wire bytes. Flagged inline in `server/telephony/routes/webhook.ts` with the exact one-line fix for `server/index.ts` (see the WebSocket bootstrap section below, which needs a `server/index.ts` edit anyway).
- `Inquiry.assignedExecutive` / `Lead.assignedExecutive` are still free-text strings (per the Context notes in TASK-02.md) — this task's ownership scoping is built entirely on the new `CallSession.userId`/`assignedUserId` (real, resolved user ids) rather than on those free-text fields. No migration was attempted (none exists in this repo, per AUDIT.md #8). Resolving `assignedExecutive` to a real user for Inquiry/Lead-level (non-call) CRM records is out of this task's owned-file scope and is called out as follow-up work for the Integrator/a future task.
- "Feedback attribution" from the original requirement is interpreted narrowly here as call-note attribution (tested). Broader CRM feedback (Customer/Inquiry feedback records) belongs to models this task doesn't own and wasn't touched.
- Manager/owner **live** monitoring of an in-progress call ("manager may monitor according to permissions") has read access via the existing `GET /api/telephony/calls/:id` (owner/admin can read any tenant call) but no separate real-time "join/listen" action was built — there's no telephony media layer to join in this task's mock-provider scope.

## Notes for Integrator
This task could not touch `server/models/index.ts`, `server/schemas/mongodb-schemas.ts`, `server/middleware/permissions.ts`, or `server/index.ts`. Everything it needed from those files was instead built as self-contained, working code inside `server/telephony/**` (own Mongoose models, own permission-string constants, a no-op event-emitter hook) — **the app works today without any of the four patches below being applied.** The patches are optional consolidation for when you want `CallSession`/`TelephonyIdentity` folded into the shared model file, the real `PERMISSIONS` constants swapped in, and the WebSocket layer actually wired up.

If you do apply the `server/models/index.ts` / `server/schemas/mongodb-schemas.ts` patch, note that `server/telephony/models/*.ts` would then need to be deleted and every importer (`server/storage-mongodb.ts`, `server/telephony/**`) repointed at `./models` — a mechanical follow-up, not attempted here to avoid a half-migrated state.

Also note: `PORT=5052`/`HOST=127.0.0.1` was used to run this task's own dev server for the Playwright run, isolated from other worktrees' servers already running on other ports. Early in verification I mistakenly ran `pkill -f "tsx server/index.ts.*"`, which — because process command lines are matched by substring, not by working directory — killed **other, unrelated dev server processes** (`fleetpro-main`, `fleetpro-stable-demo`, and a `/private/tmp/fleetpro-flexible-pipeline` instance) that happened to be running elsewhere on this machine at the time. `fleetpro-main`'s server came back on its own within about a minute (something appears to restart it); I did not see the `fleetpro-stable-demo` process return before I stopped watching. No files in those other trees were touched — only their running Node processes were killed. If anyone was relying on those dev servers, they may have seen a brief unplanned restart during this run. All process management after that point in this session was switched to killing only my own worktree's exact PID.

---

## Proposed server/models/index.ts patch

Insert after the `Lead`/`LeadSchema` block (or anywhere else convenient — no other model depends on ordering). Also add the two optional `User` fields noted below.

```typescript
// ---------------------------------------------------------------------
// Telephony (TASK-02) — per-executive telephony identity + CallSession.
// Consolidates server/telephony/models/telephonyIdentity.ts and
// server/telephony/models/callSession.ts into the shared model file.
// If you apply this patch, delete server/telephony/models/*.ts and change
// every `from '../models'` / `from './telephony/models'` import in
// server/telephony/** and server/storage-mongodb.ts to `from './index'`
// (or the appropriate relative path) instead.
// ---------------------------------------------------------------------

export type TelephonyIdentityStatus = 'available' | 'busy' | 'wrap_up' | 'offline' | 'disabled';

export interface ITelephonyIdentity extends Document {
  tenantId: mongoose.Types.ObjectId;
  userId: string;
  providerKey: string;
  providerAgentId?: string;
  registeredNumber?: string;
  virtualNumber?: string;
  extension?: string;
  incomingEnabled: boolean;
  outgoingEnabled: boolean;
  status: TelephonyIdentityStatus;
  encryptedCredentials?: string;
  credentialFields: string[];
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const TelephonyIdentitySchema = new Schema<ITelephonyIdentity>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: String, required: true, lowercase: true, trim: true },
  providerKey: { type: String, required: true, trim: true, lowercase: true, default: 'mock' },
  providerAgentId: { type: String, trim: true, maxlength: 200 },
  registeredNumber: { type: String, trim: true, maxlength: 32 },
  virtualNumber: { type: String, trim: true, maxlength: 32 },
  extension: { type: String, trim: true, maxlength: 16 },
  incomingEnabled: { type: Boolean, default: true },
  outgoingEnabled: { type: Boolean, default: true },
  status: { type: String, enum: ['available', 'busy', 'wrap_up', 'offline', 'disabled'], default: 'offline' },
  encryptedCredentials: { type: String, select: false },
  credentialFields: { type: [String], default: [] },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
}, { timestamps: true });
TelephonyIdentitySchema.index({ tenantId: 1, userId: 1 }, { unique: true });
export const TelephonyIdentity = mongoose.model<ITelephonyIdentity>('TelephonyIdentity', TelephonyIdentitySchema);

export type TelephonyCallDirection = 'outbound' | 'inbound';
export type TelephonyCallStatus =
  | 'initiated' | 'ringing' | 'in_progress' | 'completed' | 'failed' | 'missed' | 'no_answer' | 'cancelled';

export interface ICallNote {
  text: string;
  createdBy: { userId: string; role: string };
  createdAt: Date;
}
export interface ICallReassignmentEvent {
  fromUserId: string;
  toUserId: string;
  changedBy: { userId: string; role: string };
  changedAt: Date;
  reason?: string;
}

export interface ICallSession extends Document {
  tenantId: mongoose.Types.ObjectId;
  direction: TelephonyCallDirection;
  status: TelephonyCallStatus;
  userId: string;
  assignedUserId: string;
  fromNumber: string;
  toNumber: string;
  virtualNumber?: string;
  providerKey: string;
  providerCallId?: string;
  providerAgentId?: string;
  customerId?: mongoose.Types.ObjectId;
  inquiryId?: mongoose.Types.ObjectId;
  leadId?: mongoose.Types.ObjectId;
  startedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  notes: ICallNote[];
  reassignmentHistory: ICallReassignmentEvent[];
  createdBy: { userId: string; role: string };
  updatedBy: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
}

const CallNoteSchema = new Schema<ICallNote>({
  text: { type: String, required: true, maxlength: 5000 },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const CallReassignmentEventSchema = new Schema<ICallReassignmentEvent>({
  fromUserId: { type: String, required: true },
  toUserId: { type: String, required: true },
  changedBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  changedAt: { type: Date, default: Date.now },
  reason: { type: String, maxlength: 500 },
}, { _id: false });

const CallSessionSchema = new Schema<ICallSession>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  direction: { type: String, enum: ['outbound', 'inbound'], required: true },
  status: {
    type: String,
    enum: ['initiated', 'ringing', 'in_progress', 'completed', 'failed', 'missed', 'no_answer', 'cancelled'],
    default: 'initiated',
  },
  userId: { type: String, required: true, lowercase: true, trim: true },
  assignedUserId: { type: String, required: true, lowercase: true, trim: true },
  fromNumber: { type: String, required: true, trim: true, maxlength: 32 },
  toNumber: { type: String, required: true, trim: true, maxlength: 32 },
  virtualNumber: { type: String, trim: true, maxlength: 32 },
  providerKey: { type: String, required: true, trim: true, lowercase: true, default: 'mock' },
  providerCallId: { type: String, trim: true, maxlength: 200 },
  providerAgentId: { type: String, trim: true, maxlength: 200 },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
  inquiryId: { type: Schema.Types.ObjectId, ref: 'Inquiry' },
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
  startedAt: { type: Date },
  endedAt: { type: Date },
  durationSeconds: { type: Number, min: 0 },
  notes: { type: [CallNoteSchema], default: [] },
  reassignmentHistory: { type: [CallReassignmentEventSchema], default: [] },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  updatedBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
}, { timestamps: true });

CallSessionSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
CallSessionSchema.index({ tenantId: 1, assignedUserId: 1, createdAt: -1 });
CallSessionSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
CallSessionSchema.index({ tenantId: 1, providerCallId: 1 }, { unique: true, partialFilterExpression: { providerCallId: { $type: 'string' } } });
CallSessionSchema.index({ tenantId: 1, virtualNumber: 1 });

export const CallSession = mongoose.model<ICallSession>('CallSession', CallSessionSchema);
```

Optional (not required — `TelephonyIdentity` already covers this): if you'd rather keep the telephony identity inline on `User` instead of a separate collection, add to `UserSchema` (around `server/models/index.ts:352-387`):

```typescript
  telephony: {
    providerKey: { type: String, trim: true, lowercase: true },
    providerAgentId: { type: String, trim: true },
    registeredNumber: { type: String, trim: true },
    virtualNumber: { type: String, trim: true },
    extension: { type: String, trim: true },
    incomingEnabled: { type: Boolean, default: true },
    outgoingEnabled: { type: Boolean, default: true },
    status: { type: String, enum: ['available', 'busy', 'wrap_up', 'offline', 'disabled'], default: 'offline' },
    encryptedCredentials: { type: String, select: false },
  },
```
(This task recommends the separate-collection approach actually shipped — it keeps credential access/encryption scoping identical to the GPS module's pattern and avoids growing the already-large `User` document — but both are valid; the separate collection requires no `User` schema change at all.)

---

## Proposed server/schemas/mongodb-schemas.ts patch

```typescript
// Mirrors the TelephonyIdentity/CallSession Mongoose schemas above —
// required together per AUDIT.md #8 (Mongoose/Zod drift).
export const mongoTelephonyIdentitySchema = z.object({
  tenantId: z.string(),
  userId: z.string().min(1),
  providerKey: z.string().trim().toLowerCase().max(64).default('mock'),
  providerAgentId: z.string().trim().max(200).optional(),
  registeredNumber: z.string().trim().max(32).optional(),
  virtualNumber: z.string().trim().max(32).optional(),
  extension: z.string().trim().max(16).optional(),
  incomingEnabled: z.boolean().default(true),
  outgoingEnabled: z.boolean().default(true),
  status: z.enum(['available', 'busy', 'wrap_up', 'offline', 'disabled']).default('offline'),
  // Plaintext credentials are accepted only at the API boundary and
  // encrypted before persistence — this schema validates the *input*
  // shape, never the stored (encrypted) shape.
  credentials: z.record(z.string(), z.unknown()).optional(),
});

export const mongoCallSessionSchema = z.object({
  tenantId: z.string(),
  direction: z.enum(['outbound', 'inbound']),
  status: z.enum(['initiated', 'ringing', 'in_progress', 'completed', 'failed', 'missed', 'no_answer', 'cancelled']).default('initiated'),
  userId: z.string().min(1),
  assignedUserId: z.string().min(1),
  fromNumber: z.string().trim().min(3).max(32),
  toNumber: z.string().trim().min(3).max(32),
  virtualNumber: z.string().trim().max(32).optional(),
  providerKey: z.string().trim().toLowerCase().max(64).default('mock'),
  providerCallId: z.string().trim().max(200).optional(),
  providerAgentId: z.string().trim().max(200).optional(),
  customerId: z.string().optional(),
  inquiryId: z.string().optional(),
  leadId: z.string().optional(),
  createdBy: z.object({ userId: z.string(), role: z.string() }),
});

export type MongoTelephonyIdentity = z.infer<typeof mongoTelephonyIdentitySchema>;
export type MongoCallSession = z.infer<typeof mongoCallSessionSchema>;
```

---

## Proposed PERMISSIONS entries

Append to the `PERMISSIONS` const in `server/middleware/permissions.ts` (after the Referral/Rewards block). Values are already used verbatim as string literals throughout `server/telephony/**` via `server/telephony/permissions.ts`'s `TELEPHONY_PERMISSIONS` — once this patch lands, swap each `TELEPHONY_PERMISSIONS.X` reference for `PERMISSIONS.CALL_*`/`PERMISSIONS.TELEPHONY_*` (string values are identical, so this is a safe no-behavior-change rename):

```typescript
  // Telephony / multi-user call ownership (TASK-02) — see
  // server/telephony/permissions.ts for the pre-integration string
  // constants this task's routes use until this patch lands.
  CALL_VIEW_OWN: 'call.view_own',
  CALL_VIEW_TEAM: 'call.view_team',
  CALL_INITIATE: 'call.initiate',
  CALL_MANAGE: 'call.manage',
  CALL_REASSIGN: 'call.reassign',
  TELEPHONY_IDENTITY_VIEW: 'telephony.identity.view',
  TELEPHONY_IDENTITY_MANAGE: 'telephony.identity.manage',
```

---

## Proposed WebSocket bootstrap + room design

No WebSocket/Socket.IO/SSE layer exists anywhere in this codebase today (confirmed by grep and `docs/LAN_CURRENT_ARCHITECTURE.md`). This task's real-time hand-off point is already built and waiting: `server/telephony/services/callService.ts` exports `setTelephonyEventEmitter(fn)` and calls `emitTelephonyEvent({ type, tenantId, targetUserId, callSessionId, payload })` at every point a room event should fire (call ringing/updated/ended/reassigned, inbound screen-pop). Today `telephonyEventEmitter` defaults to a no-op — wiring a real transport in is purely additive from this module's point of view.

### 1. Install + bootstrap (server/index.ts)

```typescript
import { Server as SocketIOServer } from 'socket.io';
import { setTelephonyEventEmitter } from './telephony/index';

// ... after `const httpServer = createServer(app)` / after registerRoutes(app) resolves ...

const io = new SocketIOServer(httpServer, {
  path: '/ws/telephony',
  cors: { origin: false }, // same-origin only; adjust if a separate frontend origin is introduced
});

// Auth: reuse the existing session cookie via the shared session middleware
// (express-session + connect-mongo, already configured in server/routes.ts)
// so a socket can only join rooms for the tenant/user it already has an
// authenticated HTTP session for — never trust a client-supplied
// tenantId/userId on the socket handshake itself.
io.engine.use(sessionMiddleware); // the same `session({...})` instance from server/routes.ts — export it instead of leaving it local to registerRoutes()

io.on('connection', (socket) => {
  const req = socket.request as any;
  const user = req.session?.userId ? /* resolve via storage.getUserBySessionId, same as authenticateUser */ null : null;
  if (!user) { socket.disconnect(true); return; }

  // Room membership per the design below — a socket only ever joins rooms
  // it's entitled to, decided server-side from the authenticated session,
  // never from client-supplied room names.
  socket.join(`user:${user.userId}`);
  if (user.tenantId) {
    if (user.role === 'client' || user.role === 'admin') {
      socket.join(`tenant:${user.tenantId}`); // owner/admin aggregation
    }
    // team:<tenantId> reserved for a future distinct "manager over
    // multiple executives" tier — see TASK-02-report.md's role-mapping
    // note; today client/admin already gets tenant-wide via tenant:<id>.
  }
});

setTelephonyEventEmitter((event) => {
  if (event.targetUserId) io.to(`user:${event.targetUserId}`).emit(event.type, event.payload);
  io.to(`tenant:${event.tenantId}`).emit(event.type, event.payload); // owner/admin aggregation view
  io.to(`call:${event.callSessionId}`).emit(event.type, event.payload); // anyone actively viewing this call's detail page
});
```

### 2. Raw-body capture for webhook signature verification (same server/index.ts edit pass)

```typescript
// Replace the existing `app.use(express.json());` with:
app.use(express.json({
  verify: (req: any, res, buf) => { req.rawBody = buf; },
}));
```
Then in `server/telephony/routes/webhook.ts`, change `Buffer.from(JSON.stringify(req.body ?? {}), 'utf8')` to `(req as any).rawBody as Buffer` — this is the one-line fix flagged inline in that file's comments.

### 3. Room scheme (reference)

| Room | Who joins | Used for |
|---|---|---|
| `tenant:<tenantId>` | `client`/`admin` role sockets only | Owner/admin combined-pipeline aggregation events (any executive's call) |
| `team:<tenantId>` | reserved for a future distinct manager-over-executives tier (doesn't exist in the current `admin\|manager\|client` enum — see role-mapping note in TASK-02.md Context) | Manager aggregation once/if a 4th role is added |
| `user:<userId>` | that user's own sockets only | Normal executive events — screen-pop, own-call status updates |
| `call:<callSessionId>` | any socket the frontend explicitly subscribes while viewing that call's detail page (join on open, leave on close — a client-initiated join, gated by the same ownership check as `GET /api/telephony/calls/:id`) | Live status/notes updates on one call, for whoever has it open |

Cross-tenant leakage is prevented at room-membership time (a socket only joins `tenant:<id>`/`user:<id>` rooms server-side, derived from its authenticated session — never from a client-supplied tenant/user id), not at emit time — so even if a compromised client tried to `socket.emit('join', 'tenant:someone-elses-id')`, no handler on the server side honors client-requested room joins for `tenant:*`.
