/**
 * SignalFlow - Product Feedback Intelligence for PMs
 * 
 * A Cloudflare Workers application that aggregates and analyzes
 * product feedback using AI to help PMs make better decisions.
 * 
 * Cloudflare Products Used:
 * - Workers: API and frontend hosting
 * - D1: SQLite database for feedback storage
 * - Workers AI: Sentiment and theme analysis
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Enable CORS for API requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route requests
      if (path === '/' || path === '/index.html') {
        return serveDashboard();
      }
      
      if (path === '/api/overview') {
        return await getOverview(env, corsHeaders);
      }
      
      if (path === '/api/feedback') {
        return await getFeedback(env, url, corsHeaders);
      }
      
      if (path === '/api/themes') {
        return await getThemes(env, corsHeaders);
      }
      
      if (path === '/api/sentiment-trend') {
        return await getSentimentTrend(env, corsHeaders);
      }
      
      if (path === '/api/analyze' && request.method === 'POST') {
        return await analyzeWithAI(env, request, corsHeaders);
      }
      
      if (path === '/api/theme-detail') {
        const theme = url.searchParams.get('theme');
        return await getThemeDetail(env, theme, corsHeaders);
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

// Get overview statistics for the dashboard
async function getOverview(env, corsHeaders) {
  const stats = await env.DB.prepare(`
    SELECT 
      COUNT(*) as total_feedback,
      SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) as positive,
      SUM(CASE WHEN sentiment = 'neutral' THEN 1 ELSE 0 END) as neutral,
      SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) as negative,
      SUM(CASE WHEN urgency = 'critical' THEN 1 ELSE 0 END) as critical_count,
      SUM(CASE WHEN urgency = 'high' THEN 1 ELSE 0 END) as high_count,
      AVG(sentiment_score) as avg_sentiment
    FROM feedback
    WHERE analyzed = 1
  `).first();

  // Get top themes needing attention
  const topThemes = await env.DB.prepare(`
    SELECT 
      theme,
      COUNT(*) as count,
      AVG(sentiment_score) as avg_sentiment,
      SUM(CASE WHEN urgency IN ('critical', 'high') THEN 1 ELSE 0 END) as urgent_count
    FROM feedback
    WHERE analyzed = 1 AND theme != 'uncategorized'
    GROUP BY theme
    ORDER BY urgent_count DESC, count DESC
    LIMIT 5
  `).all();

  // Get channel distribution
  const channels = await env.DB.prepare(`
    SELECT channel, COUNT(*) as count
    FROM feedback
    GROUP BY channel
    ORDER BY count DESC
  `).all();

  return new Response(JSON.stringify({
    stats,
    topThemes: topThemes.results,
    channels: channels.results,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Get filtered feedback list
async function getFeedback(env, url, corsHeaders) {
  const sentiment = url.searchParams.get('sentiment');
  const theme = url.searchParams.get('theme');
  const urgency = url.searchParams.get('urgency');
  const channel = url.searchParams.get('channel');
  const limit = parseInt(url.searchParams.get('limit') || '50');

  let query = 'SELECT * FROM feedback WHERE analyzed = 1';
  const params = [];

  if (sentiment && sentiment !== 'all') {
    query += ' AND sentiment = ?';
    params.push(sentiment);
  }
  if (theme && theme !== 'all') {
    query += ' AND theme = ?';
    params.push(theme);
  }
  if (urgency && urgency !== 'all') {
    query += ' AND urgency = ?';
    params.push(urgency);
  }
  if (channel && channel !== 'all') {
    query += ' AND channel = ?';
    params.push(channel);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const result = await env.DB.prepare(query).bind(...params).all();

  return new Response(JSON.stringify(result.results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Get theme statistics
async function getThemes(env, corsHeaders) {
  const themes = await env.DB.prepare(`
    SELECT 
      theme,
      COUNT(*) as total,
      SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) as positive,
      SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) as negative,
      SUM(CASE WHEN urgency = 'critical' THEN 1 ELSE 0 END) as critical,
      SUM(CASE WHEN urgency = 'high' THEN 1 ELSE 0 END) as high,
      AVG(sentiment_score) as avg_sentiment
    FROM feedback
    WHERE analyzed = 1 AND theme != 'uncategorized'
    GROUP BY theme
    ORDER BY total DESC
  `).all();

  return new Response(JSON.stringify(themes.results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Get sentiment trend over time
async function getSentimentTrend(env, corsHeaders) {
  const trend = await env.DB.prepare(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as total,
      AVG(sentiment_score) as avg_sentiment,
      SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) as positive,
      SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) as negative
    FROM feedback
    WHERE analyzed = 1
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 14
  `).all();

  return new Response(JSON.stringify(trend.results.reverse()), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Get detailed view for a specific theme
async function getThemeDetail(env, theme, corsHeaders) {
  if (!theme) {
    return new Response(JSON.stringify({ error: 'Theme parameter required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get theme stats
  const stats = await env.DB.prepare(`
    SELECT 
      COUNT(*) as total,
      AVG(sentiment_score) as avg_sentiment,
      SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) as positive,
      SUM(CASE WHEN sentiment = 'neutral' THEN 1 ELSE 0 END) as neutral,
      SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) as negative,
      SUM(CASE WHEN urgency = 'critical' THEN 1 ELSE 0 END) as critical,
      SUM(CASE WHEN urgency = 'high' THEN 1 ELSE 0 END) as high
    FROM feedback
    WHERE theme = ? AND analyzed = 1
  `).bind(theme).first();

  // Get channel breakdown
  const channels = await env.DB.prepare(`
    SELECT channel, COUNT(*) as count
    FROM feedback
    WHERE theme = ? AND analyzed = 1
    GROUP BY channel
  `).bind(theme).all();

  // Get sample feedback
  const samples = await env.DB.prepare(`
    SELECT *
    FROM feedback
    WHERE theme = ? AND analyzed = 1
    ORDER BY 
      CASE urgency 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        ELSE 4 
      END,
      created_at DESC
    LIMIT 10
  `).bind(theme).all();

  // Get trend for this theme
  const trend = await env.DB.prepare(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as count,
      AVG(sentiment_score) as avg_sentiment
    FROM feedback
    WHERE theme = ? AND analyzed = 1
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 7
  `).bind(theme).all();

  return new Response(JSON.stringify({
    theme,
    stats,
    channels: channels.results,
    samples: samples.results,
    trend: trend.results.reverse(),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Analyze feedback using Workers AI
async function analyzeWithAI(env, request, corsHeaders) {
  const { content } = await request.json();
  
  if (!content) {
    return new Response(JSON.stringify({ error: 'Content required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Use Workers AI for analysis
  const prompt = `Analyze this product feedback and respond in JSON format only:

Feedback: "${content}"

Respond with exactly this JSON structure (no other text):
{
  "sentiment": "positive" or "neutral" or "negative",
  "sentiment_score": number from -1.0 to 1.0,
  "theme": one of ["performance", "pricing", "documentation", "developer-experience", "reliability", "feature-request", "other"],
  "urgency": "low" or "medium" or "high" or "critical",
  "summary": "one sentence summary of the feedback"
}`;

  try {
    const aiResponse = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
        { role: 'system', content: 'You are a product feedback analyzer. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 200,
    });

    // Parse the AI response
    let analysis;
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiResponse.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      // Fallback if AI response is not valid JSON
      analysis = {
        sentiment: 'neutral',
        sentiment_score: 0,
        theme: 'other',
        urgency: 'medium',
        summary: 'Unable to parse AI response',
        raw_response: aiResponse.response,
      };
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (aiError) {
    // If AI fails, return a basic analysis
    return new Response(JSON.stringify({
      sentiment: 'neutral',
      sentiment_score: 0,
      theme: 'other',
      urgency: 'medium',
      summary: 'AI analysis unavailable',
      error: aiError.message,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// Serve the dashboard HTML
function serveDashboard() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SignalFlow - Product Feedback Intelligence</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root {
      --bg-primary: #0a0a0f;
      --bg-secondary: #12121a;
      --bg-card: #1a1a24;
      --border: #2a2a3a;
      --text-primary: #f0f0f5;
      --text-secondary: #8888a0;
      --accent: #f6821f;
      --accent-light: #ff9a47;
      --positive: #10b981;
      --negative: #ef4444;
      --neutral: #6b7280;
      --critical: #dc2626;
      --high: #f97316;
      --medium: #eab308;
      --low: #22c55e;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      line-height: 1.6;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border);
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .logo-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, var(--accent), var(--accent-light));
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
    }

    .logo h1 {
      font-size: 1.5rem;
      font-weight: 700;
      background: linear-gradient(135deg, var(--text-primary), var(--accent-light));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .logo p {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
    }

    .stat-label {
      font-size: 0.8rem;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.5rem;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 700;
    }

    .stat-value.positive { color: var(--positive); }
    .stat-value.negative { color: var(--negative); }
    .stat-value.critical { color: var(--critical); }

    .main-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    @media (max-width: 1024px) {
      .main-grid {
        grid-template-columns: 1fr;
      }
    }

    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .card-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .themes-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .theme-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      background: var(--bg-secondary);
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .theme-item:hover {
      background: var(--border);
    }

    .theme-name {
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .theme-count {
      background: var(--bg-primary);
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.8rem;
      color: var(--text-secondary);
    }

    .urgency-badge {
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .urgency-critical { background: var(--critical); color: white; }
    .urgency-high { background: var(--high); color: white; }
    .urgency-medium { background: var(--medium); color: black; }
    .urgency-low { background: var(--low); color: white; }

    .sentiment-bar {
      display: flex;
      height: 8px;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 0.5rem;
    }

    .sentiment-bar .positive { background: var(--positive); }
    .sentiment-bar .neutral { background: var(--neutral); }
    .sentiment-bar .negative { background: var(--negative); }

    .feedback-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .feedback-item {
      padding: 1rem;
      background: var(--bg-secondary);
      border-radius: 8px;
      border-left: 3px solid var(--accent);
    }

    .feedback-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.5rem;
    }

    .feedback-meta {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .channel-badge {
      padding: 0.2rem 0.5rem;
      background: var(--bg-primary);
      border-radius: 4px;
      font-size: 0.7rem;
      color: var(--text-secondary);
    }

    .feedback-content {
      color: var(--text-secondary);
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .filters {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }

    .filter-select {
      padding: 0.5rem 1rem;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 0.9rem;
      cursor: pointer;
    }

    .filter-select:focus {
      outline: none;
      border-color: var(--accent);
    }

    .chart-container {
      height: 250px;
      position: relative;
    }

    .ai-demo {
      margin-top: 2rem;
    }

    .ai-input {
      width: 100%;
      padding: 1rem;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 0.9rem;
      resize: vertical;
      min-height: 100px;
      margin-bottom: 1rem;
    }

    .ai-input:focus {
      outline: none;
      border-color: var(--accent);
    }

    .btn {
      padding: 0.75rem 1.5rem;
      background: linear-gradient(135deg, var(--accent), var(--accent-light));
      border: none;
      border-radius: 8px;
      color: white;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(246, 130, 31, 0.3);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .ai-result {
      margin-top: 1rem;
      padding: 1rem;
      background: var(--bg-secondary);
      border-radius: 8px;
      display: none;
    }

    .ai-result.show {
      display: block;
    }

    .result-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
    }

    .result-item {
      text-align: center;
    }

    .result-label {
      font-size: 0.75rem;
      color: var(--text-secondary);
      text-transform: uppercase;
      margin-bottom: 0.25rem;
    }

    .result-value {
      font-weight: 600;
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s, visibility 0.3s;
    }

    .modal-overlay.show {
      opacity: 1;
      visibility: visible;
    }

    .modal {
      background: var(--bg-card);
      border-radius: 16px;
      padding: 2rem;
      max-width: 800px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }

    .modal-close {
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 1.5rem;
      cursor: pointer;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      color: var(--text-secondary);
    }

    .spinner {
      width: 24px;
      height: 24px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-right: 0.5rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .architecture {
      margin-top: 2rem;
      padding: 1.5rem;
      background: var(--bg-secondary);
      border-radius: 12px;
    }

    .architecture h3 {
      margin-bottom: 1rem;
      color: var(--accent);
    }

    .arch-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .arch-item {
      padding: 1rem;
      background: var(--bg-card);
      border-radius: 8px;
      border-left: 3px solid var(--accent);
    }

    .arch-item h4 {
      color: var(--accent-light);
      margin-bottom: 0.5rem;
    }

    .arch-item p {
      font-size: 0.85rem;
      color: var(--text-secondary);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">
        <div class="logo-icon">📊</div>
        <div>
          <h1>SignalFlow</h1>
          <p>Product Feedback Intelligence</p>
        </div>
      </div>
      <div style="color: var(--text-secondary); font-size: 0.9rem;">
        Last updated: ${new Date().toLocaleDateString()}
      </div>
    </header>

    <!-- Stats Overview -->
    <div class="stats-grid" id="stats-grid">
      <div class="loading"><div class="spinner"></div>Loading stats...</div>
    </div>

    <!-- Main Dashboard Grid -->
    <div class="main-grid">
      <!-- Sentiment Trend Chart -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">📈 Sentiment Trend (Last 14 Days)</h2>
        </div>
        <div class="chart-container">
          <canvas id="sentimentChart"></canvas>
        </div>
      </div>

      <!-- Top Themes -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">🔥 Themes Needing Attention</h2>
        </div>
        <div class="themes-list" id="themes-list">
          <div class="loading"><div class="spinner"></div>Loading...</div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <select class="filter-select" id="filter-sentiment">
        <option value="all">All Sentiment</option>
        <option value="positive">Positive</option>
        <option value="neutral">Neutral</option>
        <option value="negative">Negative</option>
      </select>
      <select class="filter-select" id="filter-theme">
        <option value="all">All Themes</option>
        <option value="performance">Performance</option>
        <option value="pricing">Pricing</option>
        <option value="documentation">Documentation</option>
        <option value="developer-experience">Developer Experience</option>
        <option value="reliability">Reliability</option>
        <option value="feature-request">Feature Request</option>
      </select>
      <select class="filter-select" id="filter-urgency">
        <option value="all">All Urgency</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <select class="filter-select" id="filter-channel">
        <option value="all">All Channels</option>
        <option value="support">Support</option>
        <option value="github">GitHub</option>
        <option value="discord">Discord</option>
        <option value="twitter">Twitter</option>
        <option value="forum">Forum</option>
      </select>
    </div>

    <!-- Feedback List -->
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">📝 Recent Feedback</h2>
      </div>
      <div class="feedback-list" id="feedback-list">
        <div class="loading"><div class="spinner"></div>Loading feedback...</div>
      </div>
    </div>

    <!-- AI Analysis Demo -->
    <div class="card ai-demo">
      <div class="card-header">
        <h2 class="card-title">🤖 AI Feedback Analyzer (Workers AI Demo)</h2>
      </div>
      <p style="color: var(--text-secondary); margin-bottom: 1rem; font-size: 0.9rem;">
        Paste any feedback text below to see how Workers AI analyzes sentiment, theme, and urgency.
      </p>
      <textarea class="ai-input" id="ai-input" placeholder="Example: We've been waiting 3 weeks for a fix to the cold start issue. This is blocking our production deployment and costing us customers. Please prioritize this ASAP!"></textarea>
      <button class="btn" id="analyze-btn" onclick="analyzeWithAI()">Analyze with AI</button>
      <div class="ai-result" id="ai-result">
        <div class="result-grid">
          <div class="result-item">
            <div class="result-label">Sentiment</div>
            <div class="result-value" id="result-sentiment">-</div>
          </div>
          <div class="result-item">
            <div class="result-label">Score</div>
            <div class="result-value" id="result-score">-</div>
          </div>
          <div class="result-item">
            <div class="result-label">Theme</div>
            <div class="result-value" id="result-theme">-</div>
          </div>
          <div class="result-item">
            <div class="result-label">Urgency</div>
            <div class="result-value" id="result-urgency">-</div>
          </div>
        </div>
        <div style="margin-top: 1rem;">
          <div class="result-label">Summary</div>
          <div id="result-summary" style="color: var(--text-secondary); font-size: 0.9rem;"></div>
        </div>
      </div>
    </div>

    <!-- Architecture Overview -->
    <div class="architecture">
      <h3>🏗️ Architecture Overview</h3>
      <div class="arch-grid">
        <div class="arch-item">
          <h4>Cloudflare Workers</h4>
          <p>Hosts the API and dashboard. Handles routing, data fetching, and serves the UI globally with low latency.</p>
        </div>
        <div class="arch-item">
          <h4>D1 Database</h4>
          <p>SQLite database storing all feedback data and aggregated metrics. Enables fast filtering and analytics queries.</p>
        </div>
        <div class="arch-item">
          <h4>Workers AI</h4>
          <p>Analyzes feedback for sentiment, themes, and urgency using LLaMA 3 model. Runs entirely on Cloudflare's edge.</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Theme Detail Modal -->
  <div class="modal-overlay" id="modal-overlay">
    <div class="modal">
      <div class="modal-header">
        <h2 id="modal-title">Theme Details</h2>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div id="modal-content">
        <div class="loading"><div class="spinner"></div>Loading...</div>
      </div>
    </div>
  </div>

  <script>
    let sentimentChart = null;

    // Initialize dashboard
    async function init() {
      await Promise.all([
        loadStats(),
        loadThemes(),
        loadFeedback(),
        loadSentimentTrend()
      ]);

      // Set up filter listeners
      document.querySelectorAll('.filter-select').forEach(select => {
        select.addEventListener('change', loadFeedback);
      });
    }

    // Load overview statistics
    async function loadStats() {
      try {
        const res = await fetch('/api/overview');
        const data = await res.json();
        
        const statsHtml = \`
          <div class="stat-card">
            <div class="stat-label">Total Feedback</div>
            <div class="stat-value">\${data.stats.total_feedback || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Positive</div>
            <div class="stat-value positive">\${data.stats.positive || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Negative</div>
            <div class="stat-value negative">\${data.stats.negative || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Critical Issues</div>
            <div class="stat-value critical">\${data.stats.critical_count || 0}</div>
          </div>
        \`;
        document.getElementById('stats-grid').innerHTML = statsHtml;
      } catch (error) {
        console.error('Error loading stats:', error);
        document.getElementById('stats-grid').innerHTML = '<div class="stat-card">Error loading stats</div>';
      }
    }

    // Load themes list
    async function loadThemes() {
      try {
        const res = await fetch('/api/themes');
        const themes = await res.json();
        
        if (themes.length === 0) {
          document.getElementById('themes-list').innerHTML = '<p style="color: var(--text-secondary);">No themes found</p>';
          return;
        }

        const themesHtml = themes.map(theme => {
          const total = theme.total || 1;
          const posWidth = ((theme.positive || 0) / total * 100).toFixed(0);
          const negWidth = ((theme.negative || 0) / total * 100).toFixed(0);
          const neutWidth = 100 - posWidth - negWidth;
          
          const urgencyClass = (theme.critical > 0) ? 'critical' : (theme.high > 0) ? 'high' : 'medium';
          
          return \`
            <div class="theme-item" onclick="openThemeModal('\${theme.theme}')">
              <div>
                <div class="theme-name">
                  \${getThemeIcon(theme.theme)} \${formatThemeName(theme.theme)}
                  \${theme.critical > 0 ? '<span class="urgency-badge urgency-critical">critical</span>' : ''}
                </div>
                <div class="sentiment-bar">
                  <div class="positive" style="width: \${posWidth}%"></div>
                  <div class="neutral" style="width: \${neutWidth}%"></div>
                  <div class="negative" style="width: \${negWidth}%"></div>
                </div>
              </div>
              <span class="theme-count">\${theme.total}</span>
            </div>
          \`;
        }).join('');
        
        document.getElementById('themes-list').innerHTML = themesHtml;
      } catch (error) {
        console.error('Error loading themes:', error);
        document.getElementById('themes-list').innerHTML = '<p>Error loading themes</p>';
      }
    }

    // Load feedback list with filters
    async function loadFeedback() {
      const sentiment = document.getElementById('filter-sentiment').value;
      const theme = document.getElementById('filter-theme').value;
      const urgency = document.getElementById('filter-urgency').value;
      const channel = document.getElementById('filter-channel').value;
      
      const params = new URLSearchParams({ sentiment, theme, urgency, channel });
      
      try {
        const res = await fetch(\`/api/feedback?\${params}\`);
        const feedback = await res.json();
        
        if (feedback.length === 0) {
          document.getElementById('feedback-list').innerHTML = '<p style="color: var(--text-secondary);">No feedback matches these filters</p>';
          return;
        }

        const feedbackHtml = feedback.slice(0, 20).map(item => \`
          <div class="feedback-item">
            <div class="feedback-header">
              <div class="feedback-meta">
                <span class="channel-badge">\${item.channel}</span>
                <span class="urgency-badge urgency-\${item.urgency}">\${item.urgency}</span>
                <span style="color: \${getSentimentColor(item.sentiment)}">\${item.sentiment}</span>
              </div>
              <span style="color: var(--text-secondary); font-size: 0.8rem;">\${formatDate(item.created_at)}</span>
            </div>
            \${item.title ? \`<div style="font-weight: 500; margin-bottom: 0.5rem;">\${escapeHtml(item.title)}</div>\` : ''}
            <div class="feedback-content">\${escapeHtml(item.content)}</div>
          </div>
        \`).join('');
        
        document.getElementById('feedback-list').innerHTML = feedbackHtml;
      } catch (error) {
        console.error('Error loading feedback:', error);
        document.getElementById('feedback-list').innerHTML = '<p>Error loading feedback</p>';
      }
    }

    // Load sentiment trend for chart
    async function loadSentimentTrend() {
      try {
        const res = await fetch('/api/sentiment-trend');
        const trend = await res.json();
        
        const ctx = document.getElementById('sentimentChart').getContext('2d');
        
        if (sentimentChart) {
          sentimentChart.destroy();
        }

        sentimentChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: trend.map(d => formatDate(d.date)),
            datasets: [
              {
                label: 'Sentiment Score',
                data: trend.map(d => ((d.avg_sentiment + 1) / 2 * 100).toFixed(0)),
                borderColor: '#f6821f',
                backgroundColor: 'rgba(246, 130, 31, 0.1)',
                fill: true,
                tension: 0.4,
              },
              {
                label: 'Feedback Volume',
                data: trend.map(d => d.total),
                borderColor: '#6b7280',
                backgroundColor: 'transparent',
                borderDash: [5, 5],
                tension: 0.4,
                yAxisID: 'y1',
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                labels: { color: '#8888a0' }
              }
            },
            scales: {
              y: {
                min: 0,
                max: 100,
                title: { display: true, text: 'Sentiment %', color: '#8888a0' },
                ticks: { color: '#8888a0' },
                grid: { color: '#2a2a3a' }
              },
              y1: {
                position: 'right',
                title: { display: true, text: 'Volume', color: '#8888a0' },
                ticks: { color: '#8888a0' },
                grid: { display: false }
              },
              x: {
                ticks: { color: '#8888a0' },
                grid: { color: '#2a2a3a' }
              }
            }
          }
        });
      } catch (error) {
        console.error('Error loading trend:', error);
      }
    }

    // Analyze feedback with AI
    async function analyzeWithAI() {
      const content = document.getElementById('ai-input').value.trim();
      if (!content) {
        alert('Please enter some feedback text');
        return;
      }

      const btn = document.getElementById('analyze-btn');
      const resultDiv = document.getElementById('ai-result');
      
      btn.disabled = true;
      btn.textContent = 'Analyzing...';

      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content })
        });
        
        const result = await res.json();
        
        document.getElementById('result-sentiment').textContent = result.sentiment || 'N/A';
        document.getElementById('result-sentiment').style.color = getSentimentColor(result.sentiment);
        document.getElementById('result-score').textContent = result.sentiment_score?.toFixed(2) || 'N/A';
        document.getElementById('result-theme').textContent = formatThemeName(result.theme || 'N/A');
        document.getElementById('result-urgency').textContent = result.urgency || 'N/A';
        document.getElementById('result-urgency').className = \`result-value urgency-\${result.urgency}\`;
        document.getElementById('result-summary').textContent = result.summary || 'No summary available';
        
        resultDiv.classList.add('show');
      } catch (error) {
        console.error('Error analyzing:', error);
        alert('Error analyzing feedback. Please try again.');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Analyze with AI';
      }
    }

    // Open theme detail modal
    async function openThemeModal(theme) {
      const overlay = document.getElementById('modal-overlay');
      const content = document.getElementById('modal-content');
      const title = document.getElementById('modal-title');
      
      title.textContent = formatThemeName(theme);
      content.innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>';
      overlay.classList.add('show');
      
      try {
        const res = await fetch(\`/api/theme-detail?theme=\${theme}\`);
        const data = await res.json();
        
        content.innerHTML = \`
          <div class="stats-grid" style="margin-bottom: 1.5rem;">
            <div class="stat-card">
              <div class="stat-label">Total</div>
              <div class="stat-value">\${data.stats.total}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Positive</div>
              <div class="stat-value positive">\${data.stats.positive}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Negative</div>
              <div class="stat-value negative">\${data.stats.negative}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Critical</div>
              <div class="stat-value critical">\${data.stats.critical}</div>
            </div>
          </div>
          
          <h3 style="margin-bottom: 1rem;">Channel Distribution</h3>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
            \${data.channels.map(c => \`<span class="channel-badge">\${c.channel}: \${c.count}</span>\`).join('')}
          </div>
          
          <h3 style="margin-bottom: 1rem;">Sample Feedback</h3>
          <div class="feedback-list">
            \${data.samples.slice(0, 5).map(item => \`
              <div class="feedback-item">
                <div class="feedback-header">
                  <div class="feedback-meta">
                    <span class="channel-badge">\${item.channel}</span>
                    <span class="urgency-badge urgency-\${item.urgency}">\${item.urgency}</span>
                  </div>
                </div>
                <div class="feedback-content">\${escapeHtml(item.content)}</div>
              </div>
            \`).join('')}
          </div>
        \`;
      } catch (error) {
        content.innerHTML = '<p>Error loading theme details</p>';
      }
    }

    function closeModal() {
      document.getElementById('modal-overlay').classList.remove('show');
    }

    // Utility functions
    function formatThemeName(theme) {
      return theme.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    function getThemeIcon(theme) {
      const icons = {
        'performance': '⚡',
        'pricing': '💰',
        'documentation': '📚',
        'developer-experience': '🛠️',
        'reliability': '🔒',
        'feature-request': '✨',
        'other': '📋'
      };
      return icons[theme] || '📋';
    }

    function getSentimentColor(sentiment) {
      const colors = {
        'positive': '#10b981',
        'neutral': '#6b7280',
        'negative': '#ef4444'
      };
      return colors[sentiment] || '#6b7280';
    }

    function formatDate(dateStr) {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Close modal on overlay click
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') closeModal();
    });

    // Initialize on load
    init();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
