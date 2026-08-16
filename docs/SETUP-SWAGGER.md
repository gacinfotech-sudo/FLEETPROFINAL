# Setting Up Swagger/OpenAPI for FleetPro API

Complete guide for setting up Swagger UI and OpenAPI documentation in the Express backend.

---

## 📦 Step 1: Install Dependencies

Add Swagger packages to your `package.json`:

```bash
npm install swagger-ui-express swagger-jsdoc
npm install --save-dev @types/swagger-ui-express @types/swagger-jsdoc
```

Or manually add to `package.json`:

```json
{
  "dependencies": {
    "swagger-ui-express": "^4.6.3",
    "swagger-jsdoc": "^6.2.8"
  },
  "devDependencies": {
    "@types/swagger-ui-express": "^4.1.3",
    "@types/swagger-jsdoc": "^6.0.0"
  }
}
```

Then run:
```bash
npm install
```

---

## 🔧 Step 2: Configure Swagger in Server

### Option A: Using swagger-setup.ts (Recommended)

Already provided in `docs/swagger-setup.ts`. Just import and use:

**In your `server/index.ts`:**

```typescript
import { setupSwagger } from '../docs/swagger-setup';
import express from 'express';

const app = express();

// ... your middleware and routes ...

// Setup Swagger documentation
setupSwagger(app, '/api-docs');

app.listen(5050, () => {
  console.log('Server running on :5050');
  console.log('Swagger docs: http://localhost:5050/api-docs');
});
```

### Option B: Manual Setup

**In your `server/index.ts`:**

