# Antigravity Analytics 🌌 

> A premium, chat-native Business Intelligence (BI) tool designed to query, aggregate, and visualize SQLite sales transactions using natural language. Built with **Next.js 14+ (App Router)**, **Vercel AI SDK**, **Prisma ORM**, and **Recharts**.

---

## 🌟 Key Features

*   **Generative UI Rendering:** Intercepts LLM tool invocations on-the-fly and swaps plain JSON payloads with interactive React assets:
    *   **Metric Grid:** Real-time summary cards displaying Gross Sales, Transactions, AOV, and top-performing categories with glowing neon indicators.
    *   **Trend Area Chart:** Dynamic time-series visualization using indigo-to-cyan neon gradient fills, responsive tracking tooltip overlays, and custom HSL parameters.
    *   **Category Sales Distribution:** Horizontal bar chart comparing sales volume, counts, and AOV per product segment.
*   **Provider Configuration-Driven Design:** Cleanly toggle between Anthropic, OpenAI, or a completely offline local Ollama model by switching environment variables.
*   **Persistent Conversation Logs:** Restores complete visual state, including the exact chart data, upon page reload. Includes a single-click memory clearing function.
*   **Robust Data Seeding:** Comes pre-seeded with **600 detailed sales transactions** spanning the last 4 quarters (May 2025 – May 2026), governed by distinct categories and realistic seasonal sales multipliers.
*   **Production-Grade Docker Setup:** A double-stage Docker build optimized for size, equipped with Docker Compose volume mounting for persistent SQLite state and auto-gateway routing to connect with local Ollama on the host.

---

## 🛠️ Tech Stack

*   **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4, Lucide Icons, Recharts.
*   **Backend:** Next.js Route Handlers, Vercel AI SDK.
*   **Database & ORM:** SQLite (`better-sqlite3` engine) & Prisma 7 ORM.
*   **Deployment:** Docker, Docker Compose.

---

## 📁 Project Structure

```bash
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts       # Streaming AI route with aggregate SQLite tools & history persistence
│   │   └── history/
│   │       └── route.ts       # REST endpoints to retrieve and clear persistent database messages
│   ├── globals.css            # Custom glassmorphic styles, card glows, scrollbars
│   ├── layout.tsx             # Main HTML head, Geist font configs, SEO tags
│   └── page.tsx               # Chat dashboard featuring Generative UI tool interception
├── lib/
│   └── db.ts                  # Singleton PrismaClient governed by PrismaBetterSqlite3 adapter
├── prisma/
│   ├── dev.db                 # Pre-seeded SQLite database file
│   ├── migrations/            # Auto-generated Prisma migration SQL queries
│   ├── schema.prisma          # Database schema (Order, Message models)
│   └── seed.ts                # Realistic 600 sales records seeding script
├── Dockerfile                 # Production double-stage Dockerfile
├── docker-compose.yml         # Container orchestration with volume mounts & gateway mapping
└── package.json               # Next.js scripts, dependencies, types
```

---

## 🔑 Environment Variables Configuration

Create a `.env` file in the project root. Fill out the credentials depending on your chosen AI provider:

```env
# ==========================================
# 🤖 AI PROVIDER ROUTING CONFIGURATION
# Options: "local" (Ollama), "anthropic", or "openai"
# ==========================================
AI_PROVIDER=local

# ------------------------------------------
# 🔌 Option A: Local Offline Model (Ollama)
# ------------------------------------------
# Base URL to Ollama's OpenAI-compatible API endpoint
LOCAL_API_URL=http://localhost:11434/v1
LOCAL_MODEL=qwen2.5:7b

# ------------------------------------------
# ☁️ Option B: Anthropic Cloud Models
# ------------------------------------------
# ANTHROPIC_API_KEY=your_anthropic_api_key_here
# ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# ------------------------------------------
# ☁️ Option C: OpenAI Cloud Models
# ------------------------------------------
# OPENAI_API_KEY=your_openai_api_key_here
# OPENAI_MODEL=gpt-4o
```

---

## 🚀 Getting Started

### Method 1: Local Development Server

1.  **Clone the workspace** and navigate to the project directory:
    ```bash
    cd AnalyticsChatAssistant
    ```
2.  **Configure environment variables:** Copy the template above into a `.env` file at the root.
3.  **Install dependencies:**
    ```bash
    npm install --legacy-peer-deps
    ```
4.  **Run migrations & pre-seed the database:**
    *(The project already ships with a pre-seeded `prisma/dev.db`, but you can easily reset or rebuild it)*
    ```bash
    npx prisma migrate dev --name init
    npx prisma db seed
    ```
5.  **Launch Next.js in development mode:**
    ```bash
    npm run dev
    ```
6.  Open your browser and navigate to **`http://localhost:3000`** to view the live dashboard!

---

### Method 2: Containerized Deployment via Docker

We have designed a seamless Docker Compose configuration that automatically mounts the pre-seeded SQLite database and maps the container network gateway, allowing the Docker application to communicate directly with Ollama running on your local machine.

1.  **Launch the stack in detached mode:**
    ```bash
    docker-compose up --build -d
    ```
2.  **Network Gateway Tip:** If `AI_PROVIDER` is set to `local`, the container is pre-configured to look at `http://host.docker.internal:11434/v1` as the base API URL to seamlessly route model requests to the host machine's Ollama runtime.
3.  Navigate to **`http://localhost:3000`** on your browser.
4.  **Persistency Volume:** Any messages exchanged, tool invocations parsed, or database modifications will remain persistent on the host machine inside the `./dev.db` file.

---

## 📊 Database Schema Details

The SQLite database structure is governed by two main models inside `prisma/schema.prisma`:

### `Order`
Contains individual transaction details used by our aggregate analytical tools:
*   `id` (String): Primary key (CUID)
*   `amount` (Float): Transaction volume in USD
*   `category` (String): Product category (e.g. `Electronics`, `Apparel`, `Books`, etc.)
*   `createdAt` (DateTime): Date order was submitted

### `Message`
Maintains persistence across page reloads:
*   `id` (String): Primary key (CUID)
*   `role` (String): `user` or `assistant`
*   `content` (String): Text message contents
*   `toolInvocations` (String): Serialized JSON array of the complete tool-execution states (call parameters + database outputs) to enable immediate frontend chart hydration.

---

## 🧠 Sample BI Analytical Queries

Here are some suggested prompts to test the agent's generative chart capabilities:

*   **🏆 High-Level KPIs:** *"Give me a high level overview of our total sales metrics and KPIs."* (Triggers `getSummaryMetrics` to render the interactive Metric Grid).
*   **📈 Monthly Trends:** *"Show me our monthly revenue trend over the past 4 quarters."* (Triggers `getRevenueTrends` with `period="month"` to render the indigo neon Area Chart).
*   **🍕 Category Comparisons:** *"Compare the sales performance and averages across all standard product categories."* (Triggers `getCategorySales` to render the horizontal comparison Bar Chart).
*   **⚡️ Segment Filtering:** *"Show me weekly electronics sales trends for the last 6 months."* (Triggers a combined daily/weekly filter, showcasing the agent's high-fidelity query processing).
# AnalyticsChat
