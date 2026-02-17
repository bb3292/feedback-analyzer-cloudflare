-- SignalFlow Mock Data
-- Realistic product feedback from multiple channels

INSERT INTO feedback (created_at, channel, title, content, author, sentiment, sentiment_score, theme, urgency, value_score, analyzed) VALUES
-- Performance Issues
('2026-01-20 09:15:00', 'support', 'Workers AI Cold Start Issue', 'We are experiencing 1.5s cold starts on Workers AI which is blocking our production migration. Need this resolved urgently for our chatbot deployment.', 'enterprise_user_1', 'negative', -0.8, 'performance', 'critical', 'high', 1),
('2026-01-20 10:30:00', 'github', 'Cold start times for LLaMA models', 'Cold starts are around 800ms+ for llama-2-7b model. Standard Workers are ~50ms. This 16x difference was not documented. Please fix or document.', 'dev_contributor_42', 'negative', -0.6, 'performance', 'high', 'high', 1),
('2026-01-19 14:22:00', 'discord', 'Slow first request', 'Anyone else seeing really slow first requests with Workers AI? Takes like 2 seconds for the first response then fast after.', 'community_dev', 'negative', -0.4, 'performance', 'medium', 'medium', 1),
('2026-01-19 16:45:00', 'twitter', 'Workers performance question', '@CloudflareDev loving Workers but the cold starts on AI inference are killing my UX. Any improvements planned?', 'indie_hacker', 'neutral', -0.2, 'performance', 'medium', 'medium', 1),
('2026-01-18 11:00:00', 'support', 'Durable Objects latency spikes', 'Getting random latency spikes of 500ms+ on Durable Objects reads. Affecting our real-time collaboration feature.', 'startup_cto', 'negative', -0.7, 'performance', 'high', 'high', 1),

-- Pricing Concerns
('2026-01-20 08:00:00', 'support', 'Unexpected billing increase', 'Our bill jumped 400% after enabling R2 lifecycle rules. This was not clear in the pricing docs. Need explanation ASAP.', 'finance_team', 'negative', -0.9, 'pricing', 'critical', 'high', 1),
('2026-01-19 09:30:00', 'discord', 'Pricing confusion Pro vs Business', 'Can someone explain the difference between Pro and Business for Workers? The pricing page is confusing about included requests.', 'new_user_dev', 'neutral', -0.1, 'pricing', 'low', 'low', 1),
('2026-01-18 15:20:00', 'github', 'Cost calculator request', 'Would love a cost calculator tool for Workers + D1 + R2 combined. Hard to estimate monthly costs for my project.', 'oss_maintainer', 'neutral', 0.1, 'pricing', 'low', 'medium', 1),
('2026-01-17 12:00:00', 'twitter', 'Workers pricing appreciation', 'Just migrated from AWS Lambda to @CloudflareWorkers - saving 60% on compute costs! The pricing model is so much simpler.', 'happy_customer', 'positive', 0.9, 'pricing', 'low', 'medium', 1),

-- Documentation
('2026-01-20 11:45:00', 'github', 'R2 presigned URLs docs incomplete', 'The presigned URL documentation does not cover CORS configuration. Spent 3 hours debugging. Please add examples.', 'frustrated_dev', 'negative', -0.5, 'documentation', 'medium', 'medium', 1),
('2026-01-19 13:15:00', 'discord', 'Great D1 tutorial', 'Just went through the D1 getting started guide - super clear and got my app working in 20 minutes! Great job on the docs.', 'learning_dev', 'positive', 0.8, 'documentation', 'low', 'low', 1),
('2026-01-18 10:30:00', 'support', 'API reference outdated', 'The Workers AI API reference shows deprecated model names. Please update to reflect current available models.', 'api_consumer', 'negative', -0.4, 'documentation', 'medium', 'medium', 1),
('2026-01-17 16:00:00', 'forum', 'Tutorial request: Workers + Hono', 'Would love to see an official tutorial on building REST APIs with Workers and Hono framework. Current examples are basic.', 'framework_user', 'neutral', 0.2, 'documentation', 'low', 'low', 1),

