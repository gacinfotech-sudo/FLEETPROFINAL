# DRIVER SOURCE AUDIT MATRIX

## Database Collections Search

```bash
mongosh --eval "
db = db.getSiblingDB('fleetpro');
const collections = db.getCollectionNames();
const driver_related = collections.filter(c => c.includes('driver') || c.includes('Driver'));
console.log('Driver-related collections:', driver_related);
"
```

## Mongoose Models
