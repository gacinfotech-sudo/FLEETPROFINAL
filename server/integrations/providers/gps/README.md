# GPS Provider Integration Hub

Unified GPS tracking, geofencing, and route optimization system for FleetPro. Integrates with multiple GPS providers through a common adapter pattern.

## Features

### 1. Real-Time Vehicle Tracking
- **WebSocket-based tracking**: Live location streaming via WebSocket
- **Multi-vehicle support**: Track multiple vehicles simultaneously
- **Configurable update frequency**: Adjust tracking frequency per vehicle
- **Automatic reconnection**: Built-in reconnect logic with exponential backoff
- **Batch updates**: Intelligent buffering and batch processing

### 2. Geofencing & Alerts
- **Circular geofences**: Simple radius-based boundaries
- **Polygonal geofences**: Complex boundary shapes via ray-casting
- **Entry/exit detection**: Automatic alerts on boundary crossing
- **Per-geofence configuration**: Individual alert settings
- **Event history**: Complete audit trail of geofence events

### 3. Route Optimization
- **Distance optimization**: Nearest-neighbor algorithm
- **Time-based optimization**: Traffic-aware route planning
- **Balanced optimization**: Combined distance and time metrics
- **ML-ready architecture**: Extensible for ML models
- **Caching**: Optimized results cache for repeated queries

### 4. ETA Calculation
- **Real-time ETA**: Based on current location and speed
- **Traffic awareness**: Light/moderate/heavy categorization
- **Polyline generation**: Google-compatible route encoding
- **Speed-aware**: Accounts for current vehicle speed

### 5. Multi-Provider Support
Extensible adapter architecture supporting:
- Google Maps
- Here Maps
- Mapbox
- Telematics Box
- Samsara
- Verizon Connect
- Geotab
- Mock provider for testing

## Architecture

### Component Hierarchy

```
GpsIntegrationHub (Main entry point)
├── GPSAdapter (Base adapter for all providers)
├── RealTimeTracker (WebSocket management)
├── GeofencingEngine (Boundary detection)
└── RouteOptimizationEngine (Path planning)
```

### Universal Hub Pattern

The GPS integration follows the universal adapter pattern:
- **BaseProviderAdapter**: Common interface for all providers
- **Provider-specific adapters**: Implement provider APIs
- **Registry**: Centralized provider management
- **Configuration**: Tenant-scoped, encrypted credentials

## Usage

### 1. Initialize GPS Integration

```typescript
import { GpsIntegrationHub, createGpsProviderRegistry } from '@server/integrations/providers/gps';

// Create registry with connection resolver
const registry = createGpsProviderRegistry(async (tenantId, connectionId) => {
  // Fetch connection config from database
  return db.gpsConnections.findOne({ tenantId, _id: connectionId });
});

// Create hub
const hub = new GpsIntegrationHub(null, registry);
```

### 2. Start Real-Time Tracking

```typescript
// Start tracking session
const tracker = await hub.startTracking(
  'session_123',           // Session ID
  'tenant_456',            // Tenant ID
  'vehicle_789',           // Vehicle ID
  'device_abc',            // Device ID
  'wss://gps.provider.com/ws', // WebSocket URL
  5                        // Update frequency (seconds)
);

// Register location update handler
tracker.onLocationUpdate((telemetry) => {
  console.log('New location:', telemetry.location);
  // Store in database, emit to WebSocket clients, etc.
});

// Register batch update handler
tracker.onBatchUpdate((updates) => {
  console.log(`Batch: ${updates.length} updates`);
  // Process batch of updates
});
```

### 3. Create & Monitor Geofences

```typescript
// Create circular geofence
const geofence = {
  id: 'fence_1',
  tenantId: 'tenant_456',
  name: 'Office Zone',
  type: 'circle',
  center: { latitude: 37.7749, longitude: -122.4194 },
  radius: 500, // 500 meters
  enabled: true,
  alertOnEntry: true,
  alertOnExit: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

hub.addGeofence('tenant_456', geofence);

// Check location
const events = hub.checkLocation(
  'tenant_456',
  'vehicle_789',
  'device_abc',
  { latitude: 37.7750, longitude: -122.4193 }
);

if (events.length > 0) {
  // Handle geofence events
  events.forEach(event => {
    console.log(`${event.eventType} at ${event.timestamp}`);
  });
}
```

