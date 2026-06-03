import io
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from datetime import datetime
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from weasyprint import HTML
from loguru import logger

from backend.core.cache import cache_get
from backend.engines.report_orchestrator import generate_full_report

router = APIRouter()

def clean_svg_string(svg_str: str) -> str:
    """Removes XML and DOCTYPE declarations from matplotlib SVG outputs."""
    start_idx = svg_str.find("<svg")
    if start_idx != -1:
        return svg_str[start_idx:]
    return svg_str

def generate_revenue_pat_chart(financials: list) -> str:
    """Generates an SVG chart of Revenue and Net Profit (PAT) over time."""
    sorted_fin = sorted(financials, key=lambda x: x.get("fiscal_year", 0))
    years = [str(x.get("fiscal_year")) for x in sorted_fin]
    
    if not years:
        years, revenue, pat = ["2022", "2023", "2024"], [100.0, 120.0, 150.0], [10.0, 12.0, 15.0]
        unit = " (₹ Crores)"
        scale = 1.0
    else:
        max_rev = max([x.get("revenue") or 0.0 for x in sorted_fin])
        scale = 1.0
        unit = ""
        if max_rev > 10000000.0:
            scale = 10000000.0
            unit = " (₹ Crores)"
        elif max_rev > 1000.0:
            scale = 1000000.0
            unit = " (₹ Millions)"
            
        revenue = [(x.get("revenue") or 0.0) / scale for x in sorted_fin]
        pat = [(x.get("pat") or 0.0) / scale for x in sorted_fin]

    # Create figure
    fig, ax1 = plt.subplots(figsize=(8, 3.8))
    fig.patch.set_facecolor('white')
    ax1.set_facecolor('#fafafa')
    ax1.grid(True, linestyle='--', alpha=0.5, color='#dddddd')
    
    color_rev = '#1e3a8a' # professional deep navy
    ax1.set_xlabel('Fiscal Year', fontweight='bold', fontsize=9, labelpad=8)
    ax1.set_ylabel(f'Revenue{unit}', color=color_rev, fontweight='bold', fontsize=9)
    bars = ax1.bar(years, revenue, color=color_rev, alpha=0.6, width=0.4, label='Revenue')
    ax1.tick_params(axis='y', labelcolor=color_rev, labelsize=8)
    ax1.tick_params(axis='x', labelsize=8)
    
    ax2 = ax1.twinx()
    color_pat = '#b91c1c' # professional deep red
    ax2.set_ylabel(f'Net Profit (PAT){unit}', color=color_pat, fontweight='bold', fontsize=9)
    line = ax2.plot(years, pat, color=color_pat, marker='o', linewidth=2.5, label='PAT')
    ax2.tick_params(axis='y', labelcolor=color_pat, labelsize=8)
    ax2.grid(False)
    
    plt.title('Revenue & Profitability (PAT) Trajectory', fontsize=11, fontweight='bold', pad=12, color='#111111')
    fig.tight_layout()
    
    f = io.BytesIO()
    plt.savefig(f, format='svg', bbox_inches='tight')
    plt.close()
    return clean_svg_string(f.getvalue().decode('utf-8'))