-- Developer Experience
('2026-01-20 14:00:00', 'github', 'Wrangler v3 migration broken', 'wrangler dev is completely broken after upgrading to v3. Getting cryptic errors. Had to downgrade to continue working.', 'daily_user', 'negative', -0.7, 'developer-experience', 'high', 'high', 1),
('2026-01-19 17:30:00', 'discord', 'Love the new Pages dashboard', 'The new Cloudflare Pages dashboard is amazing! So much easier to see deployment status and logs. Great update!', 'pages_fan', 'positive', 0.9, 'developer-experience', 'low', 'medium', 1),
('2026-01-18 09:00:00', 'twitter', 'Wrangler tail is awesome', 'TIL about wrangler tail for real-time logs. Game changer for debugging Workers in production! @CloudflareDev', 'devtools_lover', 'positive', 0.7, 'developer-experience', 'low', 'low', 1),
('2026-01-17 14:45:00', 'support', 'Error messages unhelpful', 'Error code 1101 provides no useful information. Had to search Discord for 2 hours to find the actual cause.', 'debugging_dev', 'negative', -0.6, 'developer-experience', 'medium', 'medium', 1),
('2026-01-16 11:30:00', 'github', 'TypeScript types incomplete', 'The @cloudflare/workers-types package is missing types for several D1 methods. Causes red squiggles in VS Code.', 'ts_developer', 'negative', -0.3, 'developer-experience', 'medium', 'medium', 1),

-- Reliability
('2026-01-20 06:00:00', 'support', 'D1 data consistency issue', 'Seeing stale reads from D1 in multi-region setup. Data written 5 seconds ago not visible. This is breaking our app.', 'enterprise_user_2', 'negative', -0.8, 'reliability', 'critical', 'high', 1),
('2026-01-19 08:15:00', 'twitter', 'Workers uptime appreciation', 'Our Workers have been running for 6 months with zero downtime. Incredible reliability @CloudflareDev!', 'satisfied_customer', 'positive', 0.95, 'reliability', 'low', 'high', 1),
('2026-01-18 20:00:00', 'discord', 'KV eventual consistency question', 'Is there a way to get strong consistency with KV? Eventual consistency causing race conditions in my app.', 'architect_dev', 'neutral', -0.2, 'reliability', 'medium', 'high', 1),

-- Feature Requests
('2026-01-20 13:00:00', 'github', 'Request: WebSocket support in Workers AI', 'Would love streaming responses via WebSocket for Workers AI. Current HTTP streaming is okay but WebSocket would be better for real-time apps.', 'realtime_builder', 'positive', 0.3, 'feature-request', 'low', 'medium', 1),
('2026-01-19 15:45:00', 'discord', 'Cron job UI request', 'Can we get a UI for managing cron triggers? Currently have to edit wrangler.toml manually which is error prone.', 'ops_focused_dev', 'neutral', 0.1, 'feature-request', 'low', 'low', 1),
('2026-01-18 12:30:00', 'forum', 'D1 branching like PlanetScale', 'Would be amazing if D1 had database branching like PlanetScale. Would make schema migrations so much safer.', 'db_enthusiast', 'positive', 0.4, 'feature-request', 'low', 'medium', 1),
('2026-01-17 09:00:00', 'twitter', 'Workers AI model request', 'Any plans to add Whisper for speech-to-text on @CloudflareWorkersAI? Would unlock so many voice app use cases!', 'voice_app_dev', 'positive', 0.5, 'feature-request', 'low', 'medium', 1),

