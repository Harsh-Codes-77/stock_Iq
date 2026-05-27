# StockIQ — Institutional Stock Research App

StockIQ is an advanced, AI-powered equity research dashboard designed to generate institutional-grade financial reports for Indian stocks (NSE/BSE). By leveraging real-time market data, financial statements, and cutting-edge Large Language Models (LLMs), it provides retail investors with the depth and quality of research typically reserved for top-tier hedge funds.

---

## 📈 How Hedge Funds Work

Hedge funds are alternative investment vehicles that pool capital from high-net-worth individuals and institutional investors. Unlike mutual funds, they employ aggressive and complex strategies (like long/short equity, arbitrage, global macro, and quantitative trading) to generate "alpha" (returns above the market average) regardless of market direction.

**The Role of Research in Hedge Funds:**
To find this edge, hedge funds employ armies of elite financial analysts. These analysts perform deep, forensic research on companies by:
1. **Scouring Financials:** Analyzing 10-K/10-Q reports (or Annual Reports in India), balance sheets, cash flows, and income statements.
2. **Forensic Accounting:** Looking for red flags like high receivables, unusual inventory build-ups, or aggressive revenue recognition.
3. **Evaluating Management:** Analyzing earnings calls, management track records, capital allocation, and insider shareholding trends.
4. **Building Valuation Models:** Creating DCF (Discounted Cash Flow) models and conducting sensitivity analyses.

The result is a highly detailed, data-backed **Investment Thesis**. This rigorous process is time-consuming and expensive.

---

## 🧠 How This Project Works (Core Idea)

**The Core Idea:** StockIQ democratizes institutional research by automating the tedious work of a hedge fund analyst. It fetches live, raw data from multiple sources and uses an advanced AI model to synthesize it into a comprehensive, structured, and easy-to-digest financial report.

### Step-by-Step Execution Flow:
1. **Data Aggregation (The "Data Gathering" Phase):**
   When you search for a stock, the app's backend (`pages/api/report.js`) simultaneously scrapes and fetches live data from multiple free APIs (Yahoo Finance, Screener.in, NSE, and news aggregators).
   - **Metrics Fetched:** Live prices, 52-week highs/lows, market cap, P/E ratios, EV/EBITDA, ROE, ROCE, 10-year financials, shareholding patterns, and recent news.

2. **Prompt Engineering (The "Context" Phase):**
   All this raw data is injected into a highly engineered, massive prompt. The prompt instructs the AI to act as an "elite institutional equity research analyst combining Goldman Sachs, hedge fund, and forensic accounting expertise."

3. **AI Analysis (The "Analyst" Phase):**
   The prompt is sent to an LLM (using the **Google Gemini API** or **OpenRouter**). The AI processes the data, fills in historical or qualitative gaps using its trained knowledge, and analyzes the company's moat, management quality, valuation, and risks.

4. **Structured JSON Output:**
   The AI is forced to return the research strictly as a structured JSON object. This includes scores, executive summaries, business overviews, forensic checks, valuation models (Bear/Base/Bull cases), and final verdicts.

5. **Frontend Rendering:**
   The Next.js frontend receives this JSON and renders it into a stunning, responsive, and interactive dashboard using React, Tailwind CSS, and Chart.js for data visualization. It also features a PDF export option (via `jsPDF` and `html2canvas`) so you can save or share the report.


## 💻 Local Setup (Development)

If you want to run the project locally on your machine:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create environment variables:**
   Create a file named `.env.local` in the root folder and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_gemini_key_here
   ```
   *(Optional)* If you want to use OpenRouter instead of Gemini directly:
   ```env
   OPENROUTER_API_KEY=your_openrouter_key
   OPENROUTER_MODEL=google/gemini-2.5-flash
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000` in your browser.

---