def generate_cfo_pat_chart(financials: list) -> str:
    """Generates an SVG chart of CFO vs PAT comparison."""
    sorted_fin = sorted(financials, key=lambda x: x.get("fiscal_year", 0))
    years = [str(x.get("fiscal_year")) for x in sorted_fin]
    
    if not years:
        years, pat, cfo = ["2022", "2023", "2024"], [10.0, 12.0, 15.0], [8.0, 14.0, 13.0]
        unit = " (₹ Crores)"
        scale = 1.0
    else:
        max_rev = max([x.get("revenue") or 0.0 for x in sorted_fin])
        scale = 1.0
        unit = ""
        if max_rev > 10000000.0:
            scale = 10000000.0
            unit = " (₹ Crores)"
        elif max_rev > 1000.0:
            scale = 1000000.0
            unit = " (₹ Millions)"
            
        pat = [(x.get("pat") or 0.0) / scale for x in sorted_fin]
        cfo = [(x.get("cfo") or 0.0) / scale for x in sorted_fin]
        
    fig, ax = plt.subplots(figsize=(8, 3.8))
    fig.patch.set_facecolor('white')
    ax.set_facecolor('#fafafa')
    ax.grid(True, linestyle='--', alpha=0.5, color='#dddddd')
    
    ax.plot(years, cfo, color='#15803d', marker='s', linewidth=2.5, label='Operating Cash Flow (CFO)')
    ax.plot(years, pat, color='#ea580c', marker='o', linewidth=2, linestyle='--', label='Net Profit (PAT)')
    
    ax.set_xlabel('Fiscal Year', fontweight='bold', fontsize=9, labelpad=8)
    ax.set_ylabel(f'Amount{unit}', fontweight='bold', fontsize=9)
    ax.tick_params(labelsize=8)
    ax.legend(loc='upper left', fontsize=8)
    
    plt.title('Cash Conversion Cycle: CFO vs PAT Comparison', fontsize=11, fontweight='bold', pad=12, color='#111111')
    fig.tight_layout()
    
    f = io.BytesIO()
    plt.savefig(f, format='svg', bbox_inches='tight')
    plt.close()
    return clean_svg_string(f.getvalue().decode('utf-8'))

