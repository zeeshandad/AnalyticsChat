'use client';

import { useChat } from 'ai/react';
import { useState, useEffect, useRef } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Layers, 
  Sparkles, 
  Database, 
  Cpu, 
  Trash2, 
  Send, 
  ArrowRight, 
  AlertCircle,
  BarChart3,
  RefreshCw,
  MessageSquare
} from 'lucide-react';

export default function AnalyticsDashboard() {
  const [mounted, setMounted] = useState(false);
  const [providerInfo, setProviderInfo] = useState({ provider: 'local', model: 'qwen2.5:7b' });
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Initialize Vercel AI SDK useChat Hook
  const { 
    messages, 
    input, 
    handleInputChange, 
    handleSubmit, 
    setInput, 
    isLoading, 
    error, 
    setMessages,
    append
  } = useChat({
    api: '/api/chat',
    maxSteps: 3,
    onResponse: () => {
      scrollToBottom();
    },
    onFinish: () => {
      scrollToBottom();
    }
  });

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
    fetchChatHistory();
    fetchProviderInfo();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 2. Load Persisted Chat History from Database
  const fetchChatHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await fetch('/api/history');
      if (res.ok) {
        const history = await res.json();
        if (history && history.length > 0) {
          // Parse date strings to Date objects
          const formatted = history.map((msg: any) => ({
            ...msg,
            createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
          }));
          setMessages(formatted);
        }
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Determine active provider settings from env at runtime
  const fetchProviderInfo = async () => {
    try {
      // Set some defaults or do a quick fetch
      // For presentation, we read the server environment or use a simple logic
      // We can also let the user know we default to Ollama (local) unless configured.
    } catch (e) {}
  };

  // 3. Delete Chat History — no confirm dialog, immediate clear
  const handleClearHistory = async () => {
    if (isClearing) return;
    setIsClearing(true);
    try {
      const res = await fetch('/api/history', { method: 'DELETE' });
      if (res.ok) {
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to clear chat history:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Trigger quick prompt submission
  const handleQuickPrompt = (promptText: string) => {
    setInput(promptText);
    // Submit in next tick to let react state bind
    setTimeout(() => {
      const event = {
        preventDefault: () => {},
      } as React.FormEvent<HTMLFormElement>;
      
      // Select form element and submit or call standard submit
      // We can construct a mock submit or directly execute the handleSubmit
      // Vercel AI SDK handleSubmit takes an optional event or runs directly
      const inputEl = document.getElementById('chat-textarea') as HTMLTextAreaElement;
      if (inputEl) {
        inputEl.focus();
      }
    }, 50);
  };

  const handleChipClick = (queryText: string) => {
    setInput(queryText);
  };

  // Harmonious palette for chart categories
  const CHART_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

  // Render Metric Grid inside stream
  const renderSummaryMetrics = (data: any) => {
    if (!data || !data.success) return null;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Metric 1 */}
        <div className="glass-panel glow-card p-5 rounded-2xl border-slate-800 relative">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total Sales Volume</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            ${data.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            SQLite seed aggregates
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-panel glow-card p-5 rounded-2xl border-slate-800 relative">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total Transactions</span>
            <ShoppingBag className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {data.totalOrders.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Orders processed
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass-panel glow-card p-5 rounded-2xl border-slate-800 relative">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Average Order Value</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            ${data.averageOrderValue.toFixed(2)}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            AOV across dataset
          </div>
        </div>

        {/* Metric 4 */}
        <div className="glass-panel glow-card p-5 rounded-2xl border-slate-800 relative">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Top Category</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-3 text-xl sm:text-2xl font-extrabold text-white tracking-tight truncate">
            {data.topCategory.name}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex justify-between">
            <span>Vol: ${Math.round(data.topCategory.revenue).toLocaleString()}</span>
            <span>({data.topCategory.orders} orders)</span>
          </div>
        </div>
      </div>
    );
  };

  // Render Time-series trends Recharts Area Chart
  const renderRevenueTrends = (data: any) => {
    if (!data || !data.success || !data.data || data.data.length === 0) {
      return (
        <div className="glass-panel p-6 rounded-2xl my-4 text-center text-slate-400">
          No trends data resolved for the specified parameters.
        </div>
      );
    }

    const title = `${data.category} Sales Trend`;
    const description = `Aggregated by ${data.period} across ${data.count} matched transactions.`;

    return (
      <div className="glass-panel p-5 sm:p-6 rounded-2xl my-4 border-slate-800 bg-slate-900/40 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h4 className="text-white font-bold text-base sm:text-lg">{title}</h4>
            <p className="text-slate-400 text-xs mt-0.5">{description}</p>
          </div>
          <span className="self-start sm:self-center px-3 py-1 bg-indigo-950/60 border border-indigo-500/30 text-indigo-400 text-xs rounded-full font-medium">
            SQLite Aggregate
          </span>
        </div>

        <div className="w-full h-72 pr-4 sm:pr-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="areaColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.45}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis 
                dataKey="label" 
                stroke="#6b7280" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                dy={10}
              />
              <YAxis 
                stroke="#6b7280" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={(val) => `$${val.toLocaleString()}`}
                dx={-10}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                  borderColor: 'rgba(255,255,255,0.1)', 
                  borderRadius: '16px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                  backdropFilter: 'blur(8px)',
                  color: '#fff'
                }} 
                formatter={(value: any) => [`$${value.toLocaleString()}`, 'Revenue']}
                labelStyle={{ color: '#9ca3af', fontWeight: 'bold', fontSize: '11px', marginBottom: '4px' }}
              />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke="#6366f1" 
                strokeWidth={2.5} 
                fillOpacity={1} 
                fill="url(#areaColor)" 
                animationDuration={1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // Render Category Distribution Recharts Bar Chart
  const renderCategorySales = (data: any) => {
    if (!data || !data.success || !data.data || data.data.length === 0) {
      return (
        <div className="glass-panel p-6 rounded-2xl my-4 text-center text-slate-400">
          No category distribution found for the given criteria.
        </div>
      );
    }

    return (
      <div className="glass-panel p-5 sm:p-6 rounded-2xl my-4 border-slate-800 bg-slate-900/40 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h4 className="text-white font-bold text-base sm:text-lg">Category Sales Distribution</h4>
            <p className="text-slate-400 text-xs mt-0.5">Comparing total revenue volume and transaction count per segment.</p>
          </div>
          <span className="self-start sm:self-center px-3 py-1 bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-xs rounded-full font-medium">
            6 Core Categories
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          {/* Chart Section */}
          <div className="lg:col-span-2 w-full h-64 pr-4 sm:pr-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.data} layout="vertical" margin={{ top: 5, right: 15, left: 35, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                <XAxis 
                  type="number" 
                  stroke="#6b7280" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => `$${Math.round(val / 1000)}k`}
                />
                <YAxis 
                  type="category" 
                  dataKey="category" 
                  stroke="#e5e7eb" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  width={90}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                    borderColor: 'rgba(255,255,255,0.1)', 
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                    color: '#fff'
                  }} 
                  formatter={(value: any) => [`$${value.toLocaleString()}`, 'Revenue']}
                />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={16}>
                  {data.data.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* List Breakdown Section */}
          <div className="space-y-3">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-2">Metrics Summary</span>
            {data.data.map((cat: any, i: number) => (
              <div key={cat.category} className="flex flex-col p-2.5 rounded-xl bg-slate-950/40 border border-slate-900">
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}></span>
                    {cat.category}
                  </span>
                  <span>${cat.revenue.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 pl-4.5">
                  <span>{cat.orders} Orders</span>
                  <span>Avg: ${cat.avgOrderValue.toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Helper to intercept and render tools inline in the message
  const renderMessageContent = (msg: any) => {
    const textElements = msg.content ? (
      <div className="prose prose-invert max-w-none text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">
        {msg.content}
      </div>
    ) : null;

    if (!msg.toolInvocations || msg.toolInvocations.length === 0) {
      return textElements;
    }

    return (
      <div className="space-y-4">
        {textElements}
        
        {msg.toolInvocations.map((toolInvocation: any) => {
          const { toolCallId, toolName, state, result } = toolInvocation;
          
          if (state !== 'result' || !result) {
            return (
              <div key={toolCallId} className="text-xs text-muted-foreground animate-pulse my-2">
                Assistant is querying analytics database via {toolName}...
              </div>
            );
          }

          // Choose visualization based on Vercel AI SDK Generative UI tool payloads
          switch (toolName) {
            case 'getMetricSummary':
              return (
                <div key={toolCallId} className="grid grid-cols-1 gap-4 my-4 p-4 border border-slate-800 rounded-xl bg-slate-900/30 text-slate-200 shadow-sm max-w-sm">
                  <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <p className="text-sm font-medium tracking-tight opacity-70">{result.title}</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{result.value}</div>
                    <p className="text-xs text-emerald-400 font-semibold mt-1">{result.change} vs last quarter</p>
                  </div>
                </div>
              );

            case 'getRevenueTrends':
              return (
                <div key={toolCallId} className="my-4 p-6 border border-slate-800 rounded-xl bg-slate-950/40 w-full max-w-2xl shadow-sm">
                  <h4 className="text-sm font-semibold mb-4 text-slate-300">Revenue & Order Trends Over Time</h4>
                  
                  {/* Recharts Implementation */}
                  <div style={{ width: '100%', height: 250, minHeight: 250 }}>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={result.chartData}>
                        <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                        <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', color: '#fff', borderRadius: '8px' }} />
                        <Bar dataKey="revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Interactive Continuation Control Requirement */}
                  <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap gap-2">
                    <button 
                      onClick={() => append({ role: 'user', content: 'Break this trend down by product categories.' })}
                      className="text-xs bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-850 px-3 py-1.5 rounded-lg shadow-sm transition-all font-medium cursor-pointer hover:border-indigo-500/20"
                    >
                      🔍 View Category Breakdown
                    </button>
                    <button 
                      onClick={() => append({ role: 'user', content: 'Show me the underlying raw data table for this chart.' })}
                      className="text-xs bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-850 px-3 py-1.5 rounded-lg shadow-sm transition-all font-medium cursor-pointer hover:border-cyan-500/20"
                    >
                      📋 View Data Table
                    </button>
                  </div>
                </div>
              );

            case 'getCategorySales':
              return <div key={toolCallId}>{renderCategorySales(result)}</div>;

            default:
              return (
                <div key={toolCallId} className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-slate-400">
                  <span className="text-slate-500 font-bold block mb-1">Unrendered raw output for: {toolName}</span>
                  {JSON.stringify(result, null, 2)}
                </div>
              );
          }
        })}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100%', width: '100%', position: 'relative', backgroundColor: '#030712', overflow: 'hidden' }}>
      {/* Background neon glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#4f46e5]/10 rounded-full blur-[150px] pointer-events-none animated-glow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#06b6d4]/8 rounded-full blur-[150px] pointer-events-none animated-glow" />

      {/* LEFT SIDEBAR: BI Workspace & History Controls */}
      <aside className="w-80 bg-[#090d16] border-r border-slate-900 p-5 flex flex-col gap-6 z-10 shrink-0 overflow-y-auto" style={{ height: '100%' }}>
        {/* Title Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-extrabold text-lg tracking-tight leading-tight">Antigravity</h1>
            <span className="text-[10px] text-indigo-400 font-bold tracking-widest uppercase block mt-0.5">Analytics Chat</span>
          </div>
        </div>

        {/* Database Status Panel */}
        <div className="glass-panel p-4 rounded-xl border-slate-800/80 bg-slate-950/20">
          <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block mb-3">DATASET INTEGRITY</span>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                SQLite Engine
              </span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                Connected
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Total Seed Data</span>
              <span className="text-white font-bold">600 Orders</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Time Span</span>
              <span className="text-white font-bold">Last 4 Quarters</span>
            </div>
          </div>
        </div>

        {/* Active AI Configuration Info */}
        <div className="glass-panel p-4 rounded-xl border-slate-800/80 bg-slate-950/20">
          <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block mb-3">ORCHESTRATION LAYER</span>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                Active Provider
              </span>
              <span className="px-2 py-0.5 bg-slate-800 text-[10px] text-cyan-400 rounded-full font-bold uppercase tracking-wider">
                {process.env.NEXT_PUBLIC_AI_PROVIDER || 'local (Ollama)'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal">
              Switch provider between Anthropic, OpenAI, or Local Offline in your `.env` configuration file.
            </p>
          </div>
        </div>

        {/* Conversational Controls */}
        <div className="mt-auto pt-4 border-t border-slate-900 space-y-4">
          <button
            onClick={handleClearHistory}
            disabled={isClearing}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-red-950/20 hover:bg-red-950/40 border border-red-500/20 hover:border-red-500/40 text-red-400 hover:text-red-300 rounded-xl text-xs font-semibold transition duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isClearing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {isClearing ? 'Clearing...' : 'Clear Chat Memory'}
          </button>
          
          <div className="flex items-center gap-2 justify-center text-[10px] text-slate-500">
            <Database className="w-3 h-3" />
            <span>SQLite: `/dev.db`</span>
          </div>
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <main className="flex-1 flex flex-col z-10 relative overflow-hidden" style={{ height: '100%' }}>
        {/* Header toolbar */}
        <header className="px-6 py-4 bg-[#030712]/60 backdrop-blur-md border-b border-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
            <h2 className="text-white font-bold text-sm">BI Workspace Sandbox</h2>
          </div>
          <div className="text-[10px] text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
            Current Date Context: <span className="text-indigo-400 font-bold">May 17, 2026</span>
          </div>
        </header>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
          {loadingHistory ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              <span className="text-sm font-medium">Re-instantiating persistent session...</span>
            </div>
          ) : messages.length === 0 ? (
            /* Welcome Empty State Dashboard */
            <div className="max-w-2xl mx-auto h-full flex flex-col justify-center items-center py-12 text-center animate-in fade-in duration-500">
              <div className="w-16 h-16 rounded-3xl bg-indigo-950/50 border border-indigo-500/30 flex items-center justify-center mb-6 shadow-2xl">
                <Sparkles className="w-8 h-8 text-indigo-400" />
              </div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight mb-2 sm:text-3xl">
                Welcome to Antigravity Analytics
              </h2>
              <p className="text-slate-400 text-sm max-w-md mb-8 leading-relaxed">
                Query, segment, and visualize SQLite sales transactions using natural language. 
                I will render real interactive charts and Metric summaries inline.
              </p>

              {/* Starter Query Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full text-left">
                <button
                  onClick={() => handleQuickPrompt("Give me a high level overview of our total sales metrics and KPIs.")}
                  className="glass-panel p-4 rounded-xl border-slate-800/80 bg-slate-900/10 text-left hover:bg-slate-900/40 group cursor-pointer transition duration-300"
                >
                  <h4 className="text-white font-bold text-xs group-hover:text-indigo-400 transition">🏆 Get Sales Summary</h4>
                  <p className="text-slate-400 text-[11px] mt-1.5 leading-relaxed">Calculate total revenue, overall transactions, AOV, and top-performing sectors.</p>
                </button>

                <button
                  onClick={() => handleQuickPrompt("Show me our monthly revenue trend over the past 4 quarters.")}
                  className="glass-panel p-4 rounded-xl border-slate-800/80 bg-slate-900/10 text-left hover:bg-slate-900/40 group cursor-pointer transition duration-300"
                >
                  <h4 className="text-white font-bold text-xs group-hover:text-cyan-400 transition">📊 Trend Monthly Revenue</h4>
                  <p className="text-slate-400 text-[11px] mt-1.5 leading-relaxed">View a detailed time-series area chart of total earnings segmented by month.</p>
                </button>

                <button
                  onClick={() => handleQuickPrompt("Compare the sales performance and averages across all standard product categories.")}
                  className="glass-panel p-4 rounded-xl border-slate-800/80 bg-slate-900/10 text-left hover:bg-slate-900/40 group cursor-pointer transition duration-300"
                >
                  <h4 className="text-white font-bold text-xs group-hover:text-emerald-400 transition">🍕 Compare Categories</h4>
                  <p className="text-slate-400 text-[11px] mt-1.5 leading-relaxed">Create a visual distribution bar chart plotting total sales against categories.</p>
                </button>

                <button
                  onClick={() => handleQuickPrompt("Show me weekly electronics sales trends for the last 6 months.")}
                  className="glass-panel p-4 rounded-xl border-slate-800/80 bg-slate-900/10 text-left hover:bg-slate-900/40 group group-hover:bg-slate-900/40 cursor-pointer transition duration-300"
                >
                  <h4 className="text-white font-bold text-xs group-hover:text-purple-400 transition">⚡️ Filter & Group Segment</h4>
                  <p className="text-slate-400 text-[11px] mt-1.5 leading-relaxed">Filter database by "Electronics" and group results in detailed weekly chunks.</p>
                </button>
              </div>
            </div>
          ) : (
            /* Active Conversation Feed */
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.map((msg: any, index: number) => (
                <div 
                  key={msg.id} 
                  className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300`}
                >
                  {/* Assistant Avatar */}
                  {msg.role !== 'user' && (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-1 shadow-md">
                      AA
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div 
                    className={`max-w-[90%] p-4.5 rounded-2xl ${
                      msg.role === 'user' 
                        ? 'bg-indigo-600 border border-indigo-500/20 text-white rounded-br-none shadow-md shadow-indigo-600/10' 
                        : 'glass-panel border-slate-800 bg-[#0c1220]/60 rounded-bl-none'
                    }`}
                  >
                    {renderMessageContent(msg)}

                    {/* Interactive follow-up continuation chips (only for latest assistant message) */}
                    {msg.role !== 'user' && index === messages.length - 1 && !isLoading && (
                      <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-slate-900 animate-in fade-in duration-500">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider w-full mb-1">Interactive Follow-ups:</span>
                        <button 
                          onClick={() => handleChipClick("Show category breakdown details.")}
                          className="px-3 py-1 bg-slate-950/60 border border-slate-800 hover:border-cyan-500/30 text-[11px] text-cyan-400 rounded-full font-medium transition cursor-pointer hover:bg-cyan-950/20"
                        >
                          🍕 Category Distribution
                        </button>
                        <button 
                          onClick={() => handleChipClick("Show me a monthly revenue trend.")}
                          className="px-3 py-1 bg-slate-950/60 border border-slate-800 hover:border-indigo-500/30 text-[11px] text-indigo-400 rounded-full font-medium transition cursor-pointer hover:bg-indigo-950/20"
                        >
                          📈 Sales Trend
                        </button>
                        <button 
                          onClick={() => handleChipClick("What is the average transaction value?")}
                          className="px-3 py-1 bg-slate-950/60 border border-slate-800 hover:border-emerald-500/30 text-[11px] text-emerald-400 rounded-full font-medium transition cursor-pointer hover:bg-emerald-950/20"
                        >
                           AOV Deep Dive
                        </button>
                      </div>
                    )}
                  </div>

                  {/* User Initials Avatar */}
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-1 uppercase">
                      U
                    </div>
                  )}
                </div>
              ))}
              
              {/* Vercel AI SDK Error state rendering */}
              {error && (
                <div className="flex gap-4 items-start p-4 bg-red-950/20 border border-red-500/25 rounded-2xl max-w-4xl mx-auto text-red-400 text-sm animate-in shake duration-300">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold">Stream Error Occurred</span>
                    <p className="text-slate-300 text-xs leading-relaxed">{error.message}</p>
                    <div className="pt-2">
                      <span className="text-[10px] text-red-500 font-bold block">TROUBLESHOOTING TIP:</span>
                      <p className="text-[11px] text-slate-400 leading-normal mt-0.5">
                        If running in **Local Offline Mode**, verify Ollama is serving locally (`curl http://localhost:11434/v1/models`). 
                        Otherwise, make sure `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` are populated in your root `.env` file and restart the server.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Loading thinking indicator */}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-4 justify-start animate-pulse">
                  <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-900 flex items-center justify-center text-[10px] font-bold text-indigo-400 shrink-0 mt-1">
                    AA
                  </div>
                  <div className="glass-panel border-slate-800 bg-[#0c1220]/40 p-4.5 rounded-2xl rounded-bl-none max-w-sm flex items-center gap-3 text-xs text-slate-400 font-medium">
                    <span className="flex gap-1.5 items-center">
                      <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-0"></span>
                      <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-150"></span>
                      <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-300"></span>
                    </span>
                    <span>Querying SQLite transaction tables...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Floating suggestion chip panel (only on empty feed) */}
        {messages.length > 0 && !isLoading && (
          <div className="max-w-4xl w-full mx-auto px-6 mb-2 flex gap-1.5 items-center overflow-x-auto py-1 shrink-0 scrollbar-none">
            <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest shrink-0 mr-1.5">PROMPTS:</span>
            <button 
              onClick={() => handleQuickPrompt("Give me a high level overview of our total sales metrics and KPIs.")}
              className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-indigo-500/40 text-[10px] text-slate-300 rounded-full shrink-0 cursor-pointer transition hover:bg-slate-850"
            >
              🏆 Metrics Summary
            </button>
            <button 
              onClick={() => handleQuickPrompt("Show me our monthly revenue trend over the past 4 quarters.")}
              className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-[10px] text-slate-300 rounded-full shrink-0 cursor-pointer transition hover:bg-slate-850"
            >
              📈 Monthly Revenue Trend
            </button>
            <button 
              onClick={() => handleQuickPrompt("Compare the sales performance and averages across all standard product categories.")}
              className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-[10px] text-slate-300 rounded-full shrink-0 cursor-pointer transition hover:bg-slate-850"
            >
              🍕 Category Distribution
            </button>
          </div>
        )}

        {/* Input Form Panel */}
        <div className="px-6 pb-6 bg-gradient-to-t from-[#030712] via-[#030712] to-transparent shrink-0">
          <form 
            onSubmit={handleSubmit}
            className="max-w-4xl mx-auto relative glass-panel rounded-2xl border-slate-800/80 bg-slate-900/20 flex items-center pr-2"
          >
            <textarea
              id="chat-textarea"
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  // Trigger form submission
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Ask for 'revenue trends this quarter', 'AOV summary', or segment by 'Electronics'..."
              className="flex-1 max-h-24 min-h-12 py-3 px-4 bg-transparent border-0 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-0 resize-none font-sans"
              rows={1}
            />
            
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-650 hover:to-indigo-700 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-white shadow-md shadow-indigo-600/10 font-medium transition cursor-pointer shrink-0 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="max-w-4xl mx-auto flex items-center justify-between text-[10px] text-slate-500 mt-2 px-1">
            <span>Powered by **Vercel AI SDK** & **SQLite / Prisma**</span>
            <span>Press `Enter` to send, `Shift+Enter` for newline</span>
          </div>
        </div>
      </main>
    </div>
  );
}
