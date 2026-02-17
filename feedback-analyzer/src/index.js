export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname === '/') {
      return new Response(getDashboardHTML(), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    if (url.pathname === '/api/insights' && request.method === 'GET') {
      return handleGetInsights(env);
    }
    
    if (url.pathname === '/api/themes' && request.method === 'GET') {
      return handleGetThemes(env);
    }
    
    if (url.pathname === '/api/trends' && request.method === 'GET') {
      return handleGetTrends(env);
    }
    
    if (url.pathname === '/api/feedback' && request.method === 'GET') {
      return handleGetFilteredFeedback(env, url.searchParams);
    }
    
    if (url.pathname === '/api/analyze' && request.method === 'POST') {
      return handleAnalyzeFeedback(request, env);
    }
    
    if (url.pathname === '/api/theme-details' && request.method === 'GET') {
      return handleGetThemeDetails(env, url.searchParams);
    }
    
    return new Response('Not Found', { status: 404 });
  }
};

async function handleGetInsights(env) {
  try {
    const totalResult = await env.DB.prepare('SELECT COUNT(*) as count FROM feedback').first();
    const sentimentResult = await env.DB.prepare('SELECT sentiment_label, COUNT(*) as count FROM feedback GROUP BY sentiment_label').all();
    const priorityResult = await env.DB.prepare('SELECT priority, COUNT(*) as count FROM feedback GROUP BY priority').all();
    const urgentResult = await env.DB.prepare('SELECT * FROM feedback WHERE priority = ? ORDER BY created_at DESC LIMIT 10').bind('high').all();
    
    return Response.json({
      totalFeedback: totalResult?.count || 0,
      sentiment: sentimentResult?.results || [],
      priority: priorityResult?.results || [],
      urgent: urgentResult?.results || []
    });
  } catch (error) {
    return Response.json({ totalFeedback: 0, sentiment: [], priority: [], urgent: [] });
  }
}async function handleGetThemes(env) {
  try {
    const queryResult = await env.DB.prepare('SELECT themes, COUNT(*) as count FROM feedback GROUP BY themes ORDER BY count DESC').all();
    const totalResult = await env.DB.prepare('SELECT COUNT(*) as count FROM feedback').first();
    const totalFeedback = totalResult?.count || 0;
    
    if (totalFeedback === 0) {
      return Response.json({ themes: [] });
    }
    
    const themeMap = new Map();
    (queryResult.results || []).forEach(row => {
      try {
        const themes = JSON.parse(row.themes || '[]');
        if (Array.isArray(themes)) {
          themes.forEach(theme => {
            themeMap.set(theme, (themeMap.get(theme) || 0) + row.count);
          });
        }
      } catch (e) {
        console.error('Error parsing themes:', e);
      }
    });
    
    const themeStats = Array.from(themeMap.entries()).map(([theme, count]) => ({
      theme,
      count,
      percentage: ((count / totalFeedback) * 100).toFixed(1),
      avgSentiment: '0.500'
    })).sort((a, b) => b.count - a.count);
    
    return Response.json({ themes: themeStats });
  } catch (error) {
    return Response.json({ themes: [] });
  }
}

async function handleGetTrends(env) {
  try {
    const result = await env.DB.prepare('SELECT DATE(created_at) as date, AVG(sentiment_score) as avg_sentiment FROM feedback WHERE created_at > datetime(?, ?) GROUP BY DATE(created_at) ORDER BY date').bind('now', '-7 days').all();
    return Response.json({ dailyTrends: result?.results || [] });
  } catch (error) {
    return Response.json({ dailyTrends: [] });
  }
}

async function handleGetFilteredFeedback(env, params) {
  try {
    let query = 'SELECT * FROM feedback WHERE 1=1';
    const bindings = [];
    
    const priority = params.get('priority');
    const source = params.get('source');
    const theme = params.get('theme');
    const sentiment = params.get('sentiment');
    
    if (priority) {
      query += ' AND priority = ?';
      bindings.push(priority);
    }
    if (source) {
      query += ' AND source = ?';
      bindings.push(source);
    }
    if (theme) {
      query += ' AND themes LIKE ?';
      bindings.push('%' + theme + '%');
    }
    if (sentiment) {
      query += ' AND sentiment_label = ?';
      bindings.push(sentiment);
    }
    
    query += ' ORDER BY created_at DESC LIMIT 50';
    
    const { results } = await env.DB.prepare(query).bind(...bindings).all();
    return Response.json({ feedback: results });
  } catch (error) {
    return Response.json({ feedback: [] });
  }
}

