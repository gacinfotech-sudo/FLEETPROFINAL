# 🔍 Search + Sort Component - Implementation Guide

## Overview

A reusable `SearchSortBar` component has been created to add search and sort functionality to all pages in the system.

**File Location:** `client/src/components/shared/search-sort-bar.tsx`

---

## How to Use

### Step 1: Import Component

```typescript
import SearchSortBar from '@/components/shared/search-sort-bar';
```

### Step 2: Add State

```typescript
const [searchQuery, setSearchQuery] = useState('');
const [sortBy, setSortBy] = useState('recent');
```

### Step 3: Create Filter & Sort Logic

```typescript
const filtered = items
  .filter(item => {
    const query = searchQuery.toLowerCase();
    // Your filter logic here
    return item.name?.toLowerCase().includes(query);
  })
  .sort((a, b) => {
    switch (sortBy) {
      case 'recent':
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      case 'oldest':
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      case 'name-asc':
        return (a.name || '').localeCompare(b.name || '');
      case 'name-desc':
        return (b.name || '').localeCompare(a.name || '');
      default:
        return 0;
    }
  });
```

### Step 4: Add Component to JSX

```typescript
<SearchSortBar
  searchPlaceholder="🔍 Search by name, email, status..."
  searchValue={searchQuery}
  onSearchChange={setSearchQuery}
  sortValue={sortBy}
  onSortChange={setSortBy}
  resultCount={filtered.length}
  totalCount={items.length}
  sortOptions={[
    { value: 'recent', label: 'Most Recent' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'name-asc', label: 'Name A-Z' },
    { value: 'name-desc', label: 'Name Z-A' },
  ]}
/>

{/* Then render filtered items */}
{filtered.map(item => (...))}
```

---

## Component Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `searchValue` | string | ✅ | - | Current search input value |
| `onSearchChange` | function | ✅ | - | Callback when search changes |
| `sortValue` | string | ✅ | - | Current sort option |
| `onSortChange` | function | ✅ | - | Callback when sort changes |
| `searchPlaceholder` | string | ❌ | "🔍 Search here..." | Search input placeholder |
| `sortOptions` | array | ❌ | [recent, oldest, name-asc, name-desc] | Available sort options |
| `resultCount` | number | ❌ | - | Number of filtered results |
| `totalCount` | number | ❌ | - | Total number of items |

---

## Pages to Implement

### Admin/Root Pages

- [x] Tenant Management (`/superadmin/tenants`) - ✅ DONE
- [ ] Dashboard (`/superadmin/dashboard`) - TODO
- [ ] Plans (`/superadmin/plans`) - TODO
- [ ] Subscriptions (`/superadmin/subscriptions`) - TODO
- [ ] Billing (`/superadmin/billing`) - TODO
- [ ] User Management (`/superadmin/user-management`) - TODO
- [ ] Audit Logs (`/superadmin/audit-logs`) - TODO
- [ ] Advanced Analytics (`/superadmin/advanced-analytics`) - TODO
- [ ] Revenue Intelligence (`/superadmin/revenue-intelligence`) - TODO

### Tenant Pages

- [ ] Customers (`/customers`) - TODO
- [ ] Bookings (`/bookings`) - TODO
- [ ] Drivers (`/drivers`) - TODO
- [ ] Vehicles (`/vehicles`) - TODO
- [ ] Vendors (`/vendors`) - TODO
- [ ] Finance/Invoices (`/finance`) - TODO
- [ ] Staff/Employees (`/staff`) - TODO
- [ ] Branches (`/branches`) - TODO

---

## Quick Implementation Checklist

For each page, you need to:

1. **Import Component**
   ```typescript
   import SearchSortBar from '@/components/shared/search-sort-bar';
   ```

2. **Add State**
   ```typescript
   const [searchQuery, setSearchQuery] = useState('');
   const [sortBy, setSortBy] = useState('recent');
   ```

3. **Create Sort Logic**
   - Define how each sort option (recent, oldest, name-asc, name-desc) should work
   - Apply to your data array

4. **Add Component to JSX**
   - Place above your list/table
   - Pass all required props
   - Use `filtered` array for rendering

5. **Customize Sort Options** (if needed)
   - Add custom sort fields per page
   - Example for bookings: "Amount High to Low", "Status Pending First"

---

## Sort Options by Page Type

### List Pages (Customers, Drivers, Vehicles)
```javascript
[
  { value: 'recent', label: 'Most Recent' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'name-asc', label: 'Name A-Z' },
  { value: 'name-desc', label: 'Name Z-A' },
]
```

### Financial Pages (Invoices, Payments)
```javascript
[
  { value: 'recent', label: 'Most Recent' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'amount-high', label: 'Amount High to Low' },
  { value: 'amount-low', label: 'Amount Low to High' },
]
```

### Status Pages (Bookings, Requests)
```javascript
[
  { value: 'recent', label: 'Most Recent' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'status-pending', label: 'Pending First' },
  { value: 'status-completed', label: 'Completed First' },
]
```

---

## Features

✅ **Real-time Search**
- Case-insensitive
- Instant filtering
- No delays

✅ **Multiple Sort Options**
- Most Recent (default)
- Oldest First
- Name A-Z / Z-A
- Customizable per page

✅ **Result Counter**
- Shows X of Y items
- Updates with search
- Provides feedback

✅ **Clear Functionality**
- Reset search with ✕ button
- Maintains sorting
- One-click clear

✅ **Responsive Design**
- Mobile friendly
- Flexible layout
- Dropdown for sort options

---

## Implementation Status

| Page | Status | Notes |
|------|--------|-------|
| Tenant Management | ✅ DONE | First implementation |
| Customers | ⏳ TODO | High priority - most used |
| Bookings | ⏳ TODO | High priority - core feature |
| Drivers | ⏳ TODO | Medium priority |
| Vehicles | ⏳ TODO | Medium priority |
| All others | ⏳ TODO | Lower priority |

---

## Next Steps

1. ✅ Component created and deployed
2. ✅ Tenant Management updated (example implementation)
3. ⏳ Add to Customers page
4. ⏳ Add to Bookings page
5. ⏳ Add to Drivers page
6. ⏳ Add to Vehicles page
7. ⏳ Add to remaining pages

---

## Support

For questions or customizations:
- Check the component props documentation above
- Review the Tenant Management implementation as an example
- Customize sort logic for your specific page needs

**Component File:** `client/src/components/shared/search-sort-bar.tsx`
**Example Implementation:** `client/src/pages/superadmin/tenants.tsx`
