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

      if (path === '/api/distributions') {
        return await getDistributions(env, corsHeaders);
      }

      if (path === '/api/summarize' && request.method === 'POST') {
        return await summarizeFeedback(env, request, corsHeaders);
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

// Get distributions for pie charts
async function getDistributions(env, corsHeaders) {
  // Sentiment distribution
  const sentiment = await env.DB.prepare(`
    SELECT sentiment, COUNT(*) as count
    FROM feedback
    WHERE analyzed = 1
    GROUP BY sentiment
  `).all();

  // Urgency distribution
  const urgency = await env.DB.prepare(`
    SELECT urgency, COUNT(*) as count
    FROM feedback
    WHERE analyzed = 1
    GROUP BY urgency
  `).all();

  // Value distribution
  const value = await env.DB.prepare(`
    SELECT value_score, COUNT(*) as count
    FROM feedback
    WHERE analyzed = 1
    GROUP BY value_score
  `).all();

  // Theme distribution
  const theme = await env.DB.prepare(`
    SELECT theme, COUNT(*) as count
    FROM feedback
    WHERE analyzed = 1 AND theme != 'uncategorized'
    GROUP BY theme
    ORDER BY count DESC
  `).all();

  return new Response(JSON.stringify({
    sentiment: sentiment.results,
    urgency: urgency.results,
    value: value.results,
    theme: theme.results,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

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

  // Get top theme (most discussed)
  const topTheme = await env.DB.prepare(`
    SELECT 
      theme,
      COUNT(*) as count,
      AVG(sentiment_score) as avg_sentiment,
      SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) as positive,
      SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) as negative,
      SUM(CASE WHEN urgency IN ('critical', 'high') THEN 1 ELSE 0 END) as urgent_count
    FROM feedback
    WHERE analyzed = 1 AND theme != 'uncategorized'
    GROUP BY theme
    ORDER BY count DESC
    LIMIT 1
  `).first();

  return new Response(JSON.stringify({
    stats,
    topThemes: topThemes.results,
    channels: channels.results,
    topTheme,
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
      SUM(CASE WHEN urgency = 'high' THEN 1 ELSE 0 END) as high,
      SUM(CASE WHEN urgency = 'medium' THEN 1 ELSE 0 END) as medium,
      SUM(CASE WHEN urgency = 'low' THEN 1 ELSE 0 END) as low
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

  // Get daily sentiment trend for this theme
  const trend = await env.DB.prepare(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as count,
      AVG(sentiment_score) as avg_sentiment,
      SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) as positive,
      SUM(CASE WHEN sentiment = 'neutral' THEN 1 ELSE 0 END) as neutral,
      SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) as negative
    FROM feedback
    WHERE theme = ? AND analyzed = 1
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 14
  `).bind(theme).all();

  // Get recent feedback for summary (last 10 items)
  const recentForSummary = await env.DB.prepare(`
    SELECT content
    FROM feedback
    WHERE theme = ? AND analyzed = 1
    ORDER BY created_at DESC
    LIMIT 10
  `).bind(theme).all();

  return new Response(JSON.stringify({
    theme,
    stats,
    channels: channels.results,
    samples: samples.results,
    trend: trend.results.reverse(),
    recentFeedbackTexts: recentForSummary.results.map(r => r.content),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Summarize feedback using Workers AI
async function summarizeFeedback(env, request, corsHeaders) {
  const { feedbackTexts, theme } = await request.json();
  
  if (!feedbackTexts || feedbackTexts.length === 0) {
    return new Response(JSON.stringify({ summary: 'No feedback to summarize.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const combinedFeedback = feedbackTexts.slice(0, 10).join('\n---\n');
  
  const prompt = `You are a product manager analyzing customer feedback about "${theme}". 

Here are the most recent feedback items:

${combinedFeedback}

Please provide a concise 2-3 sentence summary that:
1. Identifies the main pain points or requests
2. Notes any patterns or common themes
3. Suggests what action might be needed

Keep it actionable and professional.`;

  try {
    const aiResponse = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
        { role: 'system', content: 'You are a helpful product management assistant that summarizes customer feedback concisely and actionably.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 300,
    });

    return new Response(JSON.stringify({ 
      summary: aiResponse.response 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (aiError) {
    return new Response(JSON.stringify({
      summary: 'Unable to generate AI summary. Please review the feedback manually.',
      error: aiError.message,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
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

    .sentiment-badge {
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .sentiment-positive { background: var(--positive); color: white; }
    .sentiment-neutral { background: var(--neutral); color: white; }
    .sentiment-negative { background: var(--negative); color: white; }

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

    .chart-container-small {
      height: 200px;
      position: relative;
    }

    .pie-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .pie-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
    }

    .pie-chart-container {
      height: 220px;
      position: relative;
    }

    .top-theme-card {
      background: linear-gradient(135deg, var(--bg-card), #1f1f2e);
      border: 2px solid var(--accent);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }

    .top-theme-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .top-theme-icon {
      font-size: 2.5rem;
    }

    .top-theme-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--accent);
    }

    .top-theme-subtitle {
      font-size: 0.9rem;
      color: var(--text-secondary);
    }

    .top-theme-stats {
      display: flex;
      gap: 2rem;
      flex-wrap: wrap;
    }

    .top-theme-stat {
      text-align: center;
    }

    .top-theme-stat-value {
      font-size: 1.5rem;
      font-weight: 700;
    }

    .top-theme-stat-label {
      font-size: 0.75rem;
      color: var(--text-secondary);
      text-transform: uppercase;
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
      max-width: 900px;
      width: 90%;
      max-height: 85vh;
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

    .summary-box {
      background: linear-gradient(135deg, #1a1a2e, #16213e);
      border: 1px solid var(--accent);
      border-radius: 12px;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
    }

    .summary-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 600;
      color: var(--accent);
      margin-bottom: 0.75rem;
    }

    .summary-text {
      color: var(--text-secondary);
      font-size: 0.95rem;
      line-height: 1.6;
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

    .section-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .modal-section {
      margin-bottom: 1.5rem;
    }

    .trend-chart-modal {
      height: 200px;
      margin-bottom: 1.5rem;
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

    <!-- Top Theme Section -->
    <div id="top-theme-section"></div>

    <!-- Distribution Pie Charts -->
    <div class="pie-grid">
      <div class="pie-card">
        <div class="card-header">
          <h2 class="card-title">😊 Sentiment Distribution</h2>
        </div>
        <div class="pie-chart-container">
          <canvas id="sentimentPieChart"></canvas>
        </div>
      </div>
      <div class="pie-card">
        <div class="card-header">
          <h2 class="card-title">🚨 Urgency Distribution</h2>
        </div>
        <div class="pie-chart-container">
          <canvas id="urgencyPieChart"></canvas>
        </div>
      </div>
      <div class="pie-card">
        <div class="card-header">
          <h2 class="card-title">💎 Value Distribution</h2>
        </div>
        <div class="pie-chart-container">
          <canvas id="valuePieChart"></canvas>
        </div>
      </div>
      <div class="pie-card">
        <div class="card-header">
          <h2 class="card-title">📁 Theme Distribution</h2>
        </div>
        <div class="pie-chart-container">
          <canvas id="themePieChart"></canvas>
        </div>
      </div>
    </div>

    <!-- Urgency Bar Chart -->
    <div class="card" style="margin-bottom: 2rem;">
      <div class="card-header">
        <h2 class="card-title">📊 Priority/Urgency Breakdown</h2>
      </div>
      <div class="chart-container">
        <canvas id="urgencyBarChart"></canvas>
      </div>
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
        <option value="positive">😊 Positive</option>
        <option value="neutral">😐 Neutral</option>
        <option value="negative">😞 Negative</option>
      </select>
      <select class="filter-select" id="filter-theme">
        <option value="all">All Themes</option>
        <option value="performance">⚡ Performance</option>
        <option value="pricing">💰 Pricing</option>
        <option value="documentation">📚 Documentation</option>
        <option value="developer-experience">🛠️ Developer Experience</option>
        <option value="reliability">🔒 Reliability</option>
        <option value="feature-request">✨ Feature Request</option>
      </select>
      <select class="filter-select" id="filter-urgency">
        <option value="all">All Urgency</option>
        <option value="critical">🔴 Critical</option>
        <option value="high">🟠 High</option>
        <option value="medium">🟡 Medium</option>
        <option value="low">🟢 Low</option>
      </select>
      <select class="filter-select" id="filter-channel">
        <option value="all">All Channels</option>
        <option value="support">🎫 Support</option>
        <option value="github">🐙 GitHub</option>
        <option value="discord">💬 Discord</option>
        <option value="twitter">🐦 Twitter</option>
        <option value="forum">📝 Forum</option>
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
    let sentimentPieChart = null;
    let urgencyPieChart = null;
    let valuePieChart = null;
    let themePieChart = null;
    let urgencyBarChart = null;
    let modalTrendChart = null;

    // Chart.js default settings
    Chart.defaults.color = '#8888a0';
    Chart.defaults.borderColor = '#2a2a3a';

    // Initialize dashboard
    async function init() {
      await Promise.all([
        loadStats(),
        loadThemes(),
        loadFeedback(),
        loadSentimentTrend(),
        loadDistributions()
      ]);

      // Set up filter listeners
      document.querySelectorAll('.filter-select').forEach(select => {
        select.addEventListener('change', loadFeedback);
      });
    }

    // Load distribution data for pie charts
    async function loadDistributions() {
      try {
        const res = await fetch('/api/distributions');
        const data = await res.json();
        
        renderSentimentPie(data.sentiment);
        renderUrgencyPie(data.urgency);
        renderValuePie(data.value);
        renderThemePie(data.theme);
        renderUrgencyBar(data.urgency);
      } catch (error) {
        console.error('Error loading distributions:', error);
      }
    }

    function renderSentimentPie(data) {
      const ctx = document.getElementById('sentimentPieChart').getContext('2d');
      if (sentimentPieChart) sentimentPieChart.destroy();
      
      const colors = {
        'positive': '#10b981',
        'neutral': '#6b7280',
        'negative': '#ef4444'
      };
      
      const labels = data.map(d => d.sentiment.charAt(0).toUpperCase() + d.sentiment.slice(1));
      const values = data.map(d => d.count);
      const bgColors = data.map(d => colors[d.sentiment] || '#6b7280');
      
      sentimentPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: values,
            backgroundColor: bgColors,
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { 
                padding: 15,
                usePointStyle: true
              }
            }
          }
        }
      });
    }

    function renderUrgencyPie(data) {
      const ctx = document.getElementById('urgencyPieChart').getContext('2d');
      if (urgencyPieChart) urgencyPieChart.destroy();
      
      const colors = {
        'critical': '#dc2626',
        'high': '#f97316',
        'medium': '#eab308',
        'low': '#22c55e'
      };
      
      const order = ['critical', 'high', 'medium', 'low'];
      const sorted = order.map(u => data.find(d => d.urgency === u)).filter(Boolean);
      
      urgencyPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: sorted.map(d => d.urgency.charAt(0).toUpperCase() + d.urgency.slice(1)),
          datasets: [{
            data: sorted.map(d => d.count),
            backgroundColor: sorted.map(d => colors[d.urgency]),
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { padding: 15, usePointStyle: true }
            }
          }
        }
      });
    }

    function renderValuePie(data) {
      const ctx = document.getElementById('valuePieChart').getContext('2d');
      if (valuePieChart) valuePieChart.destroy();
      
      const colors = {
        'high': '#8b5cf6',
        'medium': '#3b82f6',
        'low': '#6b7280'
      };
      
      valuePieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: data.map(d => d.value_score.charAt(0).toUpperCase() + d.value_score.slice(1)),
          datasets: [{
            data: data.map(d => d.count),
            backgroundColor: data.map(d => colors[d.value_score] || '#6b7280'),
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { padding: 15, usePointStyle: true }
            }
          }
        }
      });
    }

    function renderThemePie(data) {
      const ctx = document.getElementById('themePieChart').getContext('2d');
      if (themePieChart) themePieChart.destroy();
      
      const colors = ['#f6821f', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#eab308'];
      
      themePieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: data.map(d => formatThemeName(d.theme)),
          datasets: [{
            data: data.map(d => d.count),
            backgroundColor: colors.slice(0, data.length),
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { padding: 10, usePointStyle: true, font: { size: 10 } }
            }
          }
        }
      });
    }

    function renderUrgencyBar(data) {
      const ctx = document.getElementById('urgencyBarChart').getContext('2d');
      if (urgencyBarChart) urgencyBarChart.destroy();
      
      const colors = {
        'critical': '#dc2626',
        'high': '#f97316',
        'medium': '#eab308',
        'low': '#22c55e'
      };
      
      const order = ['critical', 'high', 'medium', 'low'];
      const sorted = order.map(u => data.find(d => d.urgency === u)).filter(Boolean);
      
      urgencyBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: sorted.map(d => d.urgency.charAt(0).toUpperCase() + d.urgency.slice(1)),
          datasets: [{
            label: 'Feedback Count',
            data: sorted.map(d => d.count),
            backgroundColor: sorted.map(d => colors[d.urgency]),
            borderRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              grid: { color: '#2a2a3a' },
              ticks: { color: '#8888a0' }
            },
            y: {
              grid: { display: false },
              ticks: { color: '#8888a0' }
            }
          }
        }
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
            <div class="stat-label">😊 Positive</div>
            <div class="stat-value positive">\${data.stats.positive || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">😐 Neutral</div>
            <div class="stat-value" style="color: var(--neutral)">\${data.stats.neutral || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">😞 Negative</div>
            <div class="stat-value negative">\${data.stats.negative || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">🔴 Critical Issues</div>
            <div class="stat-value critical">\${data.stats.critical_count || 0}</div>
          </div>
        \`;
        document.getElementById('stats-grid').innerHTML = statsHtml;

        // Render top theme section
        if (data.topTheme) {
          renderTopTheme(data.topTheme);
        }
      } catch (error) {
        console.error('Error loading stats:', error);
        document.getElementById('stats-grid').innerHTML = '<div class="stat-card">Error loading stats</div>';
      }
    }

    function renderTopTheme(topTheme) {
      const sentimentPercent = ((topTheme.avg_sentiment + 1) / 2 * 100).toFixed(0);
      const sentimentClass = topTheme.avg_sentiment > 0.2 ? 'positive' : topTheme.avg_sentiment < -0.2 ? 'negative' : 'neutral';
      
      document.getElementById('top-theme-section').innerHTML = \`
        <div class="top-theme-card">
          <div class="top-theme-header">
            <div class="top-theme-icon">\${getThemeIcon(topTheme.theme)}</div>
            <div>
              <div class="top-theme-title">Top Theme: \${formatThemeName(topTheme.theme)}</div>
              <div class="top-theme-subtitle">Most discussed topic across all feedback channels</div>
            </div>
          </div>
          <div class="top-theme-stats">
            <div class="top-theme-stat">
              <div class="top-theme-stat-value">\${topTheme.count}</div>
              <div class="top-theme-stat-label">Total Feedback</div>
            </div>
            <div class="top-theme-stat">
              <div class="top-theme-stat-value positive">\${topTheme.positive || 0}</div>
              <div class="top-theme-stat-label">Positive</div>
            </div>
            <div class="top-theme-stat">
              <div class="top-theme-stat-value negative">\${topTheme.negative || 0}</div>
              <div class="top-theme-stat-label">Negative</div>
            </div>
            <div class="top-theme-stat">
              <div class="top-theme-stat-value critical">\${topTheme.urgent_count || 0}</div>
              <div class="top-theme-stat-label">Urgent</div>
            </div>
            <div class="top-theme-stat">
              <div class="top-theme-stat-value \${sentimentClass}">\${sentimentPercent}%</div>
              <div class="top-theme-stat-label">Sentiment Score</div>
            </div>
          </div>
        </div>
      \`;
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
          
          return \`
            <div class="theme-item" onclick="openThemeModal('\${theme.theme}')">
              <div>
                <div class="theme-name">
                  \${getThemeIcon(theme.theme)} \${formatThemeName(theme.theme)}
                  \${theme.critical > 0 ? '<span class="urgency-badge urgency-critical">critical</span>' : ''}
                  \${theme.high > 0 && theme.critical === 0 ? '<span class="urgency-badge urgency-high">high</span>' : ''}
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
                <span class="sentiment-badge sentiment-\${item.sentiment}">\${item.sentiment}</span>
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

        // Calculate percentages and net sentiment score for each day
        const processedData = trend.map(d => {
          const total = (d.positive || 0) + (d.negative || 0) + (d.total - (d.positive || 0) - (d.negative || 0));
          const neutral = d.total - (d.positive || 0) - (d.negative || 0);
          const pctPositive = d.total > 0 ? ((d.positive || 0) / d.total * 100) : 0;
          const pctNeutral = d.total > 0 ? (neutral / d.total * 100) : 0;
          const pctNegative = d.total > 0 ? ((d.negative || 0) / d.total * 100) : 0;
          const netSentiment = pctPositive - pctNegative; // Net Sentiment Score
          return {
            date: d.date,
            pctPositive: pctPositive.toFixed(1),
            pctNeutral: pctNeutral.toFixed(1),
            pctNegative: pctNegative.toFixed(1),
            netSentiment: netSentiment.toFixed(1)
          };
        });

        sentimentChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: processedData.map(d => formatDate(d.date)),
            datasets: [
              {
                label: '% Positive',
                data: processedData.map(d => d.pctPositive),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: false,
                tension: 0.4,
                borderWidth: 2,
              },
              {
                label: '% Neutral',
                data: processedData.map(d => d.pctNeutral),
                borderColor: '#6b7280',
                backgroundColor: 'rgba(107, 114, 128, 0.1)',
                fill: false,
                tension: 0.4,
                borderWidth: 2,
              },
              {
                label: '% Negative',
                data: processedData.map(d => d.pctNegative),
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                fill: false,
                tension: 0.4,
                borderWidth: 2,
              },
              {
                label: 'Net Sentiment (%Pos - %Neg)',
                data: processedData.map(d => d.netSentiment),
                borderColor: '#f6821f',
                backgroundColor: 'rgba(246, 130, 31, 0.2)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                borderDash: [5, 5],
                yAxisID: 'y1',
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                labels: { color: '#8888a0', usePointStyle: true, font: { size: 11 } }
              },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    let label = context.dataset.label || '';
                    if (label) label += ': ';
                    label += context.parsed.y + '%';
                    return label;
                  }
                }
              }
            },
            scales: {
              y: {
                min: 0,
                max: 100,
                title: { display: true, text: 'Percentage (%)', color: '#8888a0' },
                ticks: { 
                  color: '#8888a0',
                  callback: function(value) { return value + '%'; }
                },
                grid: { color: '#2a2a3a' }
              },
              y1: {
                position: 'right',
                min: -100,
                max: 100,
                title: { display: true, text: 'Net Sentiment', color: '#f6821f' },
                ticks: { 
                  color: '#f6821f',
                  callback: function(value) { return value + '%'; }
                },
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

    // Open theme detail modal with sentiment trend and AI summary
    async function openThemeModal(theme) {
      const overlay = document.getElementById('modal-overlay');
      const content = document.getElementById('modal-content');
      const title = document.getElementById('modal-title');
      
      title.textContent = \`\${getThemeIcon(theme)} \${formatThemeName(theme)}\`;
      content.innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>';
      overlay.classList.add('show');
      
      try {
        const res = await fetch(\`/api/theme-detail?theme=\${theme}\`);
        const data = await res.json();
        
        content.innerHTML = \`
          <!-- Stats Grid -->
          <div class="stats-grid" style="margin-bottom: 1.5rem;">
            <div class="stat-card">
              <div class="stat-label">Total</div>
              <div class="stat-value">\${data.stats.total}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">😊 Positive</div>
              <div class="stat-value positive">\${data.stats.positive}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">😐 Neutral</div>
              <div class="stat-value" style="color: var(--neutral)">\${data.stats.neutral}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">😞 Negative</div>
              <div class="stat-value negative">\${data.stats.negative}</div>
            </div>
          </div>

          <!-- Sentiment Trend for this Theme -->
          <div class="modal-section">
            <h3 class="section-title">📈 Sentiment Trend for \${formatThemeName(theme)}</h3>
            <div class="trend-chart-modal">
              <canvas id="modalTrendChart"></canvas>
            </div>
          </div>

          <!-- Urgency Breakdown -->
          <div class="modal-section">
            <h3 class="section-title">🚨 Urgency Breakdown</h3>
            <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;">
              <span class="urgency-badge urgency-critical" style="padding: 0.5rem 1rem;">Critical: \${data.stats.critical || 0}</span>
              <span class="urgency-badge urgency-high" style="padding: 0.5rem 1rem;">High: \${data.stats.high || 0}</span>
              <span class="urgency-badge urgency-medium" style="padding: 0.5rem 1rem;">Medium: \${data.stats.medium || 0}</span>
              <span class="urgency-badge urgency-low" style="padding: 0.5rem 1rem;">Low: \${data.stats.low || 0}</span>
            </div>
          </div>
          
          <!-- Channel Distribution -->
          <div class="modal-section">
            <h3 class="section-title">📡 Channel Distribution</h3>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              \${data.channels.map(c => \`<span class="channel-badge" style="padding: 0.5rem 1rem;">\${c.channel}: \${c.count}</span>\`).join('')}
            </div>
          </div>

          <!-- AI Summary -->
          <div class="summary-box" id="ai-summary-box">
            <div class="summary-title">
              <span>🤖</span> AI Summary of Recent Feedback
            </div>
            <div class="summary-text" id="ai-summary-text">
              <div class="loading" style="padding: 0.5rem;"><div class="spinner"></div>Generating summary...</div>
            </div>
          </div>
          
          <!-- Sample Feedback -->
          <div class="modal-section">
            <h3 class="section-title">📝 Sample Feedback</h3>
            <div class="feedback-list">
              \${data.samples.slice(0, 5).map(item => \`
                <div class="feedback-item">
                  <div class="feedback-header">
                    <div class="feedback-meta">
                      <span class="channel-badge">\${item.channel}</span>
                      <span class="urgency-badge urgency-\${item.urgency}">\${item.urgency}</span>
                      <span class="sentiment-badge sentiment-\${item.sentiment}">\${item.sentiment}</span>
                    </div>
                    <span style="color: var(--text-secondary); font-size: 0.8rem;">\${formatDate(item.created_at)}</span>
                  </div>
                  \${item.title ? \`<div style="font-weight: 500; margin-bottom: 0.5rem;">\${escapeHtml(item.title)}</div>\` : ''}
                  <div class="feedback-content">\${escapeHtml(item.content)}</div>
                </div>
              \`).join('')}
            </div>
          </div>
        \`;

        // Render the sentiment trend chart for this theme
        renderModalTrendChart(data.trend, theme);

        // Generate AI summary
        generateAISummary(data.recentFeedbackTexts, theme);

      } catch (error) {
        content.innerHTML = '<p>Error loading theme details</p>';
      }
    }

    function renderModalTrendChart(trend, theme) {
      const ctx = document.getElementById('modalTrendChart').getContext('2d');
      if (modalTrendChart) modalTrendChart.destroy();

      // Calculate percentages and net sentiment score for each day
      const processedData = trend.map(d => {
        const total = (d.positive || 0) + (d.neutral || 0) + (d.negative || 0);
        const pctPositive = total > 0 ? ((d.positive || 0) / total * 100) : 0;
        const pctNeutral = total > 0 ? ((d.neutral || 0) / total * 100) : 0;
        const pctNegative = total > 0 ? ((d.negative || 0) / total * 100) : 0;
        const netSentiment = pctPositive - pctNegative; // Net Sentiment Score
        return {
          date: d.date,
          pctPositive: pctPositive.toFixed(1),
          pctNeutral: pctNeutral.toFixed(1),
          pctNegative: pctNegative.toFixed(1),
          netSentiment: netSentiment.toFixed(1)
        };
      });

      modalTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: processedData.map(d => formatDate(d.date)),
          datasets: [
            {
              label: '% Positive',
              data: processedData.map(d => d.pctPositive),
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              fill: false,
              tension: 0.4,
              borderWidth: 2,
            },
            {
              label: '% Neutral',
              data: processedData.map(d => d.pctNeutral),
              borderColor: '#6b7280',
              backgroundColor: 'rgba(107, 114, 128, 0.1)',
              fill: false,
              tension: 0.4,
              borderWidth: 2,
            },
            {
              label: '% Negative',
              data: processedData.map(d => d.pctNegative),
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              fill: false,
              tension: 0.4,
              borderWidth: 2,
            },
            {
              label: 'Net Sentiment (%Pos - %Neg)',
              data: processedData.map(d => d.netSentiment),
              borderColor: '#f6821f',
              backgroundColor: 'rgba(246, 130, 31, 0.2)',
              fill: true,
              tension: 0.4,
              borderWidth: 3,
              borderDash: [5, 5],
              yAxisID: 'y1',
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: { color: '#8888a0', usePointStyle: true, font: { size: 11 } }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  let label = context.dataset.label || '';
                  if (label) label += ': ';
                  label += context.parsed.y + '%';
                  return label;
                }
              }
            }
          },
          scales: {
            y: {
              min: 0,
              max: 100,
              title: { display: true, text: 'Percentage (%)', color: '#8888a0' },
              ticks: { 
                color: '#8888a0',
                callback: function(value) { return value + '%'; }
              },
              grid: { color: '#2a2a3a' }
            },
            y1: {
              position: 'right',
              min: -100,
              max: 100,
              title: { display: true, text: 'Net Sentiment', color: '#f6821f' },
              ticks: { 
                color: '#f6821f',
                callback: function(value) { return value + '%'; }
              },
              grid: { display: false }
            },
            x: {
              ticks: { color: '#8888a0' },
              grid: { color: '#2a2a3a' }
            }
          }
        }
      });
    }

    async function generateAISummary(feedbackTexts, theme) {
      try {
        const res = await fetch('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedbackTexts, theme: formatThemeName(theme) })
        });
        
        const result = await res.json();
        document.getElementById('ai-summary-text').textContent = result.summary || 'Unable to generate summary.';
      } catch (error) {
        document.getElementById('ai-summary-text').textContent = 'Unable to generate AI summary. Please review the feedback manually.';
      }
    }

    function closeModal() {
      document.getElementById('modal-overlay').classList.remove('show');
      if (modalTrendChart) {
        modalTrendChart.destroy();
        modalTrendChart = null;
      }
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