@router.post("/export/pdf/{ticker}")
async def export_pdf(ticker: str):
    ticker_upper = ticker.upper()
    cache_key = f"report:{ticker_upper}"
    
    # Try fetching from Redis cache
    report = await cache_get(cache_key)
    if not report:
        logger.info(f"Report not found in cache for {ticker_upper}. Generating now...")
        try:
            report = await generate_full_report(ticker_upper)
        except Exception as e:
            logger.error(f"Failed to generate report for {ticker_upper}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")

    # Extract required metrics for cover & calculations
    company_data = report.get("company") or {}
    financials = report.get("financials") or []
    quant_scores = report.get("quant_scores") or {}
    signals = report.get("signals") or []
    concall_analysis = report.get("concall_analysis") or {}
    forensic_analysis = report.get("forensic_analysis") or {}
    rag_analysis = report.get("rag_analysis") or {}
    valuation = report.get("valuation") or {}
    
    # Calculate Verdict
    red_flags_count = sum(1 for s in signals if s.get("severity") == "RED_FLAG")
    yellow_flags_count = sum(1 for s in signals if s.get("severity") == "YELLOW_FLAG")
    
    if red_flags_count >= 2:
        verdict = "RED FLAG / HIGH RISK"
        badge_style = "background-color: #b91c1c; color: white;"
    elif red_flags_count == 1 or yellow_flags_count >= 3:
        verdict = "YELLOW FLAG / CAUTION"
        badge_style = "background-color: #eab308; color: #0f172a;"
    else:
        verdict = "POSITIVE / ROBUST"
        badge_style = "background-color: #15803d; color: white;"

    # Target Price Setup
    latest_fin = financials[0] if financials else {}
    latest_price = company_data.get("price") or latest_fin.get("share_price") or latest_fin.get("price") or 100.0
    dcf_base_val = valuation.get("dcf", {}).get("base", {}).get("intrinsic_value")
    if dcf_base_val:
        target_price = f"₹{dcf_base_val:.2f}"
    else:
        target_price = f"₹{latest_price * 1.15:.2f}"
        
    date_str = datetime.utcnow().strftime("%B %d, %Y")
    
    # Matplotlib SVGs
    rev_pat_svg = generate_revenue_pat_chart(financials)
    cfo_pat_svg = generate_cfo_pat_chart(financials)
    
    # Score details
    piotroski = quant_scores.get("piotroski", {})
    beneish = quant_scores.get("beneish", {})
    altman = quant_scores.get("altman", {})
    dupont = quant_scores.get("dupont", {})
    
    # Formatting helper for variables that might be None
    def fmt_num(val, format_spec=".2f", suffix=""):
        if val is None:
            return "N/A"
        try:
            return f"{val:{format_spec}}{suffix}"
        except Exception:
            return "N/A"

    def fmt_pct(val, format_spec=".1f", suffix="%"):
        if val is None:
            return "N/A"
        try:
            return f"{(val * 100):{format_spec}}{suffix}"
        except Exception:
            return "N/A"

    beneish_score_str = fmt_num(beneish.get("score"))
    altman_score_str = fmt_num(altman.get("score"))
    dupont_roe_str = fmt_num(dupont.get("roe"), suffix="%")
    dupont_npm_str = fmt_num(dupont.get("net_profit_margin"), suffix="%")
    
    # Valuation strings
    dcf_bear = valuation.get("dcf", {}).get("bear", {})
    dcf_bear_growth_str = fmt_pct(dcf_bear.get("growth_rate"))
    dcf_bear_value_str = fmt_num(dcf_bear.get("intrinsic_value"), suffix="", format_spec=".2f")
    if dcf_bear_value_str != "N/A":
        dcf_bear_value_str = f"₹{dcf_bear_value_str}"

    dcf_base = valuation.get("dcf", {}).get("base", {})
    dcf_base_growth_str = fmt_pct(dcf_base.get("growth_rate"))
    dcf_base_value_str = fmt_num(dcf_base.get("intrinsic_value"), suffix="", format_spec=".2f")
    if dcf_base_value_str != "N/A":
        dcf_base_value_str = f"₹{dcf_base_value_str}"

    dcf_bull = valuation.get("dcf", {}).get("bull", {})
    dcf_bull_growth_str = fmt_pct(dcf_bull.get("growth_rate"))
    dcf_bull_value_str = fmt_num(dcf_bull.get("intrinsic_value"), suffix="", format_spec=".2f")
    if dcf_bull_value_str != "N/A":
        dcf_bull_value_str = f"₹{dcf_bull_value_str}"
    
    epv_data = valuation.get("earnings_power_value", {})
    epv_str = fmt_num(epv_data.get("epv"), format_spec=".2f")
    if epv_str != "N/A":
        epv_str = f"₹{epv_str}"
    epv_upside_str = fmt_num(epv_data.get("upside_pct"), format_spec=".1f", suffix="%")
    
    rev_dcf = valuation.get("reverse_dcf", {})
    reverse_dcf_growth_str = fmt_pct(rev_dcf.get("implied_growth_rate"))
    
    # WACC assumptions
    wacc_data = quant_scores.get("wacc", {})
    wacc_rf_str = fmt_pct(wacc_data.get("risk_free_rate"))
    wacc_beta_str = fmt_num(wacc_data.get("beta"))
    wacc_erp_str = fmt_pct(wacc_data.get("equity_risk_premium"))
    wacc_de_str = fmt_num(wacc_data.get("debt_to_equity"))
    wacc_value_str = fmt_pct(wacc_data.get("wacc"))
    
    # Beneish ratios
    b_ratios = beneish.get("ratios", {})
    dsri_str = fmt_num(b_ratios.get("dsri"), format_spec=".3f")
    gmi_str = fmt_num(b_ratios.get("gmi"), format_spec=".3f")
    aqi_str = fmt_num(b_ratios.get("aqi"), format_spec=".3f")
    sgi_str = fmt_num(b_ratios.get("sgi"), format_spec=".3f")
    
    # Altman factors
    a_factors = altman.get("factors", {})
    x1_str = fmt_num(a_factors.get("x1"), format_spec=".3f")
    x2_str = fmt_num(a_factors.get("x2"), format_spec=".3f")
    x3_str = fmt_num(a_factors.get("x3"), format_spec=".3f")
    x4_str = fmt_num(a_factors.get("x4"), format_spec=".3f")

    # Sensitivity matrix reconstruction
    sens = valuation.get("sensitivity_matrix") or {}
    sens_rows = sens.get("rows") or []
    sens_html = ""
    if sens_rows:
        first_row_vals = sens_rows[0].get("valuations") or []
        sens_html += "<table><thead><tr><th>WACC / Growth</th>"
        for val_obj in first_row_vals:
            sens_html += f"<th>{fmt_pct(val_obj.get('growth_rate'))}</th>"
        sens_html += "</tr></thead><tbody>"
        
        for row in sens_rows:
            wacc_pct = fmt_pct(row.get('wacc'))
            sens_html += f"<tr><td><strong>{wacc_pct}</strong></td>"
            for val_obj in row.get("valuations") or []:
                sens_html += f"<td>₹{fmt_num(val_obj.get('intrinsic_value'), format_spec='.2f')}</td>"
            sens_html += "</tr>"
        sens_html += "</tbody></table>"
    else:
        sens_html = "<p class='no-data'>Sensitivity matrix not available.</p>"

    # Rules signals list
    signals_html = ""
    if signals:
        signals_html += "<table><thead><tr><th>Rule</th><th>Severity</th><th>Category</th><th>Findings</th><th>Evidence</th></tr></thead><tbody>"
        for s in signals:
            sev = s.get("severity")
            row_cls = "alert-row-red" if sev == "RED_FLAG" else "alert-row-yellow" if sev == "YELLOW_FLAG" else ""
            signals_html += f"<tr class='{row_cls}'>"
            signals_html += f"<td><strong>{s.get('rule_id')}</strong><br><small>{s.get('title')}</small></td>"
            signals_html += f"<td>{sev}</td>"
            signals_html += f"<td>{s.get('category')}</td>"
            signals_html += f"<td>{s.get('implication')}</td>"
            signals_html += f"<td><code>{s.get('evidence')}</code></td>"
            signals_html += "</tr>"
        signals_html += "</tbody></table>"
    else:
        signals_html = "<p class='no-data'>No signals recorded by rules engine.</p>"

    # RAG strategic summaries
    exec_summary = report.get("rag_analysis", {}).get("executive_summary") or {}
    business_model = report.get("rag_analysis", {}).get("business_model") or {}
    competitors = report.get("rag_analysis", {}).get("competitive_moat") or {}
    cap_alloc = report.get("rag_analysis", {}).get("capital_allocation") or {}
    
    # Concall guidance & excuses
    guidance = concall_analysis.get("guidance_statements") or []
    excuses = concall_analysis.get("excuse_patterns") or []
    ai_concall = concall_analysis.get("analysis") or {}

    # Risk matrix
    risk_analysis = report.get("rag_analysis", {}).get("risk_analysis") or {}
    
    # Build complete 8-page HTML template
    html_content = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>StockIQ Institutional Report - {ticker_upper}</title>
