# Architecture Tour — Antigravity Analytics Chat

> A deep-dive into how the system handles streaming, tool execution, provider abstraction, and generative UI rendering.

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Directory Structure](#2-directory-structure)
3. [Data Layer — Prisma + SQLite](#3-data-layer--prisma--sqlite)
4. [Provider Abstraction](#4-provider-abstraction)
5. [Streaming Architecture](#5-streaming-architecture)
6. [Tool System & Generative UI](#6-tool-system--generative-ui)
7. [Local Model Specialisation](#7-local-model-specialisation)
8. [Frontend — `useChat` Hook & Message Rendering](#8-frontend--usechat-hook--message-rendering)
9. [Persistence — Chat History](#9-persistence--chat-history)
10. [Request Lifecycle (End-to-End)](#10-request-lifecycle-end-to-end)
11. [SDK Version Compatibility](#11-sdk-version-compatibility)

---

## 1. High-Level Overview

```
Browser (Next.js Client)
  │
  │  POST /api/chat  (streaming)
  ▼
app/api/chat/route.ts           ← Provider Router + Tool Engine
  │
  ├── @ai-sdk/anthropic         ← Claude (cloud)
  ├── @ai-sdk/openai            ← GPT (cloud)
  ├── ollama-ai-provider        ← Local model (offline)
  │
  ├── streamText()              ← Vercel AI SDK core
  │     └── tools: { getRevenueTrends, getCategorySales, getMetricSummary }
  │           └── execute() → Prisma → SQLite
  │
  └── result.toDataStreamResponse()  ← streams chunks back to browser
        │
        ▼
  useChat() (ai/react)
        │
        ├── messages[].toolInvocations  ← resolved tool results
        └── renderMessageContent()      ← switches on toolName → Recharts / MetricCard
```

The entire system is built on the **Vercel AI SDK** (`ai@4.x`) with a single API route that handles all three providers identically behind a unified `streamText()` call. No provider-specific code ever leaks into the frontend.

---

## 2. Directory Structure

```
AnalyticsChatAssistant/
├── app/
│   ├── api/
│   │   ├── chat/route.ts       ← Core: provider routing, tools, streaming
│   │   └── history/route.ts    ← GET and DELETE chat history from SQLite
│   ├── page.tsx                ← Full frontend: useChat, message renderer, charts
│   ├── layout.tsx              ← Root HTML/body layout
│   └── globals.css             ← Design tokens, glassmorphism, scrollbars
├── lib/
│   └── db.ts                   ← Prisma singleton (hot-reload safe)
├── prisma/
│   ├── schema.prisma           ← Order + Message models
│   ├── seed.ts                 ← 600 synthetic orders across 6 categories × 4 quarters
│   └── migrations/             ← SQL migration history
├── .env                        ← AI_PROVIDER, API keys (gitignored)
└── .env.example                ← Safe template committed to repo
```

---

## 3. Data Layer — Prisma + SQLite

### Schema

```prisma
model Order {
  id        String   @id @default(cuid())
  amount    Float                          // USD transaction value
  category  String                         // Electronics | Apparel | Home & Kitchen | …
  createdAt DateTime                       // Timestamp — used for all date aggregations
}

model Message {
  id              String   @id @default(cuid())
  role            String                   // 'user' | 'assistant'
  content         String                   // Plain text response
  toolInvocations String?                  // JSON-serialized tool calls + results
  createdAt       DateTime @default(now())
}
```

### Prisma Singleton (`lib/db.ts`)

Next.js hot-module replacement during development creates a new module scope on every file save. Without a singleton, each reload spawns a new `PrismaClient`, which quickly exhausts SQLite file handles.

```ts
// In dev: reuse the global instance across hot reloads
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

if (!globalForPrisma.prisma) {
  const adapter = new PrismaBetterSqlite3({ url: 'dev.db' });
  globalForPrisma.prisma = new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma;
```

The `PrismaBetterSqlite3` adapter is used (instead of the default libSQL driver) because `better-sqlite3` is **synchronous** and has zero native compilation dependencies — making it ideal for local serverless edge environments and avoiding `node-gyp` headaches.

---

## 4. Provider Abstraction

**File:** `app/api/chat/route.ts` — lines 16–42

The provider is selected purely through the `AI_PROVIDER` environment variable. All three adapters expose the same `LanguageModel` interface from the Vercel AI SDK, so `streamText()` is called identically regardless of which provider is active.

```ts
const provider = process.env.AI_PROVIDER || 'local';

let model;

if (provider === 'anthropic') {
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  model = anthropic(process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest');

} else if (provider === 'openai') {
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  model = openai(process.env.OPENAI_MODEL || 'gpt-4o');

} else {
  // Local offline — Ollama
  const localOllama = createOllama({ baseURL: process.env.LOCAL_API_URL });
  model = localOllama(process.env.LOCAL_MODEL || 'qwen2.5:0.5b');
}
```

**Switching providers** requires only a one-line change in `.env`:

```bash
AI_PROVIDER=anthropic   # Claude via Anthropic API
AI_PROVIDER=openai      # GPT via OpenAI API
AI_PROVIDER=local       # Any model running in Ollama (offline)
```

No code changes required. The rest of the pipeline — tools, streaming, system prompt, persistence — is 100% identical across all three.

---

## 5. Streaming Architecture

**The streaming pipeline is:** `streamText()` → `toDataStreamResponse()` → `useChat()` → React state.

### Backend

```ts
const result = streamText({
  model,           // any LanguageModel — provider-agnostic
  system: systemPrompt,
  messages,
  maxSteps: 3,     // enables multi-turn tool call chains (call → result → follow-up)
  toolChoice,
  tools: { ... },
  onFinish: async ({ text, toolCalls, toolResults }) => {
    // Persist the completed assistant message to SQLite after stream ends
    await prisma.message.create({ data: { role: 'assistant', content: text, toolInvocations: ... } });
  },
});

return result.toDataStreamResponse();
```

`toDataStreamResponse()` wraps the result in the **AI Data Stream Protocol** — a newline-delimited format where each line is a prefixed chunk:

```
f:{"messageId":"msg-abc123"}          ← frame header
0:"Here is your"                      ← text delta (role: 0)
0:" revenue summary."
9:{"toolCallId":"...","toolName":"getRevenueTrends","args":{...}}  ← tool call start
a:{"toolCallId":"...","result":{...}} ← tool result
e:{"finishReason":"stop","usage":{...}}
d:{"finishReason":"stop"}
```

### Frontend

The `useChat()` hook from `ai/react` consumes this stream transparently:

```ts
const { messages, input, handleInputChange, handleSubmit, isLoading, append, setMessages } = useChat({
  api: '/api/chat',
  maxSteps: 3,
  onFinish: () => scrollToBottom(),
});
```

Each `message` object that arrives may contain `toolInvocations` — an array of tool calls with their resolved results — which is what triggers the Generative UI rendering.

---

## 6. Tool System & Generative UI

The three tools form the core analytics engine. Each tool:
1. Is defined with a **Zod schema** for type-safe parameter validation
2. Executes a **Prisma query** against SQLite
3. Returns a **strongly typed payload** the frontend switches on to render the correct component

### Tool Definitions

| Tool | Trigger Phrase Examples | Returns | Renders |
|---|---|---|---|
| `getRevenueTrends` | "monthly trend", "chart", "over time" | `{ type: 'TREND_CHART', chartData: [...] }` | Recharts `BarChart` |
| `getCategorySales` | "by category", "compare", "distribution" | `{ success: true, data: [...] }` | Recharts `BarChart` per category |
| `getMetricSummary` | "KPI", "overview", "total revenue" | `{ type: 'METRIC_CARD', title, value, change }` | Glassmorphic metric card |

### Tool Registration (Backend)

```ts
tools: {
  getRevenueTrends: {
    description: 'Calculate revenue trends grouped by day, week, month, or quarter.',
    parameters: z.object({
      period: z.enum(['day', 'week', 'month', 'quarter']).default('month'),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      category: z.string().optional(),
    }),
    execute: async ({ period, startDate, endDate, category }) => {
      // Prisma query → in-memory aggregation → return chartData array
      return { type: 'TREND_CHART', chartData: [ ... ] };
    },
  },
  // ... getCategorySales, getMetricSummary
}
```

All aggregations (grouping by month, quarter, category) are done **in application memory** rather than via SQL `GROUP BY`. This is intentional — with 600 seeded records the full table loads in microseconds, and in-memory JS gives us total flexibility for period bucketing logic without database-specific SQL syntax.

### Generative UI Rendering (Frontend)

When the SDK resolves a tool result, `msg.toolInvocations` is populated. The renderer switches on `toolName`:

```tsx
const renderMessageContent = (msg) => {
  return msg.toolInvocations.map(({ toolCallId, toolName, state, result }) => {

    // Show loading state while tool is executing
    if (state !== 'result') return <div key={toolCallId}>Querying database...</div>;

    switch (toolName) {
      case 'getMetricSummary':
        return (
          <div key={toolCallId} className="glass-panel ...">
            <p>{result.title}</p>
            <div className="text-3xl font-bold">{result.value}</div>
            <p className="text-emerald-400">{result.change}</p>
          </div>
        );

      case 'getRevenueTrends':
        return (
          <div key={toolCallId} style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={result.chartData}>
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(v) => `$${v}`} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#4f46e5" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'getCategorySales':
        return <CategoryChart key={toolCallId} data={result.data} />;
    }
  });
};
```

The key insight: **the frontend never calls the database directly**. It simply renders whatever typed payload the tool returns. Adding a new visualization requires only adding a tool on the backend and a new `case` in the switch.

---

## 7. Local Model Specialisation

Small Ollama models (e.g. `qwen2.5:0.5b`) are capable of reasoning, but unreliable at independently choosing and correctly formatting tool calls — they may respond with plain text instead.

Two strategies compensate for this:

### Strategy A — RAG Grounding (Context Injection)

Before calling `streamText()`, when `provider === 'local'`, the route pre-fetches the entire `Order` table and compiles a plain-text summary that is injected directly into the system prompt:

```
=== ACTUAL SQLITE DATABASE SALES SUMMARY ===
- Total Sales Revenue: $184,320.00 USD
- Total Order Count: 600 orders
- Revenue by Category:
  * Electronics: $42,100.00 (150 orders)
  * Apparel: $28,750.00 (120 orders)
  ...
```

This means the local model can answer factual questions **accurately without needing to call tools at all**, since the ground truth is already in its context window.

### Strategy B — Forced Tool Choice

For visual queries (charts, trends, distributions), the route inspects the user's message for keywords and overrides `toolChoice`:

```ts
let toolChoice: any = 'auto'; // default: model chooses

if (provider === 'local') {
  const lastContent = latestUserMsg.content.toLowerCase();
  if (lastContent.includes('trend') || lastContent.includes('chart') || ...) {
    toolChoice = 'required'; // model MUST call a tool
  }
}
```

`toolChoice: 'required'` forces the Ollama model to emit a valid tool call in its response, bypassing its tendency to answer in plain prose. This guarantees Recharts charts and Metric Cards always render for visual queries, even with a 0.5B parameter model.

> **Note:** `{ type: 'tool', toolName: '...' }` (named tool forcing) is not supported by `ollama-ai-provider`. The `'required'` value is the correct cross-provider compatible option that works with all three adapters.

---

## 8. Frontend — `useChat` Hook & Message Rendering

The frontend is a single `page.tsx` React component. State management is entirely handled by the Vercel AI SDK's `useChat` hook — no Redux, no Zustand, no custom reducers.

### Key hook capabilities used

| API | Purpose |
|---|---|
| `messages` | Array of all chat messages with tool invocations |
| `input` / `handleInputChange` | Controlled textarea binding |
| `handleSubmit` | Form submission — sends to `/api/chat` |
| `append` | Programmatically send a message (used by quick-prompt chips) |
| `setMessages` | Imperatively overwrite messages (used by Clear Chat and history load) |
| `isLoading` | Disables submit button during stream |

### Streaming update flow

```
User clicks Send
  → handleSubmit() → POST /api/chat
  → useChat reads stream chunks
  → React state updates on every chunk (text deltas + tool results)
  → renderMessageContent() re-renders with each update
  → Recharts chart appears the moment toolInvocation.state === 'result'
```

No polling, no websockets, no manual fetch — the SDK handles all of this via the browser's native `ReadableStream` API.

---

## 9. Persistence — Chat History

### Write Path

Messages are persisted **on the server** inside the `streamText` `onFinish` callback — after the stream completes:

```
User message  → persisted in POST handler (before streamText)
Assistant msg → persisted in onFinish callback (after stream finishes)
toolInvocations → serialized to JSON string, stored in Message.toolInvocations column
```

### Read Path (`GET /api/history`)

On page load, `fetchChatHistory()` calls `GET /api/history`, which reads all messages from SQLite, deserializes `toolInvocations` JSON back to arrays, and calls `setMessages()` to restore the full UI state — including any Recharts charts from previous sessions.

### Delete Path (`DELETE /api/history`)

The "Clear Chat Memory" button calls `DELETE /api/history` → `prisma.message.deleteMany()`, then immediately calls `setMessages([])` to clear the React state. No page refresh needed.

---

## 10. Request Lifecycle (End-to-End)

```
1. User types "Show me monthly revenue trends"

2. handleSubmit() → POST /api/chat
   Body: { messages: [...conversation history...] }

3. route.ts:
   a. Read AI_PROVIDER env → instantiate model (Anthropic / OpenAI / Ollama)
   b. Persist user message to SQLite
   c. If local: pre-fetch DB summary → inject into system prompt
   d. Build toolChoice ('auto' or 'required' for local)
   e. Call streamText({ model, system, messages, tools, toolChoice })

4. streamText internal flow:
   a. Send messages + system prompt + tool definitions to LLM
   b. LLM responds with a tool call: getRevenueTrends({ period: 'month' })
   c. SDK executes tools.getRevenueTrends.execute({ period: 'month' })
   d. execute() runs Prisma query → aggregates → returns { type: 'TREND_CHART', chartData: [...] }
   e. SDK sends result back to LLM (maxSteps: 3 allows follow-up reasoning)
   f. LLM generates final text response + returns finish signal

5. toDataStreamResponse() streams all chunks to browser

6. useChat() receives chunks → updates messages[] in React state

7. renderMessageContent() detects toolInvocations[0].state === 'result'
   → switch('getRevenueTrends') → renders Recharts BarChart

8. onFinish fires → assistant message + toolInvocations persisted to SQLite

Total round-trip (Anthropic claude-haiku): ~2–4 seconds
Total round-trip (local qwen2.5:0.5b):    ~1–3 seconds
```

---

## 11. SDK Version Compatibility

A critical lesson from this project: **the `@ai-sdk/*` packages use independent versioning that must be aligned**.

| Package | Compatible Set | Notes |
|---|---|---|
| `ai` | `^4.3.x` | Core SDK — defines `streamText`, `useChat`, stream protocol |
| `@ai-sdk/anthropic` | `^1.2.x` | Stable release series for `ai@4.x` |
| `@ai-sdk/openai` | `^1.3.x` | Stable release series for `ai@4.x` |
| `zod` | `^3.x` | Peer dependency of `@ai-sdk/*@1.x` — must NOT use zod v4 |
| `ollama-ai-provider` | `^1.2.x` | Community adapter — does NOT support `{ type: 'tool' }` toolChoice |

> **Warning:** `@ai-sdk/anthropic@3.x` is a **pre-release dev branch**, not the stable series. Installing it alongside `ai@4.x` produces `Unhandled chunk type: stream-start` errors because the stream protocol format diverged between versions.

The stream error was fixed by pinning the entire AI SDK stack to the `1.x` release series via:

```bash
npm install ai@^4.3.16 @ai-sdk/anthropic@^1.2.12 @ai-sdk/openai@^1.3.22 zod@^3.23.8 --legacy-peer-deps
```
