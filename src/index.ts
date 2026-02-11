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

let counter = 0;

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Middleware untuk log trace info
app.use((req: Request, _res: Response, next: NextFunction) => {
  const span = trace.getActiveSpan();
  if (span) {
    const spanContext = span.spanContext();
    console.log(`Trace ID: ${spanContext.traceId}`);
  }
  next();
});

app.use(async (req: Request, res: Response, next: NextFunction) => {
  counter++;
  if(counter % 10 === 0){
   await simulateWork(500 * counter);
  }
  next();
});

app.post("/api/log", async (req: Request, res: Response) => {
  const { level } = req.body;
  console.log(`[${level}] ${new Date().toISOString()} - ${JSON.stringify(req.body)}`);
  res.json({ success: true, message: 'Log received' });
});

app.post("/api/log/:id", async (req: Request, res: Response) => {
  const { level } = req.body;
  const { id } = req.params;
  console.log(`[${level}] ${new Date().toISOString()} - ${JSON.stringify(req.body)} - ${id}`);
  res.json({ success: true, message: 'Log received' });
});

app.post("/api/user/:id/add", async (req: Request, res: Response) => {
  const { name } = req.body;
  const { id } = req.params;
  console.log(`[${name}] ${new Date().toISOString()} - ${JSON.stringify(req.body)} - ${id}`);
  res.json({ success: true, message: 'User added' });
});
app.post('/api/trace-demo', async (req: Request, res: Response) => {
  const tracer = trace.getTracer('backend-api');
  const parentSpan = trace.getActiveSpan();
  
  const traceId = parentSpan?.spanContext().traceId;
  // Buat child spans
  await tracer.startActiveSpan('check-products', async (span1) => {
    try{

      span1.setAttribute('operation', 'fn-check-products');
      await simulateWork(500);
      console.log("SPAN 1 ENDED");
      // proses 
      span1.end();
    }catch(e){
      console.log("SPAN 1 ERROR", e);
    }
  });
  
  await tracer.startActiveSpan('calculate-shipping', async (span2) => {
    span2.setAttribute('operation', 'fn-calculate-shipping');
    await simulateWork(2000);
    console.log("SPAN 2 ENDED");

    span2.end();
  });
  
  await tracer.startActiveSpan('process-payment', async (span3) => {
    span3.setAttribute('operation', 'fn-process-payment');
    await simulateWork(3000);
    console.log("SPAN 3 ENDED");
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

/** Simulasi beban CPU (tanpa OpenTelemetry) */
function simulateCpuWork(iterations: number): void {
  let x = 0;
  for (let i = 0; i < iterations; i++) {
    x += Math.sqrt(i) * Math.sin(i);
  }
  void x;
}

/**
 * Endpoint mock proses berat — tanpa trace OpenTelemetry.
 * Bisa diatur via query atau body: duration (ms), cpuIterations, steps.
 */
app.all('/api/heavy-work', async (req: Request, res: Response) => {
  const params = { ...(req.query as Record<string, string>), ...(req.body ?? {}) } as Record<string, unknown>;
  const duration = Math.min(Number(params.duration ?? 1000) || 1000, 60_000);
  const cpuIterations = Math.min(Number(params.cpuIterations ?? 0) || 0, 50_000_000);
  const steps = Math.min(Math.max(Number(params.steps ?? 1) || 1, 1), 20);

  const startTime = Date.now();
  const delayPerStep = Math.round(duration / steps);
  const cpuPerStep = Math.round(cpuIterations / steps);

  for (let i = 0; i < steps; i++) {
    await simulateWork(delayPerStep);
    if (cpuPerStep > 0) simulateCpuWork(cpuPerStep);
  }

  const elapsed = Date.now() - startTime;

  res.json({
    success: true,
    message: 'Heavy work completed (no trace)',
    config: { duration, cpuIterations, steps },
    elapsed_ms: elapsed,
  });
});

app.listen(PORT, () => {
  console.log(`\n Backend server running on http://localhost:${PORT}`);
});