### 4. Optimize Routes

```typescript
const originalRoute = {
  id: 'route_1',
  tenantId: 'tenant_456',
  name: 'Delivery Route A',
  startLocation: { latitude: 37.7749, longitude: -122.4194 },
  endLocation: { latitude: 37.8044, longitude: -122.2712 },
  waypoints: [
    { latitude: 37.7850, longitude: -122.2093 },
    { latitude: 37.7900, longitude: -122.2000 },
    // ... more waypoints
  ],
  distanceKm: 25.5,
  durationMinutes: 45,
};

// Optimize by distance
const result = await hub.optimizeRoute(
  'tenant_456',
  originalRoute,
  'distance'
);

console.log(`Original: ${result.originalRoute.distanceKm}km`);
console.log(`Optimized: ${result.optimizedRoute.distanceKm}km`);
console.log(`Savings: ${result.distanceSavingKm}km, ${result.timeSavingMinutes}min`);
```

### 5. Calculate ETA

```typescript
const eta = await hub.calculateETA(
  'tenant_456',
  { latitude: 37.7749, longitude: -122.4194, speedKph: 50 },
  { latitude: 37.8044, longitude: -122.2712 },
  50 // current speed
);

console.log(`Arrival: ${eta.estimatedArrivalTime}`);
console.log(`Distance: ${eta.distanceKm}km`);
console.log(`Duration: ${eta.durationMinutes}min`);
console.log(`Traffic: ${eta.traffic}`);
```

## API Endpoints

### Real-Time Tracking

```
POST /api/gps/tracking/start
{
  "vehicleId": "vehicle_123",
  "deviceId": "device_456",
  "trackingMode": "real_time",
  "updateFrequency": 5
}

POST /api/gps/tracking/:sessionId/stop
GET /api/gps/tracking/:sessionId/status
```

### Geofencing

```
POST /api/gps/geofences
{
  "name": "Office Zone",
  "type": "circle",
  "center": { "latitude": 37.7749, "longitude": -122.4194 },
  "radius": 500
}

GET /api/gps/geofences
GET /api/gps/geofences/:geofenceId
DELETE /api/gps/geofences/:geofenceId
GET /api/gps/geofences/events
```

### Route Optimization

```
POST /api/gps/routes/optimize
{
  "route": { ... },
  "algorithm": "balanced"
}

POST /api/gps/routes/eta
{
  "currentLocation": { ... },
  "destination": { ... }
}
```

## Provider Implementation

### Creating a Custom GPS Provider

```typescript
import { GPSAdapter } from '@server/integrations/providers/gps';

export class MyGpsAdapter extends GPSAdapter {
  constructor(options) {
    super({ ...options, providerType: 'my_provider' });
  }

  async getVehicleLocation(tenantId, data) {
    // Implement provider-specific logic
    const response = await this.makeRequest(
      `${this.config.apiEndpoint}/devices/${data.deviceId}/location`
    );
    
    return this.buildResponse(true, {
      vehicleId: data.vehicleId,
      tenantId,
      location: {
        latitude: response.lat,
        longitude: response.lng,
        timestamp: new Date(),
      },
    });
  }

  async listDevices(tenantId) {
    const devices = await this.makeRequest(
      `${this.config.apiEndpoint}/devices`
    );
    
    return this.buildResponse(true, devices);
  }
}
```

### Register Provider

```typescript
registry.register('my_provider', async (config, region) => {
  return new MyGpsAdapter({
    config,
    tenantContext: { tenantId: config.region },
  });
});
```

## Security & Privacy

### Credential Encryption
- All API credentials encrypted with AES-256-GCM
- Keys derived from master encryption key
- Credentials never logged or exposed

