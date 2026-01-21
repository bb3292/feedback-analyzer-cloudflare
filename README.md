# 📊 Feedback Analyzer - Product Feedback Intelligence for PMs

> **Cloudflare PM Internship Challenge Submission**  
> A comprehensive product feedback intelligence platform built on Cloudflare's Developer Platform

[![Deployed on Cloudflare Workers](https://img.shields.io/badge/Deployed%20on-Cloudflare%20Workers-orange)](https://signalflow-bhavana.bhavana.workers.dev)
[![Built with Workers AI](https://img.shields.io/badge/AI%20Powered-Workers%20AI-blue)](https://developers.cloudflare.com/workers-ai/)
[![Database: D1](https://img.shields.io/badge/Database-D1%20SQLite-green)](https://developers.cloudflare.com/d1/)

## 🎯 Problem Statement

Product feedback arrives from many noisy sources every day: Customer Support Tickets, Discord, GitHub issues, email, X/Twitter, community forums, and more. It's scattered and difficult to extract themes, urgency, value, and sentiment.

**Feedback Analyzer** solves this by aggregating and analyzing feedback to derive meaningful insights that help Product Managers make data-driven decisions.

## 🚀 Live Demo

**🔗 [View Live Application](https://signalflow-bhavana.bhavana.workers.dev)**

## ✨ Key Features

### 📈 **Intelligent Dashboard**
- **Real-time Overview**: Total feedback count, sentiment breakdown, critical issues
- **Sentiment Trends**: 14-day sentiment analysis with interactive charts
- **Theme Analysis**: AI-powered categorization with urgency indicators
- **Smart Filtering**: Filter by channel, sentiment, theme, or urgency level

### 🤖 **AI-Powered Analysis**
- **Sentiment Detection**: Automatic positive/negative/neutral classification
- **Theme Extraction**: Categorizes feedback into performance, pricing, docs, DX, reliability, features
- **Urgency Assessment**: Identifies critical, high, medium, and low priority items
- **Value Scoring**: Helps prioritize feedback based on potential impact

### 📊 **Rich Data Visualization**
- Interactive sentiment trend charts
- Theme distribution with visual indicators
- Filterable feedback tables
- Live AI analysis demo

## 🏗️ Architecture Overview

This solution leverages **3 core Cloudflare Developer Platform products**:

### 1. **Cloudflare Workers** (Compute Layer)
- **Purpose**: Serverless JavaScript runtime hosting both API and dashboard
- **Why**: Global edge deployment for low-latency access worldwide
- **Implementation**: Single Worker handles routing, API endpoints, and serves HTML dashboard

### 2. **D1 Database** (Storage Layer)
- **Purpose**: Serverless SQLite database for feedback storage and analytics
- **Why**: SQL query support with automatic scaling and backup
- **Implementation**: Two-table design - `feedback` for raw data, `daily_metrics` for aggregations

### 3. **Workers AI** (Intelligence Layer)
- **Purpose**: Edge-native AI inference for sentiment and theme analysis
- **Why**: No external API dependencies, privacy-first, low-latency processing
- **Implementation**: Uses `@cf/meta/llama-3-8b-instruct` for real-time text analysis

### Additional: **KV Storage** (Caching Layer)
- **Purpose**: High-performance caching for dashboard metrics
- **Why**: Reduces database load and improves response times
- **Implementation**: Caches aggregated data with TTL-based invalidation

## 📊 Dataset

The application includes **500+ realistic feedback entries** covering:

- **6 Feedback Channels**: GitHub, Discord, Support, Twitter, Forums, Email
- **6 Theme Categories**: Performance, Pricing, Documentation, Developer Experience, Reliability, Features
- **Sentiment Range**: Positive, Negative, Neutral with confidence scores
- **Urgency Levels**: Critical, High, Medium, Low priority classification
- **Time Range**: 30+ days of historical data for trend analysis

## 🛠️ Technology Stack

- **Runtime**: Cloudflare Workers (JavaScript/ES6+)
- **Database**: D1 SQLite with SQL schema
- **AI/ML**: Workers AI (LLaMA 3 8B Instruct)
- **Caching**: KV Storage
- **Frontend**: Vanilla JavaScript with Chart.js
- **Styling**: Modern CSS with responsive design
- **Deployment**: Wrangler CLI

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ or 20+ (Node 24+ not supported by Wrangler)
- Cloudflare account (free tier works!)
- Wrangler CLI

### 1. Clone & Install
```bash
git clone https://github.com/bb3292/feedback-analyzer-cloudflare.git
cd feedback-analyzer-cloudflare
npm install
```

### 2. Cloudflare Setup
```bash
# Login to Cloudflare
npx wrangler login

# Create D1 Database
npx wrangler d1 create feedback-analyzer-db
# Copy the database_id and update wrangler.toml

# Create KV Namespace
npx wrangler kv namespace create "feedback-cache"
# Copy the id and update wrangler.toml
```

### 3. Database Setup
```bash
# Create schema
npx wrangler d1 execute feedback-analyzer-db --remote --file=schema.sql

# Load sample data (500+ entries)
npx wrangler d1 execute feedback-analyzer-db --remote --file=seed.sql
```

### 4. Deploy
```bash
npx wrangler deploy
```

Your app will be live at: `https://feedback-analyzer.<your-subdomain>.workers.dev`

## 🧪 Local Development

```bash
# Setup local database
npx wrangler d1 execute feedback-analyzer-db --local --file=schema.sql
npx wrangler d1 execute feedback-analyzer-db --local --file=seed.sql

# Start development server
npm run dev
```

## 📁 Project Structure

```
feedback-analyzer/
├── src/
│   └── index.js          # Main Worker (API + Dashboard)
├── schema.sql            # D1 database schema
├── seed.sql              # Mock feedback data (500+ entries)
├── wrangler.toml         # Cloudflare configuration
├── package.json          # Dependencies and scripts
└── README.md             # This documentation
```

## 🎨 Design Decisions

### **Single Worker Architecture**
- Simplifies deployment and reduces complexity
- Combines API and UI in one deployable unit
- Leverages Workers' edge computing capabilities

### **Pre-analyzed Mock Data**
- Demonstrates AI capabilities without real-time processing delays
- Includes realistic feedback scenarios across multiple themes
- Enables immediate dashboard functionality

### **Edge-First AI Processing**
- Uses Workers AI for privacy-compliant analysis
- No external API dependencies or data transfer
- Consistent low-latency processing globally

### **Progressive Enhancement**
- Works without JavaScript for basic functionality
- Enhanced experience with interactive features
- Mobile-responsive design

## 📈 Key Metrics & Insights

The dashboard provides actionable insights including:

- **Sentiment Trends**: Track feedback sentiment over time
- **Theme Distribution**: Identify most discussed topics
- **Channel Analysis**: Understand where feedback originates
- **Urgency Prioritization**: Focus on critical issues first
- **Value-based Filtering**: Prioritize high-impact feedback

## 🔮 Future Enhancements

If this were a production system, potential improvements include:

- **Real Integrations**: Discord webhooks, GitHub App, Zendesk API
- **Automated Analysis**: Scheduled Workers with Cron Triggers
- **Authentication**: Cloudflare Access integration
- **Alerting**: Slack/Discord notifications for critical feedback
- **Historical Analytics**: Long-term trend analysis and reporting
- **Multi-tenant Support**: Team-based access and filtering

## 🏆 Assignment Requirements Met

✅ **Hosted on Cloudflare Workers**  
✅ **Uses 3+ Cloudflare Developer Platform products** (Workers, D1, Workers AI, KV)  
✅ **Mock data implementation** (500+ realistic feedback entries)  
✅ **Architecture overview** with product justification  
✅ **Functional dashboard** with aggregated feedback analysis  
✅ **AI-powered insights** for sentiment and theme extraction  

## 👨‍💻 About

Built by **Bhavana Bafna** for the Cloudflare PM Internship Challenge.

This project demonstrates practical application of Cloudflare's Developer Platform for solving real product management challenges through intelligent feedback analysis.

---

**🔗 [Live Demo](https://signalflow-bhavana.bhavana.workers.dev)** | **📧 [Contact](mailto:bb3292@columbia.edu)**