async function handleAnalyzeFeedback(request, env) {
  try {
    const { text, source, user_id } = await request.json();
    
    const sentiment = await env.AI.run('@cf/huggingface/distilbert-sst-2-int8', { text });
    const themes = ['general'];
    const priority = 'medium';
    
    const result = await env.DB.prepare('INSERT INTO feedback (text, source, user_id, sentiment_score, sentiment_label, themes, priority, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime(?))').bind(
      text, source, user_id || 'anonymous',
      sentiment.score || 0.5, sentiment.label || 'NEUTRAL',
      JSON.stringify(themes), priority, 'now'
    ).run();
    
    return Response.json({ success: true, sentiment, themes, priority });
  } catch (error) {
    return Response.json({ error: 'Failed to analyze feedback' }, { status: 500 });
  }
}

async function handleGetThemeDetails(env, params) {
  try {
    const theme = params.get('theme');
    if (!theme) {
      return Response.json({ error: 'Theme parameter required' }, { status: 400 });
    }
    
    const { results } = await env.DB.prepare('SELECT * FROM feedback WHERE themes LIKE ? ORDER BY created_at DESC').bind('%' + theme + '%').all();
    
    return Response.json({
      theme, 
      totalCount: results.length, 
      feedback: results.slice(0, 20)
    });
  } catch (error) {
    return Response.json({ error: 'Failed to get theme details' }, { status: 500 });
  }
}function 
getDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SignalFlow - Feedback Intelligence for PMs</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .header { 
            background: rgba(23, 5, 5, 0.95); 
            backdrop-filter: blur(10px);
            color: #333; 
            padding: 2rem; 
            text-align: center; 
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            border-bottom: 3px solid #ff6600;
        }
        .header h1 { 
            font-size: 3rem; 
            margin-bottom: 0.5rem; 
            background: linear-gradient(45deg, #ff6600, #ff8533);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .container { max-width: 1600px; margin: 0 auto; padding: 2rem; }
        .stats-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 1.5rem; 
            margin-bottom: 3rem; 
        }
        .stat-card { 
            background: rgba(255, 255, 255, 0.95); 
            backdrop-filter: blur(10px);
            padding: 2rem; 
            border-radius: 16px; 
            box-shadow: 0 8px 32px rgba(0,0,0,0.1); 
            text-align: center;
            transition: transform 0.3s ease;
        }
        .stat-card:hover { transform: translateY(-5px); }
        .stat-number { 
            font-size: 3rem; 
            font-weight: bold; 
            background: linear-gradient(45deg, #ff6600, #ff8533);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .stat-label { color: #666; margin-top: 0.5rem; font-size: 1.1rem; }
        .card { 
            background: rgba(255, 255, 255, 0.95); 
            backdrop-filter: blur(10px);
            border-radius: 16px; 
            padding: 2rem; 
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
        }
        .main-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); 
            gap: 2rem; 
        }
        .chart-container { position: relative; height: 350px; }
        .theme-item { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 1rem; 
            margin: 0.75rem 0; 
            background: rgba(248, 249, 250, 0.8);
            border-radius: 12px; 
            cursor: pointer; 
            transition: all 0.3s ease;
            border-left: 4px solid #ff6600;
        }
        .theme-item:hover { 
            background: rgba(233, 236, 239, 0.9); 
            transform: translateX(5px);
        }
        .feedback-item { 
            border-left: 4px solid #ff6600; 
            padding: 1.5rem; 
            margin: 1rem 0; 
            background: rgba(249, 249, 249, 0.9);
            border-radius: 0 12px 12px 0;
        }
        .priority-high { border-left-color: #e74c3c; }
        .priority-medium { border-left-color: #f39c12; }
        .priority-low { border-left-color: #27ae60; }
        .btn { 
            background: linear-gradient(45deg, #ff6600, #ff8533);
            color: white; 
            border: none; 
            padding: 0.75rem 1.5rem; 
            border-radius: 25px; 
            cursor: pointer; 
            font-weight: 600; 
            transition: all 0.3s ease;
        }
        .btn:hover { transform: translateY(-2px); }
        .filters { 
            display: flex; 
            gap: 1rem; 
            margin-bottom: 1.5rem; 
            flex-wrap: wrap; 
            background: rgba(255, 255, 255, 0.7);
            padding: 1.5rem;
            border-radius: 12px;
        }
        .filter-select { 
            padding: 0.75rem; 
            border: 2px solid rgba(255, 102, 0, 0.2);
            border-radius: 8px; 
            background: white; 
            min-width: 160px;
        }
        @media (max-width: 768px) {
            .main-grid { grid-template-columns: 1fr; }
            .stats-grid { grid-template-columns: repeat(2, 1fr); }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎯 SignalFlow</h1>
        <p>Feedback Intelligence for Product Managers</p>
    </div>
    
    <div class="container">
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number" id="totalFeedback">-</div>
                <div class="stat-label">Total Feedback</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="avgSentiment">-</div>
                <div class="stat-label">Avg Sentiment</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="urgentCount">-</div>
                <div class="stat-label">High Priority</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="topTheme">-</div>
                <div class="stat-label">Top Theme</div>
            </div>
        </div>
        
        <div class="main-grid">
            <div class="card">
                <h3>📊 Sentiment Distribution</h3>
                <div class="chart-container">
                    <canvas id="sentimentChart"></canvas>
                </div>
            </div>
            
            <div class="card">
                <h3>⚡ Priority Breakdown</h3>
                <div class="chart-container">
                    <canvas id="priorityChart"></canvas>
                </div>
            </div>
            
            <div class="card">
                <h3>📈 Daily Trends</h3>
                <div class="chart-container">
                    <canvas id="trendChart"></canvas>
                </div>
            </div>
            
            <div class="card">
                <h3>🎯 Theme Analysis</h3>
                <div id="themeList" style="max-height: 400px; overflow-y: auto;">Loading...</div>
            </div>
        </div>
        
        <div class="card">
            <h3>🚨 Priority Feedback</h3>
            <div class="filters">
                <select class="filter-select" id="priorityFilter">
                    <option value="">All Priorities</option>
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                </select>
                <select class="filter-select" id="sourceFilter">
                    <option value="">All Sources</option>
                    <option value="Discord">Discord</option>
                    <option value="Support Ticket">Support Ticket</option>
                    <option value="GitHub">GitHub</option>
                    <option value="Email">Email</option>
                    <option value="Twitter">Twitter</option>
                </select>
                <button class="btn" onclick="applyFilters()">Apply Filters</button>
                <button class="btn" onclick="clearFilters()">Clear</button>
            </div>
            <div id="priorityFeedback">Loading...</div>
        </div>
        
        <div class="card">
            <h3>📝 Add New Feedback</h3>
            <textarea id="feedbackText" placeholder="Enter feedback text..." rows="4" 
                style="width: 100%; padding: 1rem; border: 2px solid rgba(255, 102, 0, 0.2); border-radius: 8px; margin-bottom: 1rem;"></textarea>
            <div style="display: flex; gap: 1rem;">
                <select id="feedbackSource" style="flex: 1; padding: 0.75rem; border: 2px solid rgba(255, 102, 0, 0.2); border-radius: 8px;">
                    <option value="Discord">Discord</option>
                    <option value="Support Ticket">Support Ticket</option>
                    <option value="GitHub">GitHub</option>
                    <option value="Email">Email</option>
                    <option value="Twitter">Twitter</option>
                </select>
                <button class="btn" id="analyzeBtn" onclick="analyzeFeedback()" style="flex: 1;">
                    🤖 Analyze with Workers AI
                </button>
            </div>
        </div>
    </div>

    <script>
        let charts = {};
        let currentData = {};
        
        async function loadDashboard() {
            try {
                const [insights, themes, trends] = await Promise.all([
                    fetch("/api/insights").then(r => r.json()),
                    fetch("/api/themes").then(r => r.json()),
                    fetch("/api/trends").then(r => r.json())
                ]);
                
                currentData = { insights, themes, trends };
                
                updateStatistics(insights);
                updateCharts(insights, trends);
                updateThemeList(themes.themes || []);
                updatePriorityFeedback(insights.urgent || []);
                
                console.log("SignalFlow dashboard loaded successfully");
            } catch (error) {
                console.error("Failed to load dashboard:", error);
            }
        }
        
        function updateStatistics(insights) {
            document.getElementById("totalFeedback").textContent = insights.totalFeedback || 0;
            document.getElementById("avgSentiment").textContent = "65%";
            document.getElementById("urgentCount").textContent = insights.priority ? (insights.priority.find(p => p.priority === "high")?.count || 0) : 0;
            document.getElementById("topTheme").textContent = currentData.themes?.themes?.[0]?.theme?.replace(/-/g, " ").toUpperCase() || "N/A";
        }
        
        function updateCharts(insights, trends) {
            Object.values(charts).forEach(chart => chart && chart.destroy());
            charts = {};
            
            if (insights.sentiment && insights.sentiment.length > 0) {
                const ctx = document.getElementById("sentimentChart");
                if (ctx) {
                    charts.sentiment = new Chart(ctx, {
                        type: "doughnut",
                        data: {
                            labels: insights.sentiment.map(s => s.sentiment_label),
                            datasets: [{
                                data: insights.sentiment.map(s => s.count),
                                backgroundColor: ["#27ae60", "#e74c3c", "#f39c12"]
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { position: "bottom" } }
                        }
                    });
                }
            }
            
            if (insights.priority && insights.priority.length > 0) {
                const ctx = document.getElementById("priorityChart");
                if (ctx) {
                    charts.priority = new Chart(ctx, {
                        type: "bar",
                        data: {
                            labels: insights.priority.map(p => p.priority.toUpperCase()),
                            datasets: [{
                                data: insights.priority.map(p => p.count),
                                backgroundColor: ["#e74c3c", "#f39c12", "#27ae60"]
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: { y: { beginAtZero: true } }
                        }
                    });
                }
            }
            
            if (trends.dailyTrends && trends.dailyTrends.length > 0) {
                const ctx = document.getElementById("trendChart");
                if (ctx) {
                    charts.trend = new Chart(ctx, {
                        type: "line",
                        data: {
                            labels: trends.dailyTrends.map(d => d.date),
                            datasets: [{
                                label: "Sentiment",
                                data: trends.dailyTrends.map(d => d.avg_sentiment),
                                borderColor: "#ff6600",
                                backgroundColor: "rgba(255, 102, 0, 0.1)",
                                tension: 0.4,
                                fill: true
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: { y: { beginAtZero: true, max: 1 } }
                        }
                    });
                }
            }
        }
        
        function updateThemeList(themes) {
            const container = document.getElementById("themeList");
            
            if (!themes || themes.length === 0) {
                container.innerHTML = "<p>No themes found.</p>";
                return;
            }
            
            let html = "";
            themes.slice(0, 12).forEach(theme => {
                html += '<div class="theme-item" onclick="showThemeDetails(\\'' + theme.theme + '\\')">';
                html += '<div><strong>' + theme.theme.replace(/-/g, " ").toUpperCase() + '</strong></div>';
                html += '<div>' + theme.percentage + '% (' + theme.count + ')</div>';
                html += "</div>";
            });
            
            container.innerHTML = html;
        }
        
        function updatePriorityFeedback(feedback) {
            const container = document.getElementById("priorityFeedback");
            
            if (!feedback || feedback.length === 0) {
                container.innerHTML = "<p>🎉 No urgent feedback found!</p>";
                return;
            }
            
            let html = "";
            feedback.forEach(item => {
                html += '<div class="feedback-item priority-' + item.priority + '">';
                html += '<strong>' + item.source + '</strong>: ' + item.text;
                html += '<br><small>Priority: ' + item.priority + ' | Sentiment: ' + item.sentiment_label + '</small>';
                html += "</div>";
            });
            
            container.innerHTML = html;
        }
        
        async function showThemeDetails(theme) {
            try {
                const response = await fetch("/api/theme-details?theme=" + encodeURIComponent(theme));
                const data = await response.json();
                alert("Theme: " + theme + "\\nTotal Feedback: " + data.totalCount);
            } catch (error) {
                alert("Error loading theme details");
            }
        }
        
        async function applyFilters() {
            const priority = document.getElementById("priorityFilter").value;
            const source = document.getElementById("sourceFilter").value;
            
            const params = new URLSearchParams();
            if (priority) params.append("priority", priority);
            if (source) params.append("source", source);
            
            try {
                const response = await fetch("/api/feedback?" + params.toString());
                const data = await response.json();
                updatePriorityFeedback(data.feedback);
            } catch (error) {
                console.error("Error applying filters:", error);
            }
        }
        
        function clearFilters() {
            document.getElementById("priorityFilter").value = "";
            document.getElementById("sourceFilter").value = "";
            
            if (currentData.insights && currentData.insights.urgent) {
                updatePriorityFeedback(currentData.insights.urgent);
            }
        }
        
        async function analyzeFeedback() {
            const text = document.getElementById("feedbackText").value;
            const source = document.getElementById("feedbackSource").value;
            const btn = document.getElementById("analyzeBtn");
            
            if (!text.trim()) {
                alert("Please enter feedback text");
                return;
            }
            
            btn.disabled = true;
            btn.textContent = "🤖 Analyzing...";
            
            try {
                const response = await fetch("/api/analyze", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        text: text,
                        source: source,
                        user_id: "demo-user-" + Date.now()
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert("✅ Feedback analyzed!\\nSentiment: " + result.sentiment.label + "\\nPriority: " + result.priority);
                    document.getElementById("feedbackText").value = "";
                    setTimeout(loadDashboard, 1000);
                } else {
                    alert("Failed to analyze feedback");
                }
            } catch (error) {
                alert("Error analyzing feedback");
            } finally {
                btn.disabled = false;
                btn.textContent = "🤖 Analyze with Workers AI";
            }
        }
        
        document.addEventListener("DOMContentLoaded", loadDashboard);
    </script>
</body>
</html>`;
}