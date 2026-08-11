import {
  NodeTracerProvider,
  BatchSpanProcessor,
} from '@opentelemetry/node';
import {
  JaegerExporter,
} from '@opentelemetry/exporter-jaeger-http';
import {
  registerInstrumentations,
} from '@opentelemetry/auto-instrumentations-node';
import {
  Resource,
} from '@opentelemetry/resources';
import {
  SemanticResourceAttributes,
} from '@opentelemetry/semantic-conventions';
import {
  context,
  trace,
  SpanStatusCode,
  Tracer,
} from '@opentelemetry/api';
import { Express } from 'express';

/**
 * OpenTelemetry Distributed Tracing Module
 * Exports trace data to Jaeger for visualization and analysis
 */

let globalTracer: Tracer | null = null;

/**
 * Initialize OpenTelemetry tracing
 */
export function initializeTracing(
  serviceName: string,
  jaegerEndpoint: string = process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces'
): void {
  if (globalTracer) {
    return; // Already initialized
  }

  try {
    // Create resource describing this service
    const resource = Resource.default().merge(
      new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      })
    );

    // Create Jaeger exporter
    const jaegerExporter = new JaegerExporter(
      {
        endpoint: jaegerEndpoint,
      },
      {
        maxPacketSize: 65000,
      }
    );

    // Create tracer provider
    const tracerProvider = new NodeTracerProvider({
      resource: resource,
    });

    // Add span processor
    tracerProvider.addSpanProcessor(
      new BatchSpanProcessor(jaegerExporter, {
        maxQueueSize: 2048,
        maxExportBatchSize: 512,
        scheduledDelayMillis: 5000,
      })
    );

    // Register instrumentations
    registerInstrumentations({
      tracerProvider,
    });

    // Set as global tracer provider
    tracerProvider.register();

    globalTracer = trace.getTracer(serviceName);

    console.log(`OpenTelemetry tracing initialized for ${serviceName}`);
  } catch (error) {
    console.error('Failed to initialize OpenTelemetry tracing:', error);
  }
}

/**
 * Get the global tracer instance
 */
export function getTracer(): Tracer {
  if (!globalTracer) {
    globalTracer = trace.getTracer('fleetpro');
  }
  return globalTracer;
}

/**
 * Span attributes for common operations
 */
export const SpanAttributes = {
  HTTP_METHOD: 'http.method',
  HTTP_URL: 'http.url',
  HTTP_STATUS_CODE: 'http.status_code',
  DB_OPERATION: 'db.operation',
  DB_SYSTEM: 'db.system',
  DB_STATEMENT: 'db.statement',
  DB_COLLECTION: 'db.collection',
  MESSAGING_SYSTEM: 'messaging.system',
  MESSAGING_DESTINATION: 'messaging.destination',
  RPC_SERVICE: 'rpc.service',
  RPC_METHOD: 'rpc.method',
  EXCEPTION_TYPE: 'exception.type',
  EXCEPTION_MESSAGE: 'exception.message',
  EXCEPTION_STACKTRACE: 'exception.stacktrace',
};

/**
 * Track HTTP request spans
 */
export function trackHttpRequest(
  req: any,
  res: any,
  next: any
): void {
  const tracer = getTracer();
  const span = tracer.startSpan(`${req.method} ${req.path}`);

  span.setAttributes({
    [SpanAttributes.HTTP_METHOD]: req.method,
    [SpanAttributes.HTTP_URL]: req.originalUrl,
    'http.target': req.path,
    'http.host': req.hostname,
  });

  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    span.setAttributes({
      [SpanAttributes.HTTP_STATUS_CODE]: res.statusCode,
      'http.response_time_ms': duration,
    });

    if (res.statusCode >= 400) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `HTTP ${res.statusCode}`,
      });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    span.end();
  });

  context.with(trace.setSpan(context.active(), span), () => {
    next();
  });
}

/**
 * Track database operation spans
 */