```typescript
import swaggerUi from 'swagger-ui-express';
import express from 'express';
import fs from 'fs';
import path from 'path';

const app = express();

// Load OpenAPI spec
const openapiPath = path.join(__dirname, '../docs/openapi.json');
const openapiSpec = JSON.parse(fs.readFileSync(openapiPath, 'utf-8'));

// Setup Swagger UI
const swaggerUiOptions = {
  customCss: `
    .swagger-ui {
      font-family: sans-serif;
    }
    .topbar {
      background: linear-gradient(90deg, #1976d2 0%, #1565c0 100%);
    }
    .swagger-ui .topbar {
      background: linear-gradient(90deg, #1976d2 0%, #1565c0 100%);
    }
  `,
  swaggerOptions: {
    filter: true,
    showRequestHeaders: true,
    persistAuthorization: true,
    defaultModelsExpandDepth: 1,
    defaultModelExpandDepth: 1,
    tryItOutEnabled: true,
  },
};

// Serve Swagger UI
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(openapiSpec, swaggerUiOptions));

// Serve OpenAPI JSON
app.get('/api-docs/openapi.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(openapiSpec);
});

console.log('✓ Swagger UI available at http://localhost:5050/api-docs');
```

---

## 📋 Step 3: Generate OpenAPI Spec from Code (Optional)

If you want to auto-generate OpenAPI spec from JSDoc comments:

**Install swagger-jsdoc:**

```bash
npm install swagger-jsdoc
```

**Create `docs/swagger-definition.ts`:**

```typescript
import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FleetPro API',
      version: '1.0.0',
      description: 'FleetPro SaaS Platform API',
    },
    servers: [
      {
        url: 'http://localhost:5050/api',
        description: 'Development',
      },
      {
        url: 'https://api.fleetpro.com/api',
        description: 'Production',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: [
    './server/routes.ts',
    './server/routes/*.ts',
  ],
};

const specs = swaggerJsdoc(options);
export default specs;
```

**Document endpoints with JSDoc comments:**

```typescript
/**
 * @swagger
 * /drivers:
 *   get:
 *     summary: List all drivers
 *     tags:
 *       - Drivers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         default: 1
 *     responses:
 *       200:
 *         description: List of drivers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Driver'
 */
app.get('/drivers', (req, res) => {
  // ... handler code
});
```

---

## 🚀 Step 4: Start Server and Access Swagger UI

```bash
npm run dev
```

Then visit:
- **Swagger UI:** http://localhost:5050/api-docs
- **OpenAPI JSON:** http://localhost:5050/api-docs/openapi.json

---

## 📝 Step 5: Configure for Each Environment

### Development (Local)

In `server/index.ts`:
```typescript
setupSwagger(app, '/api-docs');
```

### Production

Use environment variables:

```typescript
if (process.env.NODE_ENV === 'development') {
  setupSwagger(app, '/api-docs');
} else if (process.env.NODE_ENV === 'staging') {
  setupSwagger(app, '/api-docs');
  // Could restrict access with middleware
} else {
  // Production: optional, consider disabling or restricting
  // setupSwagger(app, '/api-docs');
}
```

Or with authentication:

```typescript
const requireApiDocAuth = (req: any, res: any, next: any) => {
  // Check for API key or auth header
  const apiKey = req.query.key;
  if (apiKey === process.env.API_DOCS_KEY) {
    next();
  } else {
    res.status(403).json({ error: 'Unauthorized' });
  }
};

app.use('/api-docs', requireApiDocAuth, swaggerUi.serve);
app.get('/api-docs', requireApiDocAuth, swaggerUi.setup(openapiSpec, swaggerUiOptions));
```

---

## 🎨 Step 6: Customize Swagger UI (Optional)

### Custom CSS

```typescript
const customCss = `
  :root {
    --color-primary: #1976d2;
    --color-secondary: #1565c0;
  }
  
  .swagger-ui {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }
  
  .swagger-ui .topbar {
    background: linear-gradient(90deg, var(--color-primary) 0%, var(--color-secondary) 100%);
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  
  .swagger-ui .info .title {
    color: var(--color-primary);
    font-weight: 600;
  }
  
  .swagger-ui .btn {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    border-radius: 4px;
  }
  
  .swagger-ui .btn:hover {
    background-color: var(--color-secondary);
    border-color: var(--color-secondary);
  }
  
  .swagger-ui .parameter__name {
    color: #d4145a;
    font-weight: bold;
  }
  
  .swagger-ui .model {
    background-color: #f5f5f5;
  }
`;

const swaggerUiOptions = {
  customCss,
};
```

### Custom Favicon and Logo

```typescript
const customCssWithLogo = `
  .swagger-ui .topbar {
    background: linear-gradient(90deg, #1976d2 0%, #1565c0 100%);
  }
  
  .swagger-ui .topbar-wrapper h2 {
    color: white;
  }
`;

const swaggerUiOptions = {
  customCss: customCssWithLogo,
  customSiteTitle: 'FleetPro API Documentation',
};
```

---

## ✅ Step 7: Verification

### Check Swagger UI is Working

1. Start server: `npm run dev`
2. Visit: http://localhost:5050/api-docs
3. You should see:
   - FleetPro API title
   - All endpoints listed
   - Try-it-out functionality
   - Authentication options

### Export OpenAPI Spec

```bash
# Get the spec
curl http://localhost:5050/api-docs/openapi.json > docs/openapi.json

# Validate the spec
npx swagger-cli validate docs/openapi.json

# View in ReDoc
npx redoc-cli serve docs/openapi.json
```

---

## 🔐 Step 8: Secure Swagger Documentation

### Basic Auth

```typescript
import basicAuth from 'express-basic-auth';

const swaggerAuth = basicAuth({
  users: {
    [process.env.SWAGGER_USER || 'admin']: process.env.SWAGGER_PASSWORD || 'admin',
  },
  challenge: true,
});

app.use('/api-docs', swaggerAuth);
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerAuth, swaggerUi.setup(openapiSpec, swaggerUiOptions));
```

### API Key Auth

```typescript
const apiKeyAuth = (req: any, res: any, next: any) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey === process.env.API_DOCS_KEY) {
    next();
  } else {
    res.status(403).json({ error: 'Invalid API Key' });
  }
};

app.use('/api-docs', apiKeyAuth);
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', apiKeyAuth, swaggerUi.setup(openapiSpec, swaggerUiOptions));
```

### Environment-based Access

```typescript
if (process.env.NODE_ENV !== 'production') {
  setupSwagger(app, '/api-docs');
} else {
  // In production, only show to authenticated users
  app.get('/api-docs', requireAuth, swaggerUi.serve);
  app.use('/api-docs', requireAuth, swaggerUi.setup(openapiSpec));
}
```

---

## 📚 Step 9: Update OpenAPI Spec for New Endpoints

When adding new endpoints, update `docs/openapi.json`:

### Manual Update

```json
{
  "paths": {
    "/new-endpoint": {
      "get": {
        "tags": ["Category"],
        "summary": "Endpoint summary",
        "description": "Endpoint description",
        "parameters": [...],
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": { ... }
              }
            }
          }
        }
      }
    }
  }
}
```

### Auto-generate from JSDoc

Add JSDoc comments to your route handlers and regenerate:

```typescript
const specs = swaggerJsdoc(options);
fs.writeFileSync('docs/openapi.json', JSON.stringify(specs, null, 2));
```

---

## 🧪 Step 10: Test with Different Tools

### Postman

```
1. Import > Link > http://localhost:5050/api-docs/openapi.json
2. Auto-imports all endpoints
3. Use built-in authentication
```

### ReDoc

```bash
# Install
npm install -g redoc-cli

# Serve
redoc-cli serve docs/openapi.json
```

### Swagger Editor

```
1. Visit https://editor.swagger.io
2. File > Import URL > http://localhost:5050/api-docs/openapi.json
```

### cURL

```bash
# Get all routes
curl http://localhost:5050/api-docs/openapi.json | jq '.paths | keys'

# Get specific endpoint
curl http://localhost:5050/api-docs/openapi.json | jq '.paths."/drivers"'
```

---

## 📊 Monitoring and Maintenance

### Regular Updates

- Update `docs/openapi.json` when endpoints change
- Keep `docs/swagger-setup.ts` in sync with server
- Test Swagger UI on each deployment
- Monitor API documentation in CI/CD pipeline

### CI/CD Integration

**GitHub Actions Example:**

```yaml
name: Validate OpenAPI Spec

on: [push]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Validate OpenAPI
        run: npx swagger-cli validate docs/openapi.json
      - name: Build Swagger UI
        run: docker build -f Dockerfile.swagger .
```

---

## 🚀 Deployment

### Docker Example

**Dockerfile.swagger:**

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY docs /app/docs
COPY swagger-ui.html /app/

EXPOSE 8080

CMD ["npx", "http-server", "-p", "8080", "-c-1"]
```

### Cloud Deployment

**AWS S3 + CloudFront:**

```bash
# Upload to S3
aws s3 sync docs/ s3://my-bucket/api-docs/

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id DISTRIBUTION_ID \
  --paths "/api-docs/*"
```

**Vercel/Netlify:**

```bash
# Deploy static docs
vercel deploy docs/
```

---

## ✨ Features Enabled

Once Swagger is set up, you get:

✅ Interactive API documentation  
✅ Try-it-out functionality  
✅ Request/response examples  
✅ Schema validation  
✅ Authentication testing  
✅ Parameter documentation  
✅ Error code reference  
✅ OpenAPI spec export  
✅ Auto-generated client libraries  
✅ API documentation search  

---

## 🐛 Troubleshooting

### Swagger UI not showing endpoints

- Verify OpenAPI spec is valid: `npx swagger-cli validate docs/openapi.json`
- Check CORS headers if loading from different domain
- Clear browser cache

### Authentication not working in Swagger

- Make sure bearer token is included in `securitySchemes`
- Check `security` field at path level
- Test with actual token from login endpoint

### OpenAPI spec too large

- Split into multiple files using `$ref`
- Use document generators instead of manual spec
- Consider publishing multiple specs for different API versions

### CORS errors

- Add CORS headers to Swagger endpoint:
```typescript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});
```

---

## 📞 Support

- **Swagger/OpenAPI Docs:** https://swagger.io
- **JSON Schema:** https://json-schema.org
- **OpenAPI Spec:** https://spec.openapis.org
- **ReDoc Documentation:** https://redoc.ly

---

**Last Updated:** August 16, 2026
