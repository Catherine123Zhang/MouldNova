#!/usr/bin/env node
/**
 * TCT Asia 2026 Exhibitor Scraper
 *
 * Usage:
 *   node scraper/tct-scraper.js              # scrape all 22 pages
 *   node scraper/tct-scraper.js --pages 0-2  # scrape pages 0–2 only (for testing)
 *
 * Output: scraper/tct-exhibitors.json
 */

const https = require('https');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const BASE = 'https://online.tctasia.cn';
const LIST_URL = '/zh-cn/showroom-2026/institutions';
const OUTPUT = path.join(__dirname, 'tct-exhibitors.json');
const DELAY_MS = 1500; // polite delay between requests

// --- helpers ---

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

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

// --- Step 1: Get all company links from list pages ---

async function scrapeListPage(page) {
  const url = `${LIST_URL}?page=${page}`;
  console.log(`  Fetching list page ${page}...`);
  const html = await fetch(url);
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const companies = [];
  // Find all institution links - they follow pattern /institutions/XXXX
  const links = doc.querySelectorAll('a[href*="/institutions/"]');
  const seen = new Set();

  for (const link of links) {
    const href = link.getAttribute('href');
    if (!href || !href.includes('/institutions/')) continue;
    // Extract the institution slug
    const match = href.match(/\/institutions\/([a-z0-9]+)$/i);
    if (!match) continue;
    const slug = match[1];
    if (slug === 'institutions' || seen.has(slug)) continue;
    seen.add(slug);

    // Try to get company name from the link or nearby elements
    const name = link.textContent.trim() || '';
    companies.push({ slug, name, url: href });
  }

  return companies;
}

async function getAllCompanyLinks(startPage, endPage) {
  const all = [];
  for (let p = startPage; p <= endPage; p++) {
    const companies = await scrapeListPage(p);
    console.log(`  Page ${p}: found ${companies.length} companies`);
    all.push(...companies);
    if (p < endPage) await sleep(DELAY_MS);
  }
  // Deduplicate by slug
  const map = new Map();
  for (const c of all) {
    if (!map.has(c.slug)) map.set(c.slug, c);
  }
  return [...map.values()];
}

// --- Step 2: Scrape individual company detail pages ---

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

async function scrapeCompanyDetail(companyInfo) {
  try {
    const html = await fetch(companyInfo.url);

    // Company name — title format: "关于 | 公司名 | TCT亚洲展在线展厅"
    let name = '';
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      const parts = titleMatch[1].split('|').map(s => s.trim());
      name = parts.length >= 2 ? parts[1] : parts[0];
    }
    if (!name || name === '关于') name = companyInfo.name;

    // Booth number — pattern like "7.1 / 7F15"
    let booth = '';
    const boothMatch = html.match(/(\d+\.\d+\s*\/\s*\d+[A-Z]\d+)/);
    if (boothMatch) booth = boothMatch[1].replace(/\s+/g, ' ');

    // Product categories — inside mdc-chip__text spans
    const categories = [];
    const catRegex = /mdc-chip__text">([^<]+)/g;
    let catMatch;
    while ((catMatch = catRegex.exec(html)) !== null) {
      const cat = catMatch[1].trim();
      if (cat && !categories.includes(cat)) categories.push(cat);
    }

    // Address — <th>公司所在地</th><td><span>地址</span></td>
    let address = '';
    const addrMatch = html.match(/公司所在地<\/th>\s*<td><span>([^<]+)<\/span>/);
    if (addrMatch) {
      address = addrMatch[1].trim();
    }

    // Website — <th>公司网址</th><td><a href="...">
    let website = '';
    const siteMatch = html.match(/公司网址<\/th>\s*<td>\s*<a[^>]*href="(https?:\/\/[^"]+)"/);
    if (siteMatch && !siteMatch[1].includes('tctasia.cn')) {
      website = siteMatch[1];
    }

    // Description — inside <div class="js-form-type-como-webform-markup mt-7">...</div>
    let description = '';
    const descMatch = html.match(/js-form-type-como-webform-markup[^"]*">([\s\S]*?)<\/div>/);
    if (descMatch) {
      description = stripTags(descMatch[1]).substring(0, 2000);
    }

    // Company logo — from como-base-about__left__media--logo img
    let logo = '';
    const logoMatch = html.match(/como-base-about__left__media--logo[\s\S]*?<img\s+src="([^"]+)"/);
    if (logoMatch) {
      logo = logoMatch[1].replace(/&amp;/g, '&');
    }

    // Views count — "visibility</span><span class="statistics-button__l...">5196"
    let views = 0;
    const viewsMatch = html.match(/visibility<\/span><span[^>]*>(\d+)/);
    if (viewsMatch) views = parseInt(viewsMatch[1]);

    return {
      slug: companyInfo.slug,
      name,
      logo,
      booth,
      categories,
      address,
      website,
      description,
      views,
      source_url: BASE + companyInfo.url,
    };
  } catch (err) {
    console.error(`  Error scraping ${companyInfo.slug}: ${err.message}`);
    return {
      slug: companyInfo.slug,
      name: companyInfo.name,
      error: err.message,
      source_url: BASE + companyInfo.url,
    };
  }
}

// --- Main ---

async function main() {
  // Parse args
  let startPage = 0;
  let endPage = 21; // 22 pages total (0-indexed)

  const pagesArg = process.argv.find((_, i, a) => a[i - 1] === '--pages');
  if (pagesArg) {
    const [s, e] = pagesArg.split('-').map(Number);
    startPage = s;
    endPage = e ?? s;
  }

  console.log(`\n=== TCT Asia 2026 Exhibitor Scraper ===`);
  console.log(`Pages: ${startPage} to ${endPage}\n`);

  // Step 1: Get all company links
  console.log('Step 1: Collecting company links...');
  const companies = await getAllCompanyLinks(startPage, endPage);
  console.log(`\nFound ${companies.length} unique companies.\n`);

  // Step 2: Scrape each company detail page
  console.log('Step 2: Scraping company details...');
  const results = [];
  for (let i = 0; i < companies.length; i++) {
    const c = companies[i];
    process.stdout.write(`  [${i + 1}/${companies.length}] ${c.name || c.slug}...`);
    const detail = await scrapeCompanyDetail(c);
    results.push(detail);
    console.log(' done');

    // Save progress every 50 companies
    if ((i + 1) % 50 === 0) {
      fs.writeFileSync(OUTPUT, JSON.stringify(results, null, 2), 'utf-8');
      console.log(`  (saved progress: ${results.length} companies)`);
    }

    if (i < companies.length - 1) await sleep(DELAY_MS);
  }

  // Final save
  fs.writeFileSync(OUTPUT, JSON.stringify(results, null, 2), 'utf-8');

  // Summary
  const withCategories = results.filter(r => r.categories && r.categories.length > 0).length;
  const withWebsite = results.filter(r => r.website).length;
  const withErrors = results.filter(r => r.error).length;

  console.log(`\n=== Done ===`);
  console.log(`Total: ${results.length} companies`);
  console.log(`With categories: ${withCategories}`);
  console.log(`With website: ${withWebsite}`);
  console.log(`Errors: ${withErrors}`);
  console.log(`Output: ${OUTPUT}\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
