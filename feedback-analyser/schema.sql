-- SignalFlow Database Schema
-- D1 SQLite Database

-- Raw feedback from all channels
CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT DEFAULT (datetime('now')),
    channel TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    author TEXT,
    
    -- AI-analyzed fields
    sentiment TEXT DEFAULT 'pending',
    sentiment_score REAL DEFAULT 0,
    theme TEXT DEFAULT 'uncategorized',
    urgency TEXT DEFAULT 'low',
    value_score TEXT DEFAULT 'medium',
    
    -- For filtering
    analyzed INTEGER DEFAULT 0
);

-- Daily aggregated metrics for dashboard
CREATE TABLE IF NOT EXISTS daily_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_date TEXT NOT NULL,
    theme TEXT NOT NULL,
    
    total_count INTEGER DEFAULT 0,
    positive_count INTEGER DEFAULT 0,
    neutral_count INTEGER DEFAULT 0,
    negative_count INTEGER DEFAULT 0,
    
    urgency_low INTEGER DEFAULT 0,
    urgency_medium INTEGER DEFAULT 0,
    urgency_high INTEGER DEFAULT 0,
    urgency_critical INTEGER DEFAULT 0,
    
    avg_sentiment_score REAL DEFAULT 0,
    
    UNIQUE(metric_date, theme)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_feedback_date ON feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_theme ON feedback(theme);
CREATE INDEX IF NOT EXISTS idx_feedback_sentiment ON feedback(sentiment);
CREATE INDEX IF NOT EXISTS idx_feedback_channel ON feedback(channel);
CREATE INDEX IF NOT EXISTS idx_metrics_date ON daily_metrics(metric_date);
