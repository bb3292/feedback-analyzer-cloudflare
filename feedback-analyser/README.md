# SignalFlow - Product Feedback Intelligence for PMs

A prototype tool built on Cloudflare's Developer Platform that helps Product Managers aggregate and analyze feedback from multiple sources.

## 🎯 Problem Statement

Product feedback arrives from many noisy sources (Support, Discord, GitHub, Twitter, Forums). It's scattered and difficult to extract meaningful insights. SignalFlow helps PMs:

1. **See overall sentiment** - Is user feedback trending positive or negative?
2. **Identify themes** - What are users talking about most?
3. **Prioritize by urgency** - What needs immediate attention?
4. **Filter intelligently** - Slice data by channel, sentiment, theme, or urgency

## 🏗️ Architecture Overview

This solution uses **3 Cloudflare Developer Platform products**:

### 1. Cloudflare Workers (Compute)
- **What**: Serverless JavaScript runtime at the edge
- **Why**: Hosts both the API and dashboard with global low-latency delivery
- **How**: Single Worker handles routing, API endpoints, and serves the HTML dashboard

### 2. D1 Database (Storage)
- **What**: Serverless SQLite database
- **Why**: Stores feedback data and aggregated metrics with SQL query support
- **How**: Two tables - \`feedback\` for raw data, \`daily_metrics\` for aggregations

### 3. Workers AI (Intelligence)
- **What**: AI inference at the edge using LLaMA models
- **Why**: Analyzes feedback for sentiment, themes, and urgency without external APIs
- **How**: Uses \`@cf/meta/llama-3-8b-instruct\` for text analysis

## 📊 Dashboard Features

- **Stats Overview**: Total feedback, sentiment breakdown, critical issues
- **Sentiment Trend**: 14-day chart showing sentiment changes over time
- **Theme Analysis**: Top themes with sentiment bars and urgency indicators
- **Feedback List**: Filterable list of all feedback items
- **AI Analyzer**: Live demo of Workers AI analyzing custom feedback text
- **Theme Drill-down**: Click any theme to see detailed breakdown

## 🚀 Deployment Instructions

### Prerequisites
- Node.js 18+
- Cloudflare account (free tier works!)
- Wrangler CLI

### Step 1: Install Dependencies

\`\`\`bash
npm install
\`\`\`

### Step 2: Login to Cloudflare

\`\`\`bash
npx wrangler login
\`\`\`

### Step 3: Create D1 Database

\`\`\`bash
npx wrangler d1 create signalflow-db
\`\`\`

Copy the database_id from the output and update \`wrangler.toml\`.

### Step 4: Create KV Namespace

\`\`\`bash
npx wrangler kv namespace create CACHE
\`\`\`

Copy the id from the output and update \`wrangler.toml\`.

### Step 5: Set Up Database Schema

\`\`\`bash
npx wrangler d1 execute signalflow-db --remote --file=schema.sql
\`\`\`

### Step 6: Seed Mock Data

\`\`\`bash
npx wrangler d1 execute signalflow-db --remote --file=seed.sql
\`\`\`

### Step 7: Deploy

\`\`\`bash
npm run deploy
\`\`\`

Your app will be live at: \`https://signalflow.<your-subdomain>.workers.dev\`

## 🧪 Local Development

\`\`\`bash
# Create local D1 database
npx wrangler d1 execute signalflow-db --local --file=schema.sql
npx wrangler d1 execute signalflow-db --local --file=seed.sql

# Start dev server
npm run dev
\`\`\`

## 📁 Project Structure

\`\`\`
signalflow/
├── src/
│   └── index.js        # Main Worker (API + Dashboard)
├── schema.sql          # D1 database schema
├── seed.sql            # Mock feedback data
├── wrangler.toml       # Cloudflare configuration
├── package.json        # Dependencies
└── README.md           # This file
\`\`\`

## 🎨 Design Decisions

1. **Single Worker Architecture**: Keeps deployment simple - one Worker serves both API and UI
2. **Mock Data**: Realistic feedback samples covering 6 themes (performance, pricing, docs, DX, reliability, features)
3. **Pre-analyzed Data**: Feedback comes pre-analyzed for faster dashboard loading
4. **Live AI Demo**: Shows Workers AI capability with real-time analysis

## 📈 Future Improvements

If this were a production tool:
- Real integrations (Discord webhooks, GitHub App, Zendesk API)
- Daily scheduled analysis with Cron Triggers
- User authentication with Cloudflare Access
- Alert workflows (Slack/Discord notifications)
- Historical trend comparisons

---

Built for the Cloudflare PM Internship Challenge 🚀
