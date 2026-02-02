import './tracing';

import { trace } from '@opentelemetry/api';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:3000'],
  credentials: true,
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'traceparent',    // W3C Trace Context
  ],
}));

app.use(express.json());

// Middleware untuk log trace info
app.use((req: Request, _res: Response, next: NextFunction) => {
  const span = trace.getActiveSpan();
  if (span) {
    const spanContext = span.spanContext();
    console.log(` Request: ${req.method} ${req.path}`);
    console.log(`   Trace ID: ${spanContext.traceId}`);
    console.log(`   Span ID:  ${spanContext.spanId}`);
    console.log(`   Header traceparent: ${req.headers.traceparent || 'not found'}`);
  }
  next();
});


app.post('/api/trace-demo', async (req: Request, res: Response) => {
  const tracer = trace.getTracer('backend-api');
  const parentSpan = trace.getActiveSpan();
  
  const traceId = parentSpan?.spanContext().traceId;
  
  // Buat child spans
  await tracer.startActiveSpan('check-products', async (span1) => {
    span1.setAttribute('operation', 'fn-check-products');
    await simulateWork(500);
    // proses 
    span1.end();
  });
  
  await tracer.startActiveSpan('calculate-shipping', async (span2) => {
    span2.setAttribute('operation', 'fn-calculate-shipping');
    await simulateWork(2000);
    span2.end();
  });
  
  await tracer.startActiveSpan('process-payment', async (span3) => {
    span3.setAttribute('operation', 'fn-process-payment');
    await simulateWork(3000);
    span3.end();
  });
  
  res.json({
    success: true,
    message: 'Trace demo completed',
    frontendTraceHeader: req.headers.traceparent,
    backendTraceId: parentSpan?.spanContext().traceId,
    propagationSuccess: req.headers.traceparent?.includes(parentSpan?.spanContext().traceId || ''),
  });
});

// Helper function
function simulateWork(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.listen(PORT, () => {
  console.log(`\n Backend server running on http://localhost:${PORT}`);
  console.log(`\n Endpoints:`);
  console.log(`   POST /api/trace-demo  - Demo trace propagation\n`);
});
