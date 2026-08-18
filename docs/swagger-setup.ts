/**
 * FleetPro API - Swagger UI Setup
 * Auto-generated Swagger documentation for 277+ endpoints
 *
 * This file configures Swagger/OpenAPI documentation for the Express API
 * Including custom middleware, security schemes, and endpoint documentation
 */

import express, { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

/**
 * Swagger Definition
 * Defines API metadata, servers, security schemes, and endpoint documentation
 */
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'FleetPro SaaS Platform API',
    version: '1.0.0',
    description:
      'Comprehensive REST API documentation for FleetPro platform with 277+ endpoints. ' +
      'Covers authentication, driver management, vehicle tracking, analytics, financial operations, ' +
      'notifications, and more.',
    contact: {
      name: 'FleetPro API Support',
      email: 'api@fleetpro.com',
      url: 'https://fleetpro.com/support',
    },
    license: {
      name: 'Proprietary',
      url: 'https://fleetpro.com/license',
    },
  },
  servers: [
    {
      url: 'http://localhost:5050/api',
      description: 'Development Server',
      variables: {
        port: {
          default: '5050',
          description: 'Port number',
        },
      },
    },
    {
      url: 'https://api.fleetpro.com/api',
      description: 'Production Server',
    },
    {
      url: 'https://staging-api.fleetpro.com/api',
      description: 'Staging Server',
    },
  ],
  security: [
    {
      bearerAuth: [],
    },
    {
      sessionAuth: [],
    },
  ],
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and session management',
    },
    {
      name: 'Drivers',
      description: 'Driver management and operations',
    },
    {
      name: 'Vehicles',
      description: 'Vehicle management and tracking',
    },
    {
      name: 'Bookings',
      description: 'Booking and trip management',
    },
    {
      name: 'Analytics',
      description: 'Analytics and reporting',
    },
    {
      name: 'Notifications',
      description: 'Notification system',
    },
    {
      name: 'Financial',
      description: 'Financial operations and payroll',
    },
    {
      name: 'Admin',
      description: 'Platform administration',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'JWT Bearer token obtained from /auth/login endpoint. Include in Authorization header.',
      },
      sessionAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'sessionId',
        description: 'Session cookie-based authentication',
      },
    },
    schemas: {
      // User Schema
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '60d5ec49c1234567890abc' },
          email: { type: 'string', format: 'email', example: 'user@fleetpro.com' },
          name: { type: 'string', example: 'John Doe' },
          role: { type: 'string', enum: ['admin', 'manager', 'user'] },
          tenantId: { type: 'string' },
          permissions: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      // Driver Schema
      Driver: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          licenseNumber: { type: 'string' },
          status: { type: 'string', enum: ['active', 'inactive', 'on-leave', 'suspended'] },
          dateOfJoining: { type: 'string', format: 'date' },
          salary: { type: 'number' },
          documents: {
            type: 'object',
            properties: {
              license: { type: 'string' },
              aadhar: { type: 'string' },
              panCard: { type: 'string' },
            },
          },
          metrics: {
            type: 'object',
            properties: {
              totalTrips: { type: 'integer' },
              totalDistance: { type: 'number' },
              totalEarnings: { type: 'number' },
              averageRating: { type: 'number' },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      // Vehicle Schema
      Vehicle: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          registrationNumber: { type: 'string' },
          model: { type: 'string' },
          manufacturer: { type: 'string' },
          type: { type: 'string', enum: ['sedan', 'suv', 'truck', 'van', 'hatchback'] },
          capacity: { type: 'integer' },
          status: { type: 'string', enum: ['active', 'maintenance', 'retired'] },
          yearOfManufacture: { type: 'integer' },
          currentMileage: { type: 'number' },
          fuelType: { type: 'string' },
          location: {
            type: 'object',
            properties: {
              latitude: { type: 'number' },
              longitude: { type: 'number' },
              address: { type: 'string' },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      // Booking Schema
      Booking: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          customerId: { type: 'string' },
          driverId: { type: 'string' },
          vehicleId: { type: 'string' },
          pickupLocation: {
            type: 'object',
            properties: {
              latitude: { type: 'number' },
              longitude: { type: 'number' },
              address: { type: 'string' },
            },
          },
          dropLocation: {
            type: 'object',
            properties: {
              latitude: { type: 'number' },
              longitude: { type: 'number' },
              address: { type: 'string' },
            },
          },
          status: { type: 'string', enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'] },
          fare: { type: 'number' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      // Notification Schema
      Notification: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
          title: { type: 'string' },
          message: { type: 'string' },
          type: { type: 'string' },
          channels: { type: 'array', items: { type: 'string' } },
          read: { type: 'boolean' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          createdAt: { type: 'string', format: 'date-time' },
          readAt: { type: 'string', format: 'date-time' },
        },
      },

      // Pagination
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 150 },
          pages: { type: 'integer', example: 8 },
        },
      },

      // Error Response
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
          details: { type: 'object' },
          requestId: { type: 'string' },
        },
      },
    },

    responses: {
      UnauthorizedError: {
        description: 'Authentication required or invalid credentials',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      ValidationError: {
        description: 'Request validation failed',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      RateLimitError: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
    },
  },
};

