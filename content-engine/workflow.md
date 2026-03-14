# Content Engine Workflow

## Overview
Automated content production system for mouldnova.com
Target: Injection mold engineers, toolmakers, procurement managers in US/EU/India

## Production Pipeline (per keyword)

### Step 1: Keyword Research
- Input: target keyword (e.g., "conformal cooling benefits")
- Analyze: search intent (informational / commercial / transactional)
- Check: keyword difficulty, search volume, geographic distribution

### Step 2: Competitive Analysis (SERP Scrape)
- Fetch top 10 Google results for the keyword
- Extract: titles, headings, word count, content structure
- Identify: content gaps, angles competitors miss
- Note: what data/stats are cited, what questions are answered

### Step 3: Content Brief
- Target word count: 1,500–2,500 words
- Structure: AIDA framework
  - **A (Attention)**: Headline with specific data/number + hero
  - **I (Interest)**: Industry pain point, relatable problem
  - **D (Desire)**: Solution with real data, case studies, comparison tables
  - **A (Action)**: CTA — WhatsApp inquiry, free evaluation, quote request
- Internal links: connect to service pages
- Schema markup: Article + FAQPage

### Step 4: Content Generation
- Write in authoritative, technical tone (not salesy)
- Include: comparison tables, before/after data, technical specs
- Add FAQ section (3–5 questions) for GEO
- Format: clean HTML using site CSS

### Step 5: Publish & Index
- Save to website/blog/
- Update blog index page
- Update sitemap.xml
- Push to GitHub → auto-deploy on Vercel

## Content Types

### Type A: Industry Problem Articles
"How to eliminate gate burn marks in PETG injection molding"
"Why your injection mold cycle time is too long (and how to fix it)"

### Type B: Technology Explainer
"Conformal Cooling vs Conventional Cooling: Complete Guide"
"SLM vs DMLS vs LPBF: What's the Difference?"

### Type C: Comparison / Buyer's Guide
"China vs Germany Metal 3D Printing: Price, Quality, Lead Time"
"Top 5 Conformal Cooling Insert Manufacturers 2026"

### Type D: Application / Case Study
"Conformal Cooling for Automotive Connectors: 43% Faster Cycles"
"Medical Device Mold: How 3D Printed Inserts Increased Output 73%"

## AIDA Template Structure

```
HERO: Headline (number + benefit) + subtitle + CTA
STATS BAR: 3-4 key numbers
SECTION 1 (Attention): The problem — relatable pain point
SECTION 2 (Interest): Why this matters — cost/time/quality impact
SECTION 3 (Desire): The solution — with data, tables, case studies
SECTION 4 (Desire): Our capability — equipment, process, client logos
SECTION 5 (Action): FAQ (GEO optimized)
CTA: WhatsApp + Quote form
```

## Keyword Queue
See: keywords-queue.md