export function trackDatabaseOperation<T>(
  operation: string,
  collection: string,
  fn: () => Promise<T>
): Promise<T> {
  const tracer = getTracer();
  const span = tracer.startSpan(`db.${operation}`, {
    attributes: {
      [SpanAttributes.DB_SYSTEM]: 'mongodb',
      [SpanAttributes.DB_OPERATION]: operation,
      [SpanAttributes.DB_COLLECTION]: collection,
    },
  });

  const startTime = Date.now();

  return context.with(
    trace.setSpan(context.active(), span),
    async () => {
      try {
        const result = await fn();
        const duration = Date.now() - startTime;
        span.setAttributes({
          'db.duration_ms': duration,
          'db.success': true,
        });
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttributes({
          'db.duration_ms': duration,
          'db.success': false,
          [SpanAttributes.EXCEPTION_TYPE]: (error as Error).name,
          [SpanAttributes.EXCEPTION_MESSAGE]: (error as Error).message,
        });
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
        span.end();
        throw error;
      }
    }
  );
}

/**
 * Track external API call spans
 */
export function trackExternalApiCall<T>(
  provider: string,
  endpoint: string,
  fn: () => Promise<T>
): Promise<T> {
  const tracer = getTracer();
  const span = tracer.startSpan(`external.${provider}`, {
    attributes: {
      'rpc.service': provider,
      'rpc.method': endpoint,
      'rpc.system': 'http',
    },
  });

  const startTime = Date.now();

  return context.with(
    trace.setSpan(context.active(), span),
    async () => {
      try {
        const result = await fn();
        const duration = Date.now() - startTime;
        span.setAttributes({
          'rpc.duration_ms': duration,
          'rpc.success': true,
        });
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttributes({
          'rpc.duration_ms': duration,
          'rpc.success': false,
          [SpanAttributes.EXCEPTION_TYPE]: (error as Error).name,
          [SpanAttributes.EXCEPTION_MESSAGE]: (error as Error).message,
        });
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
        span.end();
        throw error;
      }
    }
  );
}

/**
 * Track queue operation spans
 */
export function trackQueueOperation<T>(
  queueName: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const tracer = getTracer();
  const span = tracer.startSpan(`queue.${operation}`, {
    attributes: {
      [SpanAttributes.MESSAGING_SYSTEM]: 'queue',
      [SpanAttributes.MESSAGING_DESTINATION]: queueName,
    },
  });

  const startTime = Date.now();

  return context.with(
    trace.setSpan(context.active(), span),
    async () => {
      try {
        const result = await fn();
        const duration = Date.now() - startTime;
        span.setAttributes({
          'queue.processing_time_ms': duration,
          'queue.success': true,
        });
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttributes({
          'queue.processing_time_ms': duration,
          'queue.success': false,
          [SpanAttributes.EXCEPTION_TYPE]: (error as Error).name,
          [SpanAttributes.EXCEPTION_MESSAGE]: (error as Error).message,
        });
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
        span.end();
        throw error;
      }
    }
  );
}

/**
 * Track custom operation spans
 */
export function trackOperation<T>(
  operationName: string,
  attributes?: Record<string, any>,
  fn?: () => Promise<T>
): Promise<T> | void {
  const tracer = getTracer();
  const span = tracer.startSpan(operationName);

  if (attributes) {
    span.setAttributes(attributes);
  }

  if (!fn) {
    return undefined;
  }

  const startTime = Date.now();

  return context.with(
    trace.setSpan(context.active(), span),
    async () => {
      try {
        const result = await fn();
        const duration = Date.now() - startTime;
        span.setAttributes({
          'operation.duration_ms': duration,
          'operation.success': true,
        });
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttributes({
          'operation.duration_ms': duration,
          'operation.success': false,
          [SpanAttributes.EXCEPTION_TYPE]: (error as Error).name,
          [SpanAttributes.EXCEPTION_MESSAGE]: (error as Error).message,
        });
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
        span.end();
        throw error;
      }
    }
  );
}

/**
 * Shutdown tracing (flush pending spans)
 */
export async function shutdownTracing(): Promise<void> {
  const tracer = trace.getActiveTracerProvider();
  if (tracer && typeof (tracer as any).shutdown === 'function') {
    await (tracer as any).shutdown();
  }
}

/**
 * Get current active span
 */
export function getCurrentSpan() {
  return trace.getActiveSpan();
}

/**
 * Add event to current span
 */
export function addSpanEvent(
  name: string,
  attributes?: Record<string, any>
): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}