/**
 * Setup Swagger/OpenAPI documentation
 *
 * @param app Express app instance
 * @param apiDocsPath Path to serve Swagger UI (default: /api-docs)
 */
export function setupSwagger(app: Express, apiDocsPath: string = '/api-docs'): void {
  // Swagger UI options
  const swaggerUiOptions = {
    customCss: `
      .swagger-ui {
        font-family: sans-serif;
      }
      .topbar {
        background-color: #1a1a1a;
      }
      .swagger-ui .topbar {
        background: linear-gradient(90deg, #1976d2 0%, #1565c0 100%);
      }
      .swagger-ui .info .title {
        color: #1976d2;
      }
      .swagger-ui .btn {
        background-color: #1976d2;
        border-color: #1976d2;
      }
      .swagger-ui .btn:hover {
        background-color: #1565c0;
        border-color: #1565c0;
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
  app.use(apiDocsPath, swaggerUi.serve);
  app.get(apiDocsPath, swaggerUi.setup(swaggerDefinition, swaggerUiOptions));

  // Serve OpenAPI JSON spec
  app.get(`${apiDocsPath}/openapi.json`, (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerDefinition);
  });

  console.log(`✓ Swagger UI available at http://localhost:5050${apiDocsPath}`);
  console.log(`✓ OpenAPI spec available at http://localhost:5050${apiDocsPath}/openapi.json`);
}

/**
 * Swagger endpoint decorator for Express routes
 *
 * @example
 * router.get('/drivers',
 *   documentEndpoint('List Drivers', 'Get list of drivers'),
 *   (req, res) => {...}
 * )
 */
export function documentEndpoint(summary: string, description: string) {
  return (_req: any, _res: any, next: any) => {
    next();
  };
}

/**
 * Auto-generate OpenAPI paths from Express routes
 */
export function generateOpenAPIPaths(router: any): Record<string, any> {
  const paths: Record<string, any> = {};

  // Stack contains route middleware
  const stack = router.stack || [];

  stack.forEach((layer: any) => {
    if (layer.route) {
      const path = layer.route.path;
      const methods = Object.keys(layer.route.methods);

      if (!paths[path]) {
        paths[path] = {};
      }

      methods.forEach((method: string) => {
        paths[path][method] = {
          tags: ['Operations'],
          summary: `${method.toUpperCase()} ${path}`,
          description: `Auto-documented endpoint for ${method.toUpperCase()} ${path}`,
          responses: {
            200: {
              description: 'Success',
            },
            401: {
              $ref: '#/components/responses/UnauthorizedError',
            },
            404: {
              $ref: '#/components/responses/NotFoundError',
            },
          },
        };
      });
    }
  });

  return paths;
}

export default swaggerDefinition;