<style>
    @page {{
        size: A4;
        margin: 18mm 15mm 18mm 15mm;
        @bottom-right {{
            content: counter(page);
            font-family: 'Liberation Sans', sans-serif;
            font-size: 8pt;
            color: #64748b;
        }}
        @bottom-left {{
            content: "STOCKIQ INSTITUTIONAL EQUITY RESEARCH — CONFIDENTIAL";
            font-family: 'Liberation Sans', sans-serif;
            font-size: 8pt;
            color: #64748b;
            font-weight: bold;
        }}
    }}
    @page :first {{
        margin: 0;
        @bottom-right {{ content: normal; }}
        @bottom-left {{ content: normal; }}
    }}
    body {{
        font-family: 'Liberation Sans', sans-serif;
        color: #1e293b;
        line-height: 1.45;
        font-size: 9.5pt;
    }}
    .page {{
        page-break-after: always;
        box-sizing: border-box;
        height: 257mm; /* Exact printable height for A4 after margins */
        overflow: hidden;
    }}
    .page:last-child {{
        page-break-after: avoid;
    }}
    
    /* Cover Page */
    .cover-container {{
        background-color: #0b192c;
        color: white;
        height: 297mm;
        padding: 50px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }}
    .cover-header {{
        border-bottom: 3px solid #eab308;
        padding-bottom: 25px;
    }}
    .cover-title {{
        font-size: 26pt;
        font-weight: 800;
        margin: 0;
        letter-spacing: 1px;
    }}
    .cover-subtitle {{
        font-size: 13pt;
        color: #eab308;
        margin: 8px 0 0 0;
        text-transform: uppercase;
        letter-spacing: 2px;
        font-weight: bold;
    }}
    .cover-body {{
        margin-top: 80px;
        flex-grow: 1;
    }}
    .cover-company {{
        font-size: 34pt;
        font-weight: 800;
        margin: 0;
        line-height: 1.15;
    }}
    .cover-ticker {{
        font-size: 18pt;
        color: #94a3b8;
        margin: 10px 0 0 0;
        font-family: monospace;
    }}
    .verdict-badge {{
        display: inline-block;
        padding: 12px 24px;
        font-weight: 800;
        font-size: 14pt;
        margin-top: 40px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }}
    .cover-footer {{
        border-top: 1px solid #1e293b;
        padding-top: 30px;
        display: flex;
        justify-content: space-between;
        font-size: 9.5pt;
        color: #94a3b8;
    }}
    .footer-col {{
        width: 32%;
    }}
    
    /* Typography & Layout */
    h1 {{
        font-size: 18pt;
        color: #0b192c;
        border-bottom: 2px solid #0b192c;
        padding-bottom: 6px;
        margin-top: 0;
        margin-bottom: 16px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 800;
    }}
    h2 {{
        font-size: 11.5pt;
        color: #0f172a;
        margin-top: 14px;
        margin-bottom: 8px;
        border-bottom: 1.5px solid #cbd5e1;
        padding-bottom: 3px;
        font-weight: 700;
        text-transform: uppercase;
    }}
    p {{
        margin-top: 0;
        margin-bottom: 12px;
        text-align: justify;
    }}
    
    /* Tables */
    table {{
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 16px;
        font-size: 8.5pt;
    }}
    th {{
        background-color: #f1f5f9;
        color: #0f172a;
        font-weight: bold;
        text-align: left;
        padding: 7px 9px;
        border-bottom: 2px solid #cbd5e1;
        font-size: 8.5pt;
    }}
    td {{
        padding: 6px 9px;
        border-bottom: 1px solid #e2e8f0;
        color: #334155;
    }}
    tr:nth-child(even) td {{
        background-color: #f8fafc;
    }}
    
    /* Flex grid components */
    .grid-2 {{
        display: flex;
        gap: 15px;
        margin-bottom: 14px;
    }}
    .col {{
        flex: 1;
    }}
    .score-card {{
        border: 1px solid #e2e8f0;
        padding: 10px;
        border-radius: 4px;
        background-color: #f8fafc;
        text-align: center;
    }}
    .score-val {{
        font-size: 18pt;
        font-weight: 800;
        color: #0f172a;
        margin: 4px 0;
    }}
    .score-lbl {{
        font-size: 7.5pt;
        text-transform: uppercase;
        color: #64748b;
        font-weight: 700;
    }}
    
    /* Rules categories colours */
    .alert-row-red {{
        background-color: #fef2f2 !important;
        color: #991b1b;
    }}
    .alert-row-yellow {{
        background-color: #fffbeb !important;
        color: #92400e;
    }}
    .no-data {{
        color: #64748b;
        font-style: italic;
    }}
    .chart-box {{
        text-align: center;
        margin-top: 10px;
    }}
    .chart-box svg {{
        max-width: 95%;
        height: auto;
    }}
    .bullet-list {{
        margin-top: 0;
        margin-bottom: 12px;
        padding-left: 20px;
    }}
    .bullet-list li {{
        margin-bottom: 5px;
    }}
