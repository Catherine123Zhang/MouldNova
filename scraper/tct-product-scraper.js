#!/usr/bin/env node
/**
 * TCT Asia 2026 Product Scraper
 *
 * Usage:
 *   node scraper/tct-product-scraper.js              # scrape all 36 pages
 *   node scraper/tct-product-scraper.js --pages 0-2  # scrape pages 0–2 only
 *
 * Output: scraper/tct-products.json
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://online.tctasia.cn';
const LIST_URL = '/zh-cn/showroom-2026/products';
const OUTPUT = path.join(__dirname, 'tct-products.json');
const DELAY_MS = 1500;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetch(urlPath) {
  const url = urlPath.startsWith('http') ? urlPath : BASE + urlPath;
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml',
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function stripTags(html) {
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// --- Step 1: Get all product links from list pages ---

async function scrapeListPage(page) {
  const url = `${LIST_URL}?page=${page}`;
  console.log(`  Fetching product list page ${page}...`);
  const html = await fetch(url);

  const products = [];
  const seen = new Set();
  // Product links: /products/XXXX
  const linkRegex = /href="(\/zh-cn\/showroom-2026\/products\/([a-z0-9]+))"/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const slug = match[2];
    if (slug === 'products' || seen.has(slug)) continue;
    seen.add(slug);
    products.push({ slug, url: href });
  }

  return products;
}

async function getAllProductLinks(startPage, endPage) {
  const all = [];
  for (let p = startPage; p <= endPage; p++) {
    const products = await scrapeListPage(p);
    console.log(`  Page ${p}: found ${products.length} products`);
    all.push(...products);
    if (p < endPage) await sleep(DELAY_MS);
  }
  const map = new Map();
  for (const p of all) {
    if (!map.has(p.slug)) map.set(p.slug, p);
  }
  return [...map.values()];
}

// --- Step 2: Scrape individual product detail pages ---

async function scrapeProductDetail(productInfo) {
  try {
    const html = await fetch(productInfo.url);

    // Product name — title format: "产品名 | 公司名 | TCT亚洲展在线展厅"
    let productName = '';
    let companyName = '';
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      const parts = titleMatch[1].split('|').map(s => s.trim());
      productName = parts[0] || '';
      companyName = parts.length >= 2 ? parts[1] : '';
    }

    // Company slug — from institution link
    let companySlug = '';
    const compMatch = html.match(/\/institutions\/([a-z0-9]+)/i);
    if (compMatch) companySlug = compMatch[1];

    // Product image — from data-gallerys in como-base-about__left (main product image only)
    const images = [];
    const galleryRegex = /como-base-about__left[\s\S]*?data-gallerys="([^"]+)"/g;
    let imgMatch;
    while ((imgMatch = galleryRegex.exec(html)) !== null) {
      let imgUrl = imgMatch[1].replace(/&amp;/g, '&');
      if (!images.includes(imgUrl)) images.push(imgUrl);
    }

    // Description — <div class="como-richtext mt-7">
    let description = '';
    const descMatch = html.match(/como-richtext[^"]*mt-7">([\s\S]*?)<\/div>/);
    if (descMatch) {
      description = stripTags(descMatch[1]).substring(0, 3000);
    }
    // Fallback: try webform-markup
    if (!description) {
      const descMatch2 = html.match(/js-form-type-como-webform-markup[^"]*">([\s\S]*?)<\/div>/);
      if (descMatch2) description = stripTags(descMatch2[1]).substring(0, 3000);
    }

    // Categories — mdc-chip__text (first set before 应用领域)
    const categories = [];
    const applications = [];
    const allChips = [...html.matchAll(/mdc-chip__text">([^<]+)/g)].map(m => m[1].trim());

    // Split chips: before 应用领域 = categories, after = applications
    const appIdx = html.indexOf('应用领域');
    if (appIdx > 0) {
      // Categories appear before 应用领域, applications after
      const beforeApp = html.substring(0, appIdx);
      const afterApp = html.substring(appIdx);

      const catChips = [...beforeApp.matchAll(/mdc-chip__text">([^<]+)/g)].map(m => m[1].trim());
      const appChips = [...afterApp.matchAll(/mdc-chip__text">([^<]+)/g)].map(m => m[1].trim());

      catChips.forEach(c => { if (c && !categories.includes(c)) categories.push(c); });
      appChips.forEach(a => { if (a && !applications.includes(a)) applications.push(a); });
    } else {
      // No 应用领域 section — all chips are categories
      allChips.forEach(c => { if (c && !categories.includes(c)) categories.push(c); });
    }

    // Highlight tags (全球首发, 亚洲首发, etc.)
    const highlights = [];
    const hlRegex = /class="[^"]*highlight[^"]*"[^>]*>([^<]+)/gi;
    let hlMatch;
    while ((hlMatch = hlRegex.exec(html)) !== null) {
      const hl = hlMatch[1].trim();
      if (hl && !highlights.includes(hl)) highlights.push(hl);
    }

    // Views
    let views = 0;
    const viewsMatch = html.match(/visibility<\/span><span[^>]*>(\d+)/);
    if (viewsMatch) views = parseInt(viewsMatch[1]);

    return {
      slug: productInfo.slug,
      product_name: productName,
      company_name: companyName,
      company_slug: companySlug,
      images,
      description,
      categories,
      applications,
      highlights,
      views,
      source_url: BASE + productInfo.url,
    };
  } catch (err) {
    console.error(`  Error scraping product ${productInfo.slug}: ${err.message}`);
    return {
      slug: productInfo.slug,
      error: err.message,
      source_url: BASE + productInfo.url,
    };
  }
}

// --- Main ---

async function main() {
  let startPage = 0;
  let endPage = 35; // 36 pages (0-indexed)

  const pagesArg = process.argv.find((_, i, a) => a[i - 1] === '--pages');
  if (pagesArg) {
    const [s, e] = pagesArg.split('-').map(Number);
    startPage = s;
    endPage = e ?? s;
  }

  console.log(`\n=== TCT Asia 2026 Product Scraper ===`);
  console.log(`Pages: ${startPage} to ${endPage}\n`);

  console.log('Step 1: Collecting product links...');
  const products = await getAllProductLinks(startPage, endPage);
  console.log(`\nFound ${products.length} unique products.\n`);

  console.log('Step 2: Scraping product details...');
  const results = [];
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    process.stdout.write(`  [${i + 1}/${products.length}] ${p.slug}...`);
    const detail = await scrapeProductDetail(p);
    results.push(detail);
    console.log(` ${detail.product_name || 'ok'}`);

    if ((i + 1) % 50 === 0) {
      fs.writeFileSync(OUTPUT, JSON.stringify(results, null, 2), 'utf-8');
      console.log(`  (saved progress: ${results.length} products)`);
    }

    if (i < products.length - 1) await sleep(DELAY_MS);
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(results, null, 2), 'utf-8');

  const withImages = results.filter(r => r.images && r.images.length > 0).length;
  const withDesc = results.filter(r => r.description).length;
  const withApps = results.filter(r => r.applications && r.applications.length > 0).length;
  const withErrors = results.filter(r => r.error).length;

  console.log(`\n=== Done ===`);
  console.log(`Total: ${results.length} products`);
  console.log(`With images: ${withImages}`);
  console.log(`With description: ${withDesc}`);
  console.log(`With applications: ${withApps}`);
  console.log(`Errors: ${withErrors}`);
  console.log(`Output: ${OUTPUT}\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
