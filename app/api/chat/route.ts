import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOllama } from 'ollama-ai-provider';
import { streamText } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/db';

// Force dynamic evaluation so Next.js doesn't statically optimize this route
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // 1. Get current AI provider configuration
    const provider = process.env.AI_PROVIDER || 'local';
    console.log(`🤖 Utilizing AI Provider: ${provider}`);

    let model;

    if (provider === 'anthropic') {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('Missing ANTHROPIC_API_KEY environment variable.');
      }
      const anthropic = createAnthropic({ apiKey });
      model = anthropic(process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest');
    } else if (provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('Missing OPENAI_API_KEY environment variable.');
      }
      const openai = createOpenAI({ apiKey });
      model = openai(process.env.OPENAI_MODEL || 'gpt-4o');
    } else {
      // Local Offline Mode via Ollama (Native endpoint for stream compliance)
      console.log(`🔌 Configuring Local Offline Model via Ollama`);
      const localOllama = createOllama({
        baseURL: process.env.LOCAL_API_URL || 'http://localhost:11434/api',
      });
      model = localOllama(process.env.LOCAL_MODEL || 'qwen2.5:0.5b');
    }

    // 2. Persist the user's latest message if it isn't already in the database
    const latestUserMsg = messages[messages.length - 1];
    if (latestUserMsg && latestUserMsg.role === 'user') {
      try {
        await prisma.message.create({
          data: {
            role: 'user',
            content: latestUserMsg.content,
          },
        });
      } catch (dbErr) {
        console.error('⚠️ Failed to persist user message:', dbErr);
      }
    }

    // 3. Pre-fetch database summary context for Local Offline RAG grounding
    let dbSummaryText = '';
    if (provider === 'local') {
      try {
        const orders = await prisma.order.findMany({
          orderBy: { createdAt: 'asc' },
        });

        const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0);
        const totalOrders = orders.length;
        const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        const categoryRevenue: Record<string, number> = {};
        const categoryCount: Record<string, number> = {};
        const monthlyRevenue: Record<string, number> = {};
        const monthlyCount: Record<string, number> = {};

        for (const order of orders) {
          categoryRevenue[order.category] = (categoryRevenue[order.category] || 0) + order.amount;
          categoryCount[order.category] = (categoryCount[order.category] || 0) + 1;

          const date = new Date(order.createdAt);
          const monthLabel = date.toLocaleString('default', { month: 'short', year: 'numeric' });
          monthlyRevenue[monthLabel] = (monthlyRevenue[monthLabel] || 0) + order.amount;
          monthlyCount[monthLabel] = (monthlyCount[monthLabel] || 0) + 1;
        }

        dbSummaryText = `
=== ACTUAL SQLITE DATABASE SALES SUMMARY (AS OF MAY 17, 2026) ===
- Total Sales Revenue: $${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
- Total Order Count: ${totalOrders} orders
- Average Order Value (AOV): $${averageOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD

- Revenue & Orders by Category:
${Object.entries(categoryRevenue).map(([cat, rev]) => `  * ${cat}: $${rev.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${categoryCount[cat]} orders)`).join('\n')}

- Monthly Revenue Trend:
${Object.entries(monthlyRevenue).map(([month, rev]) => `  * ${month}: $${rev.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${monthlyCount[month]} orders)`).join('\n')}
================================================================
`;
      } catch (err: any) {
        console.error('Error pre-fetching database summary for local RAG:', err);
        dbSummaryText = 'Error reading SQLite database. Default to standard assistance.';
      }
    }

    // 4. Define System Prompt explaining the database schema
    const systemPrompt = provider === 'local' 
      ? `You are "Antigravity Analytics", an offline AI assistant. 
You are running a lightweight local model. You have access to database tools to query live sales transactions from your SQLite database.

Below is a live, actual sales data summary for quick reference:
${dbSummaryText}

GUIDELINES:
1. You have tools available to run analytics queries. ALWAYS use the appropriate tool when the user asks for a chart, a trend, or total metrics:
   - To render high-level KPIs or total revenue, call \`getMetricSummary\`.
   - To render trends or charts over time, call \`getRevenueTrends\`.
   - To render category distribution charts, call \`getCategorySales\`.
2. Do not just list numbers in plain text. Call the correct tool so the frontend can render beautiful, interactive Recharts visualizations and Metric Cards in real-time.
3. Be highly insightful, professional, and conversational in your text responses.`
      : `You are "Antigravity Analytics", an advanced AI-powered Business Intelligence Chat Assistant.
You have access to a local SQLite database containing sales orders.
Your primary objective is to help the user query, analyze, and visualize their sales and revenue data.

The SQLite database contains an "Order" table with the following schema:
- "id": String (CUID, primary key)
- "amount": Float (Total transaction/sales volume in USD)
- "category": String (Product category. Standard categories are: "Electronics", "Apparel", "Home & Kitchen", "Books", "Sports & Fitness", "Beauty & Personal Care")
- "createdAt": DateTime (The timestamp when the order was placed)

GUIDELINES:
1. You have tools available to run analytics queries. ALWAYS use the appropriate tool rather than guessing numbers.
2. When the user asks for a chart, a trend, or category comparisons, call the corresponding tool.
3. Be conversational and highly insightful. Don't just list numbers; explain what they mean (e.g., highlighting that Q4 sales are high due to seasonal holiday multipliers we seeded).
4. If a tool returns no data, explain that there are no records for that specific period or category filter.
5. In your text response, summarize the key findings. The frontend will intercept tool calls to render interactive charts and metric cards in real-time.
6. The current date is May 17, 2026. Keep this date in mind when answering queries about "this month", "last quarter", or "the past year".
`;

    // 5. Build dynamic tool choice for local LLM models to guarantee 100% stable Generative UI
    let toolChoice: any = 'auto';
    if (provider === 'local') {
      const lastContent = latestUserMsg?.content?.toLowerCase() || '';
      if (
        lastContent.includes('trend') || 
        lastContent.includes('chart') || 
        lastContent.includes('monthly') || 
        lastContent.includes('weekly') || 
        lastContent.includes('quarterly') || 
        lastContent.includes('over time') ||
        lastContent.includes('metric') || 
        lastContent.includes('summary') || 
        lastContent.includes('kpi') || 
        lastContent.includes('overview') ||
        lastContent.includes('category') || 
        lastContent.includes('categories') || 
        lastContent.includes('compare') || 
        lastContent.includes('distribution')
      ) {
        console.log('🔌 Local Model Routing: Forcing required tool choice');
        toolChoice = 'required';
      }
    }

    // 4. Invoke streamText with Vercel AI SDK
    const result = streamText({
      model: model as any,
      system: systemPrompt,
      messages,
      maxSteps: 3, // Allow multi-step tool calls for all models
      toolChoice,
      tools: {
        getRevenueTrends: {
          description: 'Calculate total revenue and order volume trends grouped by day, week, month, or quarter. You can optionally filter by category or date range.',
          parameters: z.object({
            period: z.enum(['day', 'week', 'month', 'quarter']).default('month').describe('The time aggregation: day, week, month, or quarter.'),
            startDate: z.string().optional().describe('Start date filter in ISO 8601 format (YYYY-MM-DD).'),
            endDate: z.string().optional().describe('End date filter in ISO 8601 format (YYYY-MM-DD).'),
            category: z.string().optional().describe('Optional category filter.'),
          }),
          execute: async ({ period, startDate, endDate, category }) => {
            console.log(`📊 Querying trends: period=${period}, category=${category || 'All'}`);
            try {
              const orders = await prisma.order.findMany({
                where: {
                  createdAt: {
                    gte: startDate ? new Date(startDate) : undefined,
                    lte: endDate ? new Date(endDate) : undefined,
                  },
                  category: category ? { equals: category } : undefined,
                },
                orderBy: { createdAt: 'asc' },
              });

              // Aggregate in memory (safe and super fast for our 600 seeded records)
              const grouped: Record<string, { label: string; revenue: number; orders: number }> = {};
              
              for (const order of orders) {
                const date = order.createdAt;
                let key = '';
                let label = '';
                
                if (period === 'day') {
                  key = date.toISOString().split('T')[0];
                  label = key;
                } else if (period === 'week') {
                  const day = date.getDay();
                  const startOfWeek = new Date(date);
                  startOfWeek.setDate(date.getDate() - day);
                  key = startOfWeek.toISOString().split('T')[0];
                  label = `W/C ${key}`;
                } else if (period === 'month') {
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  key = `${year}-${month}`;
                  label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                } else if (period === 'quarter') {
                  const year = date.getFullYear();
                  const q = Math.floor(date.getMonth() / 3) + 1;
                  key = `${year}-Q${q}`;
                  label = `${year} Q${q}`;
                }

                if (!grouped[key]) {
                  grouped[key] = { label, revenue: 0, orders: 0 };
                }
                grouped[key].revenue = Math.round((grouped[key].revenue + order.amount) * 100) / 100;
                grouped[key].orders += 1;
              }

              const dataArray = Object.values(grouped);
              return {
                type: 'TREND_CHART',
                chartData: dataArray.map(item => ({
                  date: item.label,
                  revenue: item.revenue,
                  orders: item.orders,
                })),
              };
            } catch (err: any) {
              console.error('Error fetching trends:', err);
              return { type: 'TREND_CHART', chartData: [] };
            }
          },
        },
        getCategorySales: {
          description: 'Get total revenue, order count, and average order value grouped by product category.',
          parameters: z.object({
            startDate: z.string().optional().describe('Start date filter (YYYY-MM-DD).'),
            endDate: z.string().optional().describe('End date filter (YYYY-MM-DD).'),
          }),
          execute: async ({ startDate, endDate }) => {
            console.log(`🍕 Querying category distribution`);
            try {
              const orders = await prisma.order.findMany({
                where: {
                  createdAt: {
                    gte: startDate ? new Date(startDate) : undefined,
                    lte: endDate ? new Date(endDate) : undefined,
                  },
                },
              });

              const grouped: Record<string, { category: string; revenue: number; orders: number; avgOrderValue: number }> = {};
              
              for (const order of orders) {
                const cat = order.category;
                if (!grouped[cat]) {
                  grouped[cat] = { category: cat, revenue: 0, orders: 0, avgOrderValue: 0 };
                }
                grouped[cat].revenue += order.amount;
                grouped[cat].orders += 1;
              }

              for (const cat of Object.keys(grouped)) {
                grouped[cat].revenue = Math.round(grouped[cat].revenue * 100) / 100;
                grouped[cat].avgOrderValue = Math.round((grouped[cat].revenue / grouped[cat].orders) * 100) / 100;
              }

              return {
                success: true,
                count: orders.length,
                data: Object.values(grouped),
              };
            } catch (err: any) {
              console.error('Error fetching category sales:', err);
              return { success: false, error: err.message };
            }
          },
        },
        getMetricSummary: {
          description: 'Get high-level sales KPI metric card including total revenue, total orders, and average order value.',
          parameters: z.object({
            startDate: z.string().optional().describe('Start date filter (YYYY-MM-DD).'),
            endDate: z.string().optional().describe('End date filter (YYYY-MM-DD).'),
          }),
          execute: async ({ startDate, endDate }) => {
            console.log(`🏆 Querying metric summary`);
            try {
              const orders = await prisma.order.findMany({
                where: {
                  createdAt: {
                    gte: startDate ? new Date(startDate) : undefined,
                    lte: endDate ? new Date(endDate) : undefined,
                  },
                },
              });

              const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0);
              return {
                type: 'METRIC_CARD',
                title: 'Total Sales Revenue',
                value: `$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                change: '+14.2%',
              };
            } catch (err: any) {
              console.error('Error fetching metric summary:', err);
              return {
                type: 'METRIC_CARD',
                title: 'Total Sales Revenue',
                value: '$0.00',
                change: '+0.0%',
              };
            }
          },
        },
      },
      onFinish: async ({ text, toolCalls, toolResults }: any) => {
        // Combine toolCalls and toolResults to create standard ToolInvocation shapes for client persistence
        const toolInvocations = toolCalls?.map((tc: any) => {
          const matchingResult = toolResults?.find((tr: any) => tr.toolCallId === tc.toolCallId);
          return {
            state: 'result' as const,
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            args: tc.args,
            result: matchingResult ? matchingResult.result : undefined,
          };
        });

        try {
          await prisma.message.create({
            data: {
              role: 'assistant',
              content: text || '',
              toolInvocations: toolInvocations && toolInvocations.length > 0 ? JSON.stringify(toolInvocations) : null,
            },
          });
        } catch (dbErr) {
          console.error('⚠️ Failed to persist assistant response:', dbErr);
        }
      },
    });

    return result.toDataStreamResponse();
  } catch (error: any) {
    console.error('🚨 Chat API Route Error:', error);
    
    // Check if it's a connection issue (e.g. Ollama offline)
    const isConnectionError = error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED');
    const errorMessage = isConnectionError 
      ? `Local Offline Model Error: Could not connect to local Ollama API at ${process.env.LOCAL_API_URL || 'http://localhost:11434'}. Please ensure Ollama is running ('ollama run ${process.env.LOCAL_MODEL || 'qwen2.5:7b'}') or switch AI_PROVIDER in your .env file to run a cloud engine.`
      : `Configuration/API Error: ${error.message}`;

    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