-- More recent feedback for today
('2026-01-21 07:00:00', 'support', 'Production outage - Workers AI', 'URGENT: Workers AI returning 500 errors for all requests since 6:45 AM. Our production chatbot is down affecting thousands of users.', 'enterprise_ops', 'negative', -1.0, 'reliability', 'critical', 'high', 1),
('2026-01-21 07:30:00', 'twitter', 'Workers AI down?', 'Is @CloudflareWorkersAI down for anyone else? Getting 500 errors this morning.', 'affected_user', 'negative', -0.6, 'reliability', 'high', 'medium', 1),
('2026-01-21 08:00:00', 'discord', 'Workers AI recovery', 'Workers AI seems to be recovering now. Was down for about an hour. Hoping for a post-mortem from the team.', 'community_reporter', 'neutral', -0.1, 'reliability', 'medium', 'medium', 1),
('2026-01-21 09:00:00', 'github', 'Add retry logic to SDK', 'After this morning incident, SDK should have built-in retry logic with exponential backoff. Currently we have to implement ourselves.', 'resilience_advocate', 'neutral', 0.0, 'developer-experience', 'medium', 'high', 1);

-- Insert some aggregated daily metrics
INSERT INTO daily_metrics (metric_date, theme, total_count, positive_count, neutral_count, negative_count, urgency_low, urgency_medium, urgency_high, urgency_critical, avg_sentiment_score) VALUES
('2026-01-21', 'reliability', 4, 0, 2, 2, 0, 2, 1, 1, -0.43),
('2026-01-21', 'developer-experience', 1, 0, 1, 0, 0, 1, 0, 0, 0.0),
('2026-01-20', 'performance', 2, 0, 0, 2, 0, 0, 1, 1, -0.70),
('2026-01-20', 'pricing', 1, 0, 0, 1, 0, 0, 0, 1, -0.90),
('2026-01-20', 'documentation', 1, 0, 0, 1, 0, 1, 0, 0, -0.50),
('2026-01-20', 'developer-experience', 1, 0, 0, 1, 0, 0, 1, 0, -0.70),
('2026-01-20', 'reliability', 1, 0, 0, 1, 0, 0, 0, 1, -0.80),
('2026-01-20', 'feature-request', 1, 1, 0, 0, 1, 0, 0, 0, 0.30),
('2026-01-19', 'performance', 2, 0, 1, 1, 0, 2, 0, 0, -0.30),
('2026-01-19', 'pricing', 1, 0, 1, 0, 1, 0, 0, 0, -0.10),
('2026-01-19', 'documentation', 1, 1, 0, 0, 1, 0, 0, 0, 0.80),
('2026-01-19', 'developer-experience', 1, 1, 0, 0, 1, 0, 0, 0, 0.90),
('2026-01-19', 'reliability', 1, 1, 0, 0, 1, 0, 0, 0, 0.95),
('2026-01-19', 'feature-request', 1, 0, 1, 0, 1, 0, 0, 0, 0.10),
('2026-01-18', 'performance', 1, 0, 0, 1, 0, 0, 1, 0, -0.70),
('2026-01-18', 'pricing', 1, 0, 1, 0, 1, 0, 0, 0, 0.10),
('2026-01-18', 'documentation', 1, 0, 0, 1, 0, 1, 0, 0, -0.40),
('2026-01-18', 'developer-experience', 1, 1, 0, 0, 1, 0, 0, 0, 0.70),
('2026-01-18', 'reliability', 1, 0, 1, 0, 0, 1, 0, 0, -0.20),
('2026-01-18', 'feature-request', 1, 1, 0, 0, 1, 0, 0, 0, 0.40),
('2026-01-17', 'pricing', 1, 1, 0, 0, 1, 0, 0, 0, 0.90),
('2026-01-17', 'documentation', 1, 0, 1, 0, 1, 0, 0, 0, 0.20),
('2026-01-17', 'developer-experience', 1, 0, 0, 1, 0, 1, 0, 0, -0.60),
('2026-01-17', 'feature-request', 1, 1, 0, 0, 1, 0, 0, 0, 0.50);
