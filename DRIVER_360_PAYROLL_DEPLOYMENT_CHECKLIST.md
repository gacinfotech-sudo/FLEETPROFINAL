# Driver 360 - Payroll Integration Deployment Checklist

## Pre-Deployment

### Code Review
- [ ] Verify all new files have proper error handling
- [ ] Check TypeScript compilation: `npm run build`
- [ ] Run linter: `npm run lint`
- [ ] Test with sample data locally

### Database
- [ ] Verify MongoDB indexes exist:
  ```bash
  db.driversalarypaymentsyments.getIndexes()
  db.driverattendances.getIndexes()
  ```
- [ ] Check database connectivity from test environment
- [ ] Backup production database

### Environment Variables
- [ ] Verify API endpoints accessible
- [ ] Check WebSocket connection settings (if using)
- [ ] Confirm CORS settings allow frontend

## Deployment Steps

### 1. Backend Deployment
```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Run tests
npm test -- driver-payroll-integration.test.ts

# Build
npm run build

# Deploy to server
npm run start
```

### 2. Frontend Deployment
```bash
# Verify components import correctly
npm run build

# Check bundle size
npm run analyze

# Deploy to CDN/hosting
```

### 3. Database Indexes
```javascript
// Connect to MongoDB and run:
use fleetpro;

// Create indexes for performance
db.driversalarypaymentsyments.createIndex(
  { tenantId: 1, driverId: 1, createdAt: -1 }
);

db.driverattendances.createIndex(
  { tenantId: 1, driverId: 1, date: 1 }
);

db.driveryaadvances.createIndex(
  { tenantId: 1, driverId: 1, status: 1 }
);
```

## Integration Checklist

### API Endpoints
- [ ] GET `/api/drivers/:id/payroll-summary` - Returns 200
- [ ] GET `/api/drivers/:id/payroll-details` - Returns 200
- [ ] GET `/api/drivers/:id/360-with-payroll` - Returns 200
- [ ] Test with curl/Postman:
  ```bash
  curl -H "Authorization: Bearer $TOKEN" \
    http://localhost:5050/api/drivers/[DRIVER_ID]/payroll-summary
  ```

### Frontend Components
- [ ] SalaryCard component renders
- [ ] SalaryDetailsModal opens/closes
- [ ] All data displays correctly
- [ ] Loading states work
- [ ] Error handling displays properly

### Data Validation
- [ ] Calculate sample salary manually
- [ ] Compare with API response
- [ ] Verify payment history shows correct dates
- [ ] Check YTD calculation accuracy

### Performance Tests
- [ ] API response time < 1 second
- [ ] Component render time < 500ms
- [ ] No N+1 queries (check logs)
- [ ] Memory usage stable (no leaks)

## Post-Deployment

### Monitoring
- [ ] Set up alerts for API errors
- [ ] Monitor database query times
- [ ] Check error logs for warnings
- [ ] Monitor WebSocket connections (if enabled)

### Data Verification
- [ ] Verify 10 random drivers have correct calculations
- [ ] Check that YTD calculations match manual audit
- [ ] Verify payment status color coding
- [ ] Confirm payment history is accurate

### User Testing
- [ ] Test with admin account
- [ ] Test with restricted user (limited access)
- [ ] Test on mobile devices
- [ ] Test with slow network (throttle to 3G)

### Documentation
- [ ] Update user guide with new features
- [ ] Add screenshots to documentation
- [ ] Document any custom configurations
- [ ] Share with support team

## Rollback Plan

If issues occur:

### Quick Rollback
```bash
# Revert to previous version
git checkout HEAD~1
npm install
npm run build
npm run start
```

### Database Rollback
```bash
# Restore from backup
mongorestore --uri="mongodb://..." /path/to/backup/
```

### Clear Caches
```bash
# Clear React Query cache
localStorage.clear()
sessionStorage.clear()

# Restart browser/app
```

## Known Issues & Solutions

### Issue: "Payroll data not found"
**Solution**: 
- Verify driver has active salary master
- Check database for DriverSalaryMaster record
- Create salary master if missing

### Issue: API returns 500 error
**Solution**:
- Check server logs for specific error
- Verify database connection
- Check MongoDB indexes

### Issue: Slow API response
**Solution**:
- Verify database indexes exist
- Check for running background jobs
- Monitor server CPU/memory usage

### Issue: Modal doesn't open
**Solution**:
- Check browser console for errors
- Verify Dialog component imported correctly
- Check CSS imports

## Performance Baselines

### API Response Times
- Payroll Summary: < 500ms
- Payroll Details: < 1000ms
- Driver 360 with Payroll: < 2000ms

### Component Metrics
- SalaryCard initial render: < 500ms
- Modal open animation: < 300ms
- Data refresh: < 200ms

### Database Queries
- Payroll aggregation: < 200ms
- Payment history: < 100ms
- YTD calculations: < 150ms

## Feature Flags (Optional)

For gradual rollout, use feature flags:

```typescript
// Environment variables
REACT_APP_ENABLE_PAYROLL_CARD=true
REACT_APP_ENABLE_PAYROLL_MODAL=true
REACT_APP_ENABLE_REALTIME_UPDATES=false  // Enable in phase 2
```

## Success Criteria

✅ All endpoints return correct data
✅ Components render without errors
✅ Calculations match manual audit (100% accuracy)
✅ Payment status colors correct
✅ YTD trends calculate properly
✅ No performance degradation
✅ Error handling works for edge cases
✅ Tests pass (100%)
✅ Documentation complete
✅ Team trained on new features

## Post-Go-Live Monitoring

### Daily (First 7 Days)
- [ ] Check for API errors in logs
- [ ] Verify data consistency
- [ ] Monitor user feedback
- [ ] Track performance metrics

### Weekly (First Month)
- [ ] Audit 10-20 driver salary calculations
- [ ] Review error logs for patterns
- [ ] Check database performance
- [ ] Gather user feedback

### Monthly
- [ ] Complete audit trail review
- [ ] Performance analysis
- [ ] Feature usage statistics
- [ ] Plan optimizations

## Deployment Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Technical Lead | | | |
| QA Lead | | | |
| Product Manager | | | |
| DevOps Lead | | | |

## Support Contacts

- **Technical Issues**: DevOps team Slack
- **Data Issues**: Database admin
- **Feature Questions**: Product team
- **Emergency**: On-call engineer

---

**Deployment Date**: ________________
**Deployed By**: ________________
**Approved By**: ________________