### Tenant Isolation
- All data scoped to tenantId
- No cross-tenant data leakage
- Rate limiting per tenant

### Audit Logging
- Complete audit trail of all operations
- GDPR-compliant data retention
- User action tracking

## Performance Optimization

### Caching
- Route optimization results cached (1000 max entries)
- Automatic cache eviction for old entries
- Configurable TTL per cache type

### Rate Limiting
- Per-tenant rate limits (configurable)
- Backoff strategies for API calls
- Automatic retry with exponential backoff

### Batch Processing
- Location updates buffered and flushed
- Configurable batch sizes
- Reduces database writes

## Monitoring & Debugging

### Health Checks
```typescript
const health = await adapter.testConnection();
console.log(`Provider health: ${health.status}`);
```

### Session Info
```typescript
const sessions = adapter.getActiveTrackingSessions();
sessions.forEach(session => {
  console.log(`Session ${session.id}: ${session.vehicleId}`);
});
```

### Geofence Status
```typescript
const geofences = hub.geofencing.getEngine(tenantId).getGeofences();
console.log(`${geofences.length} active geofences`);
```

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `GpsConnectionNotFoundError` | Connection ID invalid | Verify connection exists |
| `GpsConnectionDisabledError` | Provider disabled | Enable in admin panel |
| `GpsProviderNotRegisteredError` | Provider not registered | Register provider in hub |
| `RateLimitError` | Too many requests | Reduce frequency or increase limit |

### Error Recovery

All adapters support automatic retry with exponential backoff:
- Initial delay: 1 second
- Maximum delay: 64 seconds
- Max retries: 5 attempts
- Configurable per adapter

## Configuration

### Environment Variables
```
GPS_PROVIDER_TYPE=google_maps
GPS_API_KEY=your_api_key
GPS_API_ENDPOINT=https://api.provider.com
GPS_WEBHOOK_SECRET=webhook_secret
GPS_RATE_LIMIT=60
GPS_UPDATE_FREQUENCY=5
```

### Per-Tenant Config
```typescript
const config = {
  providerType: 'google_maps',
  apiKey: process.env.GPS_API_KEY,
  apiEndpoint: process.env.GPS_API_ENDPOINT,
  region: 'us-west-2',
  timeout: 30000,
  retryAttempts: 3,
  rateLimitPerMinute: 60,
  updateFrequency: 5,
};
```

## Testing

### Mock Provider
```typescript
import { MockGpsAdapter } from './mock';

const mockAdapter = new MockGpsAdapter({
  config: { rateLimitPerMinute: 1000 },
  tenantContext: { tenantId: 'test' },
});
```

### Unit Tests
```bash
npm test -- server/integrations/providers/gps
```

## Troubleshooting

### WebSocket Disconnections
- Verify WebSocket URL is correct
- Check firewall/proxy settings
- Review reconnection logs

### Missing Geofence Events
- Verify geofence is enabled
- Check coordinates are in decimal format
- Ensure location update frequency is adequate

### High Latency
- Increase batch size
- Check network connectivity
- Review provider API performance

## Migration Guide

### From Existing GPS Service

```typescript
// Old pattern
const position = await gpsService.getPosition(vehicleId);

// New pattern
const adapter = await registry.getAdapter(tenantId, connectionId);
const position = await adapter.executeAction({
  action: 'get_vehicle_location',
  tenantId,
  data: { vehicleId, deviceId }
});
```

## Future Enhancements

- [ ] ML-based route optimization
- [ ] Traffic prediction integration
- [ ] Advanced polyline encoding
- [ ] Real-time traffic layer
- [ ] Driver behavior analytics
- [ ] Fuel consumption estimation
- [ ] Multi-provider load balancing
- [ ] GraphQL API support

## Support & Contributing

For issues, feature requests, or contributions, please follow the standard FleetPro workflow:
1. Create issue in GitHub
2. Submit PR with tests
3. Get approval from maintainers
4. Merge to main branch

## License

FleetPro Proprietary - All Rights Reserved