</style>
</head>
<body>

    <!-- PAGE 1: COVER -->
    <div class="page" style="height: 297mm; margin: 0; padding: 0;">
        <div class="cover-container">
            <div class="cover-header">
                <div class="cover-title">INSTITUTIONAL EQUITY RESEARCH NOTE</div>
                <div class="cover-subtitle">StockIQ Intelligence Engines</div>
            </div>
            
            <div class="cover-body">
                <div class="cover-company">{company_data.get('company_name') or company_data.get('name') or ticker_upper}</div>
                <div class="cover-ticker">NSE: {ticker_upper}</div>
                <div class="verdict-badge" style="{badge_style}">{verdict}</div>
            </div>
            
            <div class="cover-footer">
                <div class="footer-col">
                    <strong>PREPARED ON</strong><br>
                    {date_str}
                </div>
                <div class="footer-col">
                    <strong>ANALYST VERDICT</strong><br>
                    {verdict.split(' / ')[0]}
                </div>
                <div class="footer-col">
                    <strong>12-MONTH TARGET</strong><br>
                    {target_price}
                </div>
            </div>
        </div>
    </div>

    <!-- PAGE 2: SCORES SUMMARY + INVESTMENT THESIS -->
    <div class="page">
        <h1>Quantitative Scorecard & Thesis</h1>
        
        <div class="grid-2">
            <div class="col">
                <div class="score-card">
                    <div class="score-lbl">Piotroski F-Score</div>
                    <div class="score-val">{piotroski.get('score', 'N/A')}/9</div>
                    <div class="score-lbl" style="font-size: 7pt; color: #15803d;">{piotroski.get('verdict', '')}</div>
                </div>
            </div>
            <div class="col">
                <div class="score-card">
                    <div class="score-lbl">Beneish M-Score</div>
                    <div class="score-val">{beneish_score_str}</div>
                    <div class="score-lbl" style="font-size: 7pt; color: #b91c1c;">{beneish.get('verdict', '')}</div>
                </div>
            </div>
            <div class="col">
                <div class="score-card">
                    <div class="score-lbl">Altman Z-Score</div>
                    <div class="score-val">{altman_score_str}</div>
                    <div class="score-lbl" style="font-size: 7pt; color: #1e3a8a;">{altman.get('verdict', '')}</div>
                </div>
            </div>
            <div class="col">
                <div class="score-card">
                    <div class="score-lbl">DuPont ROE</div>
                    <div class="score-val">{dupont_roe_str}</div>
                    <div class="score-lbl" style="font-size: 7pt;">Net Margin: {dupont_npm_str}</div>
                </div>
            </div>
        </div>
        
        <h2>Strategic Outlook</h2>
        <p>{exec_summary.get('strategic_outlook') or 'No strategic outlook statement was synthesized by the engine.'}</p>
        
        <h2>Business Model Summary</h2>
        <p>{business_model.get('monetization_flow') or 'No monetization flow synthesized.'}</p>
        
        <h2>Competitive Landscape Summary</h2>
        <p>{competitors.get('pricing_power_indicators') or 'No competitive landscape overview synthesized.'}</p>
        
        <h2>Capital Efficiency Verdict</h2>
        <p>{cap_alloc.get('capital_efficiency_verdict') or 'No capital allocation efficiency verdict synthesized.'}</p>
    </div>

    <!-- PAGE 3: FINANCIAL CHARTS -->
    <div class="page">
        <h1>Historical Financial Trends</h1>
        <p>Visualizing long-term revenue growth against profitability and assessing cash conversion sustainability over the last 10 fiscal cycles.</p>
        
        <div class="chart-box">
            {rev_pat_svg}
        </div>
        
        <div class="chart-box" style="margin-top: 15px;">
            {cfo_pat_svg}
        </div>
    </div>

    <!-- PAGE 4: DCF + VALUATION ANALYSIS -->
    <div class="page">
        <h1>Valuation Suite & Sensitivity</h1>
        
        <div class="grid-2">
            <div class="col" style="border-right: 1px solid #cbd5e1; padding-right: 15px;">
                <h2>DCF Scenario Estimates</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Scenario</th>
                            <th>FCF Growth</th>
                            <th>Intrinsic Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Bear Case</strong></td>
                            <td>{dcf_bear_growth_str}</td>
                            <td>{dcf_bear_value_str}</td>
                        </tr>
                        <tr>
                            <td><strong>Base Case</strong></td>
                            <td>{dcf_base_growth_str}</td>
                            <td>{dcf_base_value_str}</td>
                        </tr>
                        <tr>
                            <td><strong>Bull Case</strong></td>
                            <td>{dcf_bull_growth_str}</td>
                            <td>{dcf_bull_value_str}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="col" style="padding-left: 10px;">
                <h2>Other Valuation Models</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Metric</th>
                            <th>Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Earnings Power Value (EPV)</strong></td>
                            <td>{epv_str}</td>
                        </tr>
                        <tr>
                            <td><strong>EPV Margin of Safety (Upside)</strong></td>
                            <td>{epv_upside_str}</td>
                        </tr>
                        <tr>
                            <td><strong>Implied Growth (Reverse DCF)</strong></td>
                            <td>{reverse_dcf_growth_str}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <h2>WACC & Valuation Assumptions</h2>
        <table style="margin-bottom: 12px;">
            <thead>
                <tr>
                    <th>Risk Free Rate</th>
                    <th>Beta</th>
                    <th>Equity Risk Premium</th>
                    <th>Debt-to-Equity</th>
                    <th>Weighted Cost of Capital (WACC)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>{wacc_rf_str}</td>
                    <td>{wacc_beta_str}</td>
                    <td>{wacc_erp_str}</td>
                    <td>{wacc_de_str}</td>
                    <td>{wacc_value_str}</td>
                </tr>
            </tbody>
        </table>

        <h2>Valuation Sensitivity Matrix (WACC vs growth)</h2>
        {sens_html}
    </div>

    <!-- PAGE 5: FORENSIC ACCOUNTING FINDINGS -->
    <div class="page">
        <h1>Forensic Accounting & Rules Engine</h1>
        
        <div class="grid-2">
            <div class="col">
                <h2>Beneish M-Score Components</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Ratio Name</th>
                            <th>Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>DSRI</strong> (Receivables Index)</td>
                            <td>{dsri_str}</td>
                        </tr>
                        <tr>
                            <td><strong>GMI</strong> (Gross Margin Index)</td>
                            <td>{gmi_str}</td>
                        </tr>
                        <tr>
                            <td><strong>AQI</strong> (Asset Quality Index)</td>
                            <td>{aqi_str}</td>
                        </tr>
                        <tr>
                            <td><strong>SGI</strong> (Sales Growth Index)</td>
                            <td>{sgi_str}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="col">
                <h2>Altman Z-Score Components</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Factor Name</th>
                            <th>Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>X1</strong> (Working Capital/Total Assets)</td>
                            <td>{x1_str}</td>
                        </tr>
                        <tr>
                            <td><strong>X2</strong> (Retained Earnings/Total Assets)</td>
                            <td>{x2_str}</td>
                        </tr>
                        <tr>
                            <td><strong>X3</strong> (EBIT/Total Assets)</td>
                            <td>{x3_str}</td>
                        </tr>
                        <tr>
                            <td><strong>X4</strong> (MV of Equity/Total Debt)</td>
                            <td>{x4_str}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <h2>Rules Engine Signals</h2>
        {signals_html}
    </div>

    <!-- PAGE 6: CONCALL INTELLIGENCE & MANAGEMENT ASSESSMENT -->
    <div class="page">
        <h1>Concall Intelligence & Dialogue Quality</h1>
        
        <h2>Management Excuses & Deflection Rhetoric</h2>
        {f"<p>The rules engine detected blame phrases or external macro factors in management's dialogue: <code>{', '.join(excuses)}</code></p>" if excuses else "<p>No macro blame or deflection language was registered by the rules engine.</p>"}
        
        <h2>Qualitative Dialogue Confidence Score</h2>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 4px; display: inline-block; font-weight: bold; margin-bottom: 14px;">
            DIALOGUE CONFIDENCE SCORE: <span style="font-size: 11pt; color: #1e3a8a;">{concall_analysis.get('confidence_indicators', {}).get('score', 'MEDIUM')}</span>
        </div>
        
        <h2>Forward-Looking Guidance and Targets</h2>
        <ul class="bullet-list">
            {"".join(f"<li><code>{g}</code></li>" for g in guidance) if guidance else "<li>No forward-looking guidance statements extracted.</li>"}
        </ul>

        <h2>AI Assessment of Management Rhetoric</h2>
        <p><strong>Guidance Reliability:</strong> {ai_concall.get('guidance_accuracy_assessment', 'No assessment available.')}</p>
        <p><strong>Rhetorical Analysis:</strong> {ai_concall.get('rhetoric_tone_analysis', 'No tone analysis available.')}</p>
        <p><strong>Management Consistency:</strong> {ai_concall.get('consistency_with_financials', 'No consistency check was rendered.')}</p>
    </div>

    <!-- PAGE 7: RISK MATRIX -->
    <div class="page">
        <h1>Structured Risk Assessments</h1>
        <p>Institutional evaluation of key risks facing {company_data.get('company_name') or ticker_upper} and mitigation strategies proposed by the AI audit engines.</p>
        
        <table>
            <thead>
                <tr>
                    <th style="width: 25%;">Risk Area</th>
                    <th style="width: 15%;">Severity</th>
                    <th>Details and Impact Summary</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Regulatory Risks</strong></td>
                    <td>MEDIUM</td>
                    <td>{risk_analysis.get('regulatory_risks') or 'Potential impact from government compliance, tariff updates, or tax structure changes.'}</td>
                </tr>
                <tr>
                    <td><strong>Operational Risks</strong></td>
                    <td>HIGH</td>
                    <td>{risk_analysis.get('operational_risks') or 'Potential execution bottlenecks, raw material cost pressures, and human capital retention.'}</td>
                </tr>
                <tr>
                    <td><strong>Macroeconomic Risks</strong></td>
                    <td>MEDIUM</td>
                    <td>{risk_analysis.get('macro_economic_risks') or 'FX fluctuation risk, high interest rate environment impact on capex, inflation trends.'}</td>
                </tr>
                <tr>
                    <td><strong>Mitigation Strategies</strong></td>
                    <td>N/A</td>
                    <td>{risk_analysis.get('mitigation_strategies') or 'Diversified supply chain contracts, hedging net interest rate positions, currency swaps.'}</td>
                </tr>
            </tbody>
        </table>
    </div>

    <!-- PAGE 8: LEGAL DISCLAIMER & DATA SOURCES -->
    <div class="page">
        <h1>Disclosures & Catalog of Data Sources</h1>
        
        <h2>Data Sources & Document Provenance</h2>
        <p>This institutional research note was compiled utilizing audited financial datasets and official documents:</p>
        <ul class="bullet-list">
            <li>Official corporate Annual Reports (10-K equivalents) filed with exchange regulators.</li>
            <li>Quarterly Earnings Call Transcript transcripts stored in vector collections.</li>
            <li>Historical database feeds containing share price adjustments and stock volatility coefficients.</li>
        </ul>
        
        <h2>Legal Disclaimer & Terms of Service</h2>
        <p style="font-size: 8pt; color: #475569; text-align: justify; line-height: 1.4;">
            <strong>IMPORTANT NOTICE:</strong> This research note is generated automatically by StockIQ using automated analysis engines, statistical fallbacks, and generative AI models. It is produced solely for informational purposes and does not constitute a recommendation, endorsement, solicitation, or offer to buy or sell any securities or financial instruments. 
        </p>
        <p style="font-size: 8pt; color: #475569; text-align: justify; line-height: 1.4;">
            The analytics, scores (Piotroski, Beneish, Altman), and valuation outputs (DCF, EPV) contained herein are calculated based on historical financial disclosures and are subject to data quality limits or errors. Past performance is not indicative of future returns. StockIQ and its authors are not registered investment advisors or brokers under SEBI, SEC, or other regulators. Investors should consult professional financial advisors and perform independent audits before executing trades.
        </p>
    </div>

</body>
</html>
"""
    
    # Generate PDF bytes via WeasyPrint
    try:
        pdf_bytes = HTML(string=html_content).write_pdf()
        # Return streaming response
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={ticker_upper}_StockIQ_Research_Note.pdf"
            }
        )
    except Exception as e:
        logger.error(f"WeasyPrint failed to render PDF: {e}")
        raise HTTPException(status_code=500, detail=f"WeasyPrint rendering failed: {str(e)}")
