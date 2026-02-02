# Backend OpenTelemetry Example

Contoh backend Node.js/Express dengan OpenTelemetry trace propagation.


## Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/trace-demo` | Demo trace propagation dari frontend |

## Cara Kerja Trace Propagation

### 1. Frontend mengirim request dengan header `traceparent`

Ketika frontend melakukan HTTP request, OpenTelemetry otomatis menambahkan header:

```
traceparent: 00-{traceId}-{spanId}-{flags}
```

Contoh:
```
traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
```

### 2. Backend extract trace context

Auto-instrumentation (`@opentelemetry/auto-instrumentations-node`) otomatis:
- Extract header `traceparent` dari incoming request
- Set trace context sebagai parent untuk span baru

### 3. Spans terhubung dengan Trace ID yang sama

```
Frontend (Trace ID: abc123)
├── Span: validasi-data
├── Span: proses-data
└── Span: simpan-data
        │
        ▼ HTTP Request (traceparent: 00-abc123-xxx-01)
        │
Backend (Trace ID: abc123) ← SAMA!
├── Span: proses-1
├── Span: proses-2
└── Span: proses-3
```

## Troubleshooting

### Trace ID tidak nyambung?

1. **Cek CORS** - Pastikan header `traceparent` diizinkan
2. **Cek URL pattern** - Frontend harus include backend URL di `propagateTraceHeaderCorsUrls`
3. **Cek import order** - `tracing.ts` HARUS di-import pertama sebelum express
