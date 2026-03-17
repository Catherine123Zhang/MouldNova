#!/usr/bin/env node
/**
 * TCT Directory Translator
 *
 * Translates company and product data from Chinese to English.
 * Uses static mappings for categories/provinces, and Claude API for names/descriptions.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-xxx node directory-generator/translate.js
 *
 * Input:  scraper/tct-exhibitors.json, scraper/tct-products.json
 * Output: directory-generator/companies-en.json, directory-generator/products-en.json
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const TRANSLATIONS = require('./translations.json');
const COMPANIES_IN = path.join(__dirname, '..', 'scraper', 'tct-exhibitors.json');
const PRODUCTS_IN = path.join(__dirname, '..', 'scraper', 'tct-products.json');
const COMPANIES_OUT = path.join(__dirname, 'companies-en.json');
const PRODUCTS_OUT = path.join(__dirname, 'products-en.json');

// Supports both Alibaba DashScope (Qwen) and Anthropic Claude APIs
// Set DASHSCOPE_API_KEY for Alibaba Qwen, or ANTHROPIC_API_KEY for Claude
const DASHSCOPE_KEY = process.env.DASHSCOPE_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const API_KEY = DASHSCOPE_KEY || ANTHROPIC_KEY;
const USE_QWEN = !!DASHSCOPE_KEY;
const BATCH_SIZE = 20; // companies per API call
const DELAY_MS = 1000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// --- Static translations ---

function translateCategory(cat) {
  return TRANSLATIONS.categories[cat] || TRANSLATIONS.applications[cat] || cat;
}

function translateApplication(app) {
  return TRANSLATIONS.applications[app] || app;
}

function translateAddress(addr) {
  if (!addr) return '';
  let result = addr;
  // Replace country
  for (const [zh, en] of Object.entries(TRANSLATIONS.countries)) {
    result = result.replace(zh, en);
  }
  // Replace provinces
  for (const [zh, en] of Object.entries(TRANSLATIONS.provinces)) {
    result = result.replace(zh, en);
  }
  return result;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

// --- LLM API translation (supports both Qwen and Claude) ---

function callLLM(prompt) {
  if (USE_QWEN) return callQwen(prompt);
  return callClaude(prompt);
}

function callQwen(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'qwen-plus',
      input: { messages: [{ role: 'user', content: prompt }] },
      parameters: { result_format: 'message', max_tokens: 4096 },
    });

    const req = https.request({
      hostname: 'dashscope.aliyuncs.com',
      path: '/api/v1/services/aigc/text-generation/generation',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DASHSCOPE_KEY}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.output?.choices?.[0]?.message?.content) {
            resolve(parsed.output.choices[0].message.content);
          } else if (parsed.output?.text) {
            resolve(parsed.output.text);
          } else {
            reject(new Error('Unexpected Qwen response: ' + data.substring(0, 300)));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.content && parsed.content[0]) {
            resolve(parsed.content[0].text);
          } else {
            reject(new Error('Unexpected Claude response: ' + data.substring(0, 200)));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function translateBatch(companies) {
  const entries = companies.map((c, i) =>
    `${i + 1}. NAME: ${c.name}\n   DESC: ${c.description || '(none)'}`
  ).join('\n\n');

  const prompt = `Translate the following Chinese 3D printing / additive manufacturing company names and descriptions to English.

For each company:
- Translate the company name to a natural English trade name. Keep brand names/acronyms (e.g., BLT, Farsoon, UnionTech). If the name includes 股份有限公司/有限公司, translate as "Co., Ltd." or omit if there's a clear brand name.
- Translate the description to professional English suitable for a business directory.
- Keep technical terms accurate (SLM, DMLS, LPBF, SLA, FDM, etc.)

Return ONLY a valid JSON array with objects having "index", "name_en", "description_en" fields. No markdown, no explanation.

Companies:
${entries}`;

  const response = await callLLM(prompt);
  // Parse JSON from response
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('No JSON array found in API response');
  return JSON.parse(jsonMatch[0]);
}

async function translateProductBatch(products) {
  const entries = products.map((p, i) =>
    `${i + 1}. PRODUCT: ${p.product_name}\n   COMPANY: ${p.company_name}\n   DESC: ${p.description || '(none)'}`
  ).join('\n\n');

  const prompt = `Translate the following Chinese 3D printing product names and descriptions to English.

For each product:
- Translate the product name. Keep model numbers, brand names, and technical abbreviations (SLM, SLA, FDM, etc.)
- Translate the description to professional English suitable for a product catalog.

Return ONLY a valid JSON array with objects having "index", "product_name_en", "description_en" fields. No markdown, no explanation.

Products:
${entries}`;

  const response = await callLLM(prompt);
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('No JSON array found in API response');
  return JSON.parse(jsonMatch[0]);
}

// --- Main ---

async function main() {
  if (!API_KEY) {
    console.error('Error: Set DASHSCOPE_API_KEY (Alibaba Qwen) or ANTHROPIC_API_KEY (Claude).');
    console.error('Usage: DASHSCOPE_API_KEY=sk-xxx node directory-generator/translate.js');
    process.exit(1);
  }
  console.log(`Using ${USE_QWEN ? 'Alibaba Qwen (DashScope)' : 'Anthropic Claude'} API`);

  // --- Translate companies ---
  console.log('\n=== Translating Companies ===\n');
  const companies = JSON.parse(fs.readFileSync(COMPANIES_IN, 'utf-8'));
  console.log(`Loaded ${companies.length} companies.`);

  const translatedCompanies = [];
  for (let i = 0; i < companies.length; i += BATCH_SIZE) {
    const batch = companies.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(companies.length / BATCH_SIZE);
    process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} companies)...`);

    try {
      const translations = await translateBatch(batch);

      for (let j = 0; j < batch.length; j++) {
        const c = batch[j];
        const t = translations.find(t => t.index === j + 1) || {};
        const nameEn = t.name_en || c.name;
        translatedCompanies.push({
          slug: c.slug,
          name_zh: c.name,
          name_en: nameEn,
          name_slug: slugify(nameEn),
          logo: c.logo || '',
          booth: c.booth,
          categories_zh: c.categories,
          categories_en: (c.categories || []).map(translateCategory),
          address_zh: c.address,
          address_en: translateAddress(c.address),
          website: c.website,
          description_zh: c.description,
          description_en: t.description_en || '',
          views: c.views,
          source_url: c.source_url,
        });
      }
      console.log(' done');
    } catch (err) {
      console.error(` error: ${err.message}`);
      // Still add companies with original Chinese text
      for (const c of batch) {
        translatedCompanies.push({
          slug: c.slug,
          name_zh: c.name,
          name_en: c.name,
          name_slug: slugify(c.name),
          logo: c.logo || '',
          booth: c.booth,
          categories_zh: c.categories,
          categories_en: (c.categories || []).map(translateCategory),
          address_zh: c.address,
          address_en: translateAddress(c.address),
          website: c.website,
          description_zh: c.description,
          description_en: '',
          views: c.views,
          source_url: c.source_url,
        });
      }
    }

    // Save progress
    fs.writeFileSync(COMPANIES_OUT, JSON.stringify(translatedCompanies, null, 2), 'utf-8');
    if (i + BATCH_SIZE < companies.length) await sleep(DELAY_MS);
  }

  console.log(`\nCompanies saved: ${COMPANIES_OUT} (${translatedCompanies.length} entries)`);

  // --- Translate products ---
  if (fs.existsSync(PRODUCTS_IN)) {
    console.log('\n=== Translating Products ===\n');
    const products = JSON.parse(fs.readFileSync(PRODUCTS_IN, 'utf-8'));
    console.log(`Loaded ${products.length} products.`);

    const translatedProducts = [];
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(products.length / BATCH_SIZE);
      process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} products)...`);

      try {
        const translations = await translateProductBatch(batch);

        for (let j = 0; j < batch.length; j++) {
          const p = batch[j];
          const t = translations.find(t => t.index === j + 1) || {};
          const nameEn = t.product_name_en || p.product_name;
          translatedProducts.push({
            slug: p.slug,
            product_name_zh: p.product_name,
            product_name_en: nameEn,
            product_slug: slugify(nameEn),
            company_name: p.company_name,
            company_slug: p.company_slug,
            images: p.images,
            description_zh: p.description,
            description_en: t.description_en || '',
            categories_zh: p.categories,
            categories_en: (p.categories || []).map(translateCategory),
            applications_zh: p.applications,
            applications_en: (p.applications || []).map(translateApplication),
            highlights: p.highlights,
            views: p.views,
            source_url: p.source_url,
          });
        }
        console.log(' done');
      } catch (err) {
        console.error(` error: ${err.message}`);
        for (const p of batch) {
          translatedProducts.push({
            slug: p.slug,
            product_name_zh: p.product_name,
            product_name_en: p.product_name,
            product_slug: slugify(p.product_name),
            company_name: p.company_name,
            company_slug: p.company_slug,
            images: p.images,
            description_zh: p.description,
            description_en: '',
            categories_zh: p.categories,
            categories_en: (p.categories || []).map(translateCategory),
            applications_zh: p.applications,
            applications_en: (p.applications || []).map(translateApplication),
            highlights: p.highlights,
            views: p.views,
            source_url: p.source_url,
          });
        }
      }

      fs.writeFileSync(PRODUCTS_OUT, JSON.stringify(translatedProducts, null, 2), 'utf-8');
      if (i + BATCH_SIZE < products.length) await sleep(DELAY_MS);
    }

    console.log(`\nProducts saved: ${PRODUCTS_OUT} (${translatedProducts.length} entries)`);
  } else {
    console.log('\nNo products file found, skipping product translation.');
  }

  console.log('\n=== Translation Complete ===\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
