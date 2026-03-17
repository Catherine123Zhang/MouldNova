#!/usr/bin/env node
/**
 * TCT Directory Static Page Generator
 *
 * Reads translated company & product JSON, generates static HTML pages.
 *
 * Usage:
 *   node directory-generator/generate.js
 *
 * Input:  directory-generator/companies-en.json, directory-generator/products-en.json
 * Output: website/directory/ (HTML files)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'website', 'directory');
const COMPANIES_FILE = path.join(__dirname, 'companies-en.json');
const PRODUCTS_FILE = path.join(__dirname, 'products-en.json');

// --- Helpers ---

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(str, len) {
  if (!str || str.length <= len) return str || '';
  return str.substring(0, len).replace(/\s+\S*$/, '') + '...';
}

function mkdirSafe(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// --- Shared HTML partials ---

const GA_SNIPPET = `
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-LMZXHN7YGJ"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-LMZXHN7YGJ');</script>`;

function navHtml(depth) {
  // depth: 0 = /directory/, 1 = /directory/category/, /directory/products/
  const prefix = depth === 0 ? '../' : '../../';
  const dirPrefix = depth === 0 ? '' : '../';
  return `<nav class="nav">
  <div class="nav__inner">
    <a href="${prefix}index.html" class="nav__logo">
      <span class="nav__logo-main">SAIGUANG</span>
      <span class="nav__logo-sub">3D Technology</span>
    </a>
    <div class="nav__links">
      <div class="nav__dropdown">
        <a href="javascript:void(0)" class="nav__link">Services &#9662;</a>
        <div class="nav__dropdown-menu">
          <a href="${prefix}conformal-cooling-inserts.html" class="nav__dropdown-item">Conformal Cooling Inserts</a>
          <a href="${prefix}3d-printed-mold-inserts.html" class="nav__dropdown-item">3D Printed Mold Inserts</a>
          <a href="${prefix}metal-3d-printing-service.html" class="nav__dropdown-item">Metal 3D Printing Service</a>
          <a href="${prefix}rapid-tooling-service.html" class="nav__dropdown-item">Rapid Tooling Service</a>
        </div>
      </div>
      <a href="${prefix}case-studies.html" class="nav__link">Case Studies</a>
      <a href="${prefix}blog/" class="nav__link">Blog</a>
      <a href="${dirPrefix}index.html" class="nav__link active">Directory</a>
      <a href="${prefix}contact.html" class="nav__link">Contact</a>
    </div>
    <a href="https://wa.me/8618268661068" target="_blank" rel="noopener" class="btn btn-whatsapp nav__cta">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      WhatsApp Us
    </a>
    <button class="nav__mobile-toggle" aria-label="Menu">☰</button>
  </div>
</nav>`;
}

const FOOTER = `<footer class="footer">
  <div class="container">
    <div class="footer__grid">
      <div>
        <div class="footer__brand">SAIGUANG 3D</div>
        <p class="footer__text">Conformal cooling inserts & metal 3D printing from Ningbo, China. ISO-certified, shipped globally.</p>
      </div>
      <div>
        <div class="footer__heading">Services</div>
        <a href="/conformal-cooling-inserts.html" class="footer__link">Conformal Cooling Inserts</a>
        <a href="/metal-3d-printing-service.html" class="footer__link">Metal 3D Printing</a>
        <a href="/rapid-tooling-service.html" class="footer__link">Rapid Tooling</a>
      </div>
      <div>
        <div class="footer__heading">Resources</div>
        <a href="/blog/" class="footer__link">Blog</a>
        <a href="/case-studies.html" class="footer__link">Case Studies</a>
        <a href="/directory/" class="footer__link">3D Printing Directory</a>
      </div>
      <div>
        <div class="footer__heading">Contact</div>
        <a href="mailto:zhangyuanbo123@gmail.com" class="footer__link">zhangyuanbo123@gmail.com</a>
        <a href="https://wa.me/8618268661068" class="footer__link">WhatsApp: +86 182 6866 1068</a>
        <a href="/contact.html" class="footer__link">Contact Form</a>
      </div>
    </div>
    <div class="footer__bottom">&copy; 2026 Saiguang 3D Technology Co., Ltd. All rights reserved.</div>
  </div>
</footer>`;

const WA_FLOAT = `<a href="https://wa.me/8618268661068" target="_blank" rel="noopener" class="wa-float" aria-label="WhatsApp">
  <svg viewBox="0 0 24 24" width="28" height="28" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
</a>`;

const CTA_SIDEBAR = `<div class="card" style="position:sticky;top:88px;">
  <h3 style="color:var(--red);margin-top:0;">Need Metal 3D Printing or Conformal Cooling?</h3>
  <p style="color:#475569;font-size:.9rem;line-height:1.6;">MouldNova (Saiguang 3D) provides metal 3D printing, conformal cooling inserts, and rapid tooling &mdash; shipped globally from Ningbo, China.</p>
  <ul style="color:#475569;font-size:.9rem;line-height:1.8;padding-left:20px;">
    <li>3D-printed conformal cooling inserts</li>
    <li>Maraging steel, H13, stainless steel</li>
    <li>DFM report within 24 hours</li>
    <li>ISO 9001 certified factory</li>
  </ul>
  <a href="/contact.html" class="btn btn-primary" style="width:100%;text-align:center;margin-bottom:12px;">Get a Free Quote</a>
  <a href="https://wa.me/8618268661068" class="btn btn-whatsapp" style="width:100%;text-align:center;">WhatsApp Us</a>
</div>`;

// --- Page Generators ---

function generateCompanyPage(company, companyProducts, allCompanies) {
  const nameEn = escHtml(company.name_en);
  const nameZh = escHtml(company.name_zh);
  const desc = escHtml(company.description_en || company.description_zh || '');
  const descMeta = truncate(company.description_en || company.description_zh || `${company.name_en} is a 3D printing company exhibiting at TCT Asia 2026.`, 155);

  // Category chips
  const catChips = (company.categories_en || []).map(cat => {
    const catSlug = slugify(cat);
    return `<a href="category/${catSlug}.html" style="display:inline-block;background:#f1f5f9;color:#475569;padding:4px 12px;border-radius:16px;font-size:.8rem;text-decoration:none;margin:4px 4px 4px 0;">${escHtml(cat)}</a>`;
  }).join('');

  // Product cards
  let productsHtml = '';
  if (companyProducts.length > 0) {
    const productCards = companyProducts.map(p => {
      const imgTag = p.images && p.images[0]
        ? `<img src="${escHtml(p.images[0])}" alt="${escHtml(p.product_name_en)}" style="width:100%;height:180px;object-fit:contain;background:#f9fafb;border-radius:6px 6px 0 0;" loading="lazy">`
        : '';
      return `<a href="products/${p.slug}.html" class="card" style="text-decoration:none;padding:0;">
  ${imgTag}
  <div style="padding:16px;">
    <h3 style="font-size:.95rem;margin:0 0 6px;color:var(--black);">${escHtml(p.product_name_en)}</h3>
    <p style="font-size:.8rem;color:#94a3b8;margin:0;">${escHtml(p.product_name_zh)}</p>
    <p class="card__text" style="margin-top:8px;">${escHtml(truncate(p.description_en || p.description_zh, 100))}</p>
  </div>
</a>`;
    }).join('\n');

    productsHtml = `
    <h2 style="margin-top:48px;">Products</h2>
    <div class="grid-3">${productCards}</div>`;
  }

  // Related companies (share most categories, max 3)
  const companyCats = new Set(company.categories_en || []);
  const related = allCompanies
    .filter(c => c.slug !== company.slug)
    .map(c => ({
      ...c,
      overlap: (c.categories_en || []).filter(cat => companyCats.has(cat)).length,
    }))
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 3);

  const relatedHtml = related.map(c => `
    <a href="${c.slug}.html" class="card" style="text-decoration:none;">
      ${c.logo ? `<img src="${escHtml(c.logo)}" alt="${escHtml(c.name_en)}" style="height:48px;object-fit:contain;margin-bottom:12px;" loading="lazy">` : ''}
      <h3 style="font-size:.95rem;margin:0 0 4px;color:var(--black);">${escHtml(c.name_en)}</h3>
      <p style="font-size:.8rem;color:#94a3b8;margin:0 0 8px;">${escHtml(c.name_zh)}</p>
      <p class="card__text">${escHtml(truncate(c.description_en || c.description_zh, 80))}</p>
    </a>`).join('\n');

  // JSON-LD
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": company.name_en,
    "alternateName": company.name_zh,
    "url": company.website || `https://mouldnova.com/directory/${company.slug}.html`,
    "address": company.address_en ? {
      "@type": "PostalAddress",
      "addressCountry": company.address_zh?.startsWith('中国') ? 'CN' : '',
      "addressLocality": company.address_en,
    } : undefined,
    "knowsAbout": company.categories_en,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${nameEn} (${nameZh}) &mdash; 3D Printing Company | MouldNova Directory</title>
  <meta name="description" content="${escHtml(descMeta)}">
  <link rel="canonical" href="https://mouldnova.com/directory/${company.slug}.html">
  <meta property="og:title" content="${nameEn} &mdash; 3D Printing Company Profile">
  <meta property="og:description" content="${escHtml(descMeta)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://mouldnova.com/directory/${company.slug}.html">
  <link rel="stylesheet" href="../css/style.css">
  ${GA_SNIPPET}
  <script type="application/ld+json">${jsonLd}</script>
</head>
<body>
${navHtml(0)}

<section class="section" style="padding-top:40px;padding-bottom:20px;">
  <div class="container">
    <div class="breadcrumb">
      <a href="../index.html">Home</a> / <a href="index.html">Directory</a> / ${nameEn}
    </div>
  </div>
</section>

<section class="section" style="padding-top:0;">
  <div class="container" style="display:grid;grid-template-columns:1fr 340px;gap:48px;align-items:start;">

    <div>
      <div style="display:flex;align-items:center;gap:20px;margin-bottom:24px;">
        ${company.logo ? `<img src="${escHtml(company.logo)}" alt="${nameEn} logo" style="width:80px;height:80px;object-fit:contain;border-radius:8px;border:1px solid #e2e8f0;">` : ''}
        <div>
          <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;color:var(--red);letter-spacing:.05em;">TCT Asia 2026 Exhibitor &middot; Booth ${escHtml(company.booth)}</div>
          <h1 style="font-size:1.6rem;margin:4px 0 2px;">${nameEn}</h1>
          <p style="color:#94a3b8;margin:0;font-size:.9rem;">${nameZh}</p>
        </div>
      </div>

      <h2>Company Overview</h2>
      <p style="color:#475569;line-height:1.7;">${desc || 'Company information coming soon.'}</p>

      <h3 style="margin-top:32px;">Company Details</h3>
      <table class="data-table">
        <tr><td style="font-weight:700;width:35%;">Location</td><td>${escHtml(company.address_en || company.address_zh || '—')}</td></tr>
        <tr><td style="font-weight:700;">Booth (TCT Asia 2026)</td><td>${escHtml(company.booth || '—')}</td></tr>
        <tr><td style="font-weight:700;">Website</td><td>${company.website ? `<a href="${escHtml(company.website)}" target="_blank" rel="noopener">${escHtml(company.website)}</a>` : '—'}</td></tr>
      </table>

      <h3 style="margin-top:32px;">Categories</h3>
      <div>${catChips || '<p style="color:#94a3b8;">No categories listed.</p>'}</div>

      ${productsHtml}

      <h2 style="margin-top:48px;">Similar Companies</h2>
      <div class="grid-3">${relatedHtml}</div>
    </div>

    <div>
      ${CTA_SIDEBAR}
    </div>

  </div>
</section>

${FOOTER}
${WA_FLOAT}
<script src="../js/main.js"></script>
</body>
</html>`;
}

function generateProductPage(product, company) {
  const nameEn = escHtml(product.product_name_en);
  const nameZh = escHtml(product.product_name_zh);
  const desc = escHtml(product.description_en || product.description_zh || '');
  const descMeta = truncate(product.description_en || product.description_zh || `${product.product_name_en} by ${product.company_name}`, 155);
  const companyNameEn = company ? escHtml(company.name_en) : escHtml(product.company_name);

  const imgHtml = product.images && product.images[0]
    ? `<img src="${escHtml(product.images[0])}" alt="${nameEn}" style="width:100%;max-height:500px;object-fit:contain;background:#f9fafb;border-radius:8px;margin-bottom:24px;" loading="lazy">`
    : '';

  const catChips = (product.categories_en || []).map(cat =>
    `<a href="../category/${slugify(cat)}.html" style="display:inline-block;background:#f1f5f9;color:#475569;padding:4px 12px;border-radius:16px;font-size:.8rem;text-decoration:none;margin:4px 4px 4px 0;">${escHtml(cat)}</a>`
  ).join('');

  const appChips = (product.applications_en || []).map(app =>
    `<span style="display:inline-block;background:#fef2f2;color:var(--red);padding:4px 12px;border-radius:16px;font-size:.8rem;margin:4px 4px 4px 0;">${escHtml(app)}</span>`
  ).join('');

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.product_name_en,
    "description": product.description_en || product.description_zh,
    "image": product.images?.[0],
    "manufacturer": { "@type": "Organization", "name": company?.name_en || product.company_name },
    "category": product.categories_en?.[0],
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${nameEn} by ${companyNameEn} &mdash; 3D Printing Product | MouldNova Directory</title>
  <meta name="description" content="${escHtml(descMeta)}">
  <link rel="canonical" href="https://mouldnova.com/directory/products/${product.slug}.html">
  <meta property="og:title" content="${nameEn} &mdash; 3D Printing Product">
  <meta property="og:description" content="${escHtml(descMeta)}">
  ${product.images?.[0] ? `<meta property="og:image" content="${escHtml(product.images[0])}">` : ''}
  <meta property="og:type" content="product">
  <link rel="stylesheet" href="../../css/style.css">
  ${GA_SNIPPET}
  <script type="application/ld+json">${jsonLd}</script>
</head>
<body>
${navHtml(1)}

<section class="section" style="padding-top:40px;padding-bottom:20px;">
  <div class="container">
    <div class="breadcrumb">
      <a href="../../index.html">Home</a> / <a href="../index.html">Directory</a> / <a href="../${product.company_slug}.html">${companyNameEn}</a> / ${nameEn}
    </div>
  </div>
</section>

<section class="section" style="padding-top:0;">
  <div class="container" style="display:grid;grid-template-columns:1fr 340px;gap:48px;align-items:start;">

    <div>
      ${imgHtml}
      <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;color:var(--red);letter-spacing:.05em;margin-bottom:8px;">Product by ${companyNameEn}</div>
      <h1 style="font-size:1.5rem;margin:0 0 4px;">${nameEn}</h1>
      <p style="color:#94a3b8;margin:0 0 24px;font-size:.9rem;">${nameZh}</p>

      <h2>Description</h2>
      <p style="color:#475569;line-height:1.7;">${desc || 'Product information coming soon.'}</p>

      ${catChips ? `<h3 style="margin-top:32px;">Categories</h3><div>${catChips}</div>` : ''}
      ${appChips ? `<h3 style="margin-top:24px;">Applications</h3><div>${appChips}</div>` : ''}

      <div class="card" style="margin-top:32px;">
        <h3 style="margin-top:0;">About ${companyNameEn}</h3>
        ${company?.logo ? `<img src="${escHtml(company.logo)}" alt="${companyNameEn}" style="height:48px;object-fit:contain;margin-bottom:12px;" loading="lazy">` : ''}
        <p style="color:#475569;font-size:.9rem;">${escHtml(truncate(company?.description_en || company?.description_zh || '', 200))}</p>
        <a href="../${product.company_slug}.html" style="color:var(--red);font-weight:600;">View Company Profile &rarr;</a>
      </div>
    </div>

    <div>
      ${CTA_SIDEBAR}
    </div>

  </div>
</section>

${FOOTER}
${WA_FLOAT}
<script src="../../js/main.js"></script>
</body>
</html>`;
}

function generateDirectoryIndex(companies, categories) {
  const companyCards = companies.map(c => {
    const catSlugs = (c.categories_en || []).map(slugify).join(' ');
    const topCats = (c.categories_en || []).slice(0, 2).map(cat =>
      `<span style="display:inline-block;background:#f1f5f9;color:#475569;padding:2px 8px;border-radius:12px;font-size:.7rem;margin:2px 2px 0 0;">${escHtml(cat)}</span>`
    ).join('');

    return `<a href="${c.slug}.html" class="card dir-card" style="text-decoration:none;" data-cats="${escHtml(catSlugs)}" data-name="${escHtml((c.name_en + ' ' + c.name_zh).toLowerCase())}">
  ${c.logo ? `<img src="${escHtml(c.logo)}" alt="${escHtml(c.name_en)}" style="height:48px;object-fit:contain;margin-bottom:12px;" loading="lazy">` : ''}
  <h3 style="font-size:.95rem;margin:0 0 4px;color:var(--black);">${escHtml(c.name_en)}</h3>
  <p style="font-size:.8rem;color:#94a3b8;margin:0 0 8px;">${escHtml(c.name_zh)}</p>
  <p class="card__text">${escHtml(truncate(c.description_en || c.description_zh, 100))}</p>
  <div style="margin-top:auto;padding-top:8px;">${topCats}</div>
</a>`;
  }).join('\n');

  const catFilters = categories.slice(0, 15).map(cat =>
    `<button class="dir-filter-btn" data-cat="${escHtml(slugify(cat))}" style="display:inline-block;background:#f1f5f9;color:#475569;padding:6px 14px;border-radius:20px;font-size:.8rem;border:none;cursor:pointer;margin:4px;">${escHtml(cat)}</button>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>3D Printing Company Directory &mdash; ${companies.length}+ AM Companies | MouldNova</title>
  <meta name="description" content="Browse ${companies.length}+ 3D printing and additive manufacturing companies from TCT Asia 2026. Find metal 3D printers, materials, services, and post-processing suppliers.">
  <link rel="canonical" href="https://mouldnova.com/directory/">
  <link rel="stylesheet" href="../css/style.css">
  ${GA_SNIPPET}
  <style>
    .dir-filter-btn.active{background:var(--red)!important;color:#fff!important;}
    .dir-card.hidden{display:none;}
    #dir-search{width:100%;max-width:480px;padding:12px 16px;border:1px solid #e2e8f0;border-radius:8px;font-size:1rem;margin-bottom:16px;}
  </style>
</head>
<body>
${navHtml(0)}

<section class="section section--dark" style="padding:60px 0;">
  <div class="container" style="text-align:center;">
    <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;color:var(--red);letter-spacing:.1em;margin-bottom:12px;">TCT Asia 2026</div>
    <h1 style="font-size:2rem;color:#fff;margin:0 0 12px;">3D Printing Company Directory</h1>
    <p style="color:rgba(255,255,255,.7);font-size:1.05rem;max-width:600px;margin:0 auto;">Browse ${companies.length}+ additive manufacturing companies &mdash; equipment, materials, services, and software.</p>
  </div>
</section>

<section class="section">
  <div class="container">
    <input type="text" id="dir-search" placeholder="Search companies..." autocomplete="off">
    <div style="margin-bottom:24px;">
      <button class="dir-filter-btn active" data-cat="all" style="display:inline-block;background:var(--red);color:#fff;padding:6px 14px;border-radius:20px;font-size:.8rem;border:none;cursor:pointer;margin:4px;">All (${companies.length})</button>
      ${catFilters}
    </div>
    <div class="grid-3" id="dir-grid">
      ${companyCards}
    </div>
  </div>
</section>

${FOOTER}
${WA_FLOAT}
<script src="../js/main.js"></script>
<script>
(function(){
  var search=document.getElementById('dir-search');
  var cards=document.querySelectorAll('.dir-card');
  var btns=document.querySelectorAll('.dir-filter-btn');
  var activeCat='all';

  function filter(){
    var q=search.value.toLowerCase();
    cards.forEach(function(c){
      var matchCat=activeCat==='all'||c.dataset.cats.indexOf(activeCat)!==-1;
      var matchSearch=!q||c.dataset.name.indexOf(q)!==-1;
      c.classList.toggle('hidden',!(matchCat&&matchSearch));
    });
  }

  search.addEventListener('input',filter);
  btns.forEach(function(b){
    b.addEventListener('click',function(){
      btns.forEach(function(x){x.classList.remove('active');});
      b.classList.add('active');
      activeCat=b.dataset.cat;
      filter();
    });
  });
})();
</script>
</body>
</html>`;
}

function generateCategoryPage(catName, catSlug, companies, products) {
  const companyCards = companies.map(c => `
    <a href="../${c.slug}.html" class="card" style="text-decoration:none;">
      ${c.logo ? `<img src="${escHtml(c.logo)}" alt="${escHtml(c.name_en)}" style="height:40px;object-fit:contain;margin-bottom:8px;" loading="lazy">` : ''}
      <h3 style="font-size:.95rem;margin:0 0 4px;color:var(--black);">${escHtml(c.name_en)}</h3>
      <p style="font-size:.8rem;color:#94a3b8;margin:0 0 8px;">${escHtml(c.name_zh)}</p>
      <p class="card__text">${escHtml(truncate(c.description_en || c.description_zh, 80))}</p>
    </a>`).join('\n');

  const productCards = products.slice(0, 12).map(p => {
    const imgTag = p.images?.[0]
      ? `<img src="${escHtml(p.images[0])}" alt="${escHtml(p.product_name_en)}" style="width:100%;height:140px;object-fit:contain;background:#f9fafb;border-radius:6px 6px 0 0;" loading="lazy">`
      : '';
    return `<a href="../products/${p.slug}.html" class="card" style="text-decoration:none;padding:0;">
      ${imgTag}
      <div style="padding:12px;">
        <h3 style="font-size:.85rem;margin:0 0 4px;color:var(--black);">${escHtml(p.product_name_en)}</h3>
        <p style="font-size:.75rem;color:#94a3b8;margin:0;">${escHtml(p.company_name)}</p>
      </div>
    </a>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(catName)} Companies &mdash; 3D Printing Directory | MouldNova</title>
  <meta name="description" content="Find ${companies.length} ${catName.toLowerCase()} companies in our 3D printing directory. Browse manufacturers, service providers, and suppliers from TCT Asia 2026.">
  <link rel="canonical" href="https://mouldnova.com/directory/category/${catSlug}.html">
  <link rel="stylesheet" href="../../css/style.css">
  ${GA_SNIPPET}
</head>
<body>
${navHtml(1)}

<section class="section" style="padding-top:40px;padding-bottom:20px;">
  <div class="container">
    <div class="breadcrumb">
      <a href="../../index.html">Home</a> / <a href="../index.html">Directory</a> / ${escHtml(catName)}
    </div>
  </div>
</section>

<section class="section" style="padding-top:0;">
  <div class="container">
    <h1 style="font-size:1.6rem;margin-bottom:8px;">${escHtml(catName)}</h1>
    <p style="color:#475569;margin-bottom:32px;">${companies.length} companies in this category from TCT Asia 2026.</p>

    <h2>Companies</h2>
    <div class="grid-3">${companyCards}</div>

    ${productCards ? `<h2 style="margin-top:48px;">Featured Products</h2><div class="grid-4">${productCards}</div>` : ''}
  </div>
</section>

${FOOTER}
${WA_FLOAT}
<script src="../../js/main.js"></script>
</body>
</html>`;
}

// --- Sitemap Generator ---

function generateSitemap(companies, products, categories) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <url>
    <loc>https://mouldnova.com/directory/</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;

  for (const c of companies) {
    xml += `
  <url>
    <loc>https://mouldnova.com/directory/${c.slug}.html</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
`;
  }

  for (const p of products) {
    xml += `
  <url>
    <loc>https://mouldnova.com/directory/products/${p.slug}.html</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
  </url>
`;
  }

  for (const [catName, catSlug] of categories) {
    xml += `
  <url>
    <loc>https://mouldnova.com/directory/category/${catSlug}.html</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
`;
  }

  xml += `\n</urlset>`;
  return xml;
}

// --- Main ---

function main() {
  console.log('\n=== TCT Directory Page Generator ===\n');

  // Load data
  if (!fs.existsSync(COMPANIES_FILE)) {
    console.error(`Error: ${COMPANIES_FILE} not found. Run translate.js first.`);
    process.exit(1);
  }

  const companies = JSON.parse(fs.readFileSync(COMPANIES_FILE, 'utf-8'));
  console.log(`Loaded ${companies.length} companies.`);

  let products = [];
  if (fs.existsSync(PRODUCTS_FILE)) {
    products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf-8'));
    console.log(`Loaded ${products.length} products.`);
  }

  // Build lookup maps
  const companyMap = new Map();
  companies.forEach(c => companyMap.set(c.slug, c));

  const productsByCompany = new Map();
  products.forEach(p => {
    if (!productsByCompany.has(p.company_slug)) productsByCompany.set(p.company_slug, []);
    productsByCompany.get(p.company_slug).push(p);
  });

  // Collect all categories
  const catCount = new Map();
  companies.forEach(c => {
    (c.categories_en || []).forEach(cat => {
      catCount.set(cat, (catCount.get(cat) || 0) + 1);
    });
  });
  const sortedCategories = [...catCount.entries()].sort((a, b) => b[1] - a[1]);
  const categoryNames = sortedCategories.map(([name]) => name);

  // Create output directories
  mkdirSafe(path.join(OUT_DIR));
  mkdirSafe(path.join(OUT_DIR, 'products'));
  mkdirSafe(path.join(OUT_DIR, 'category'));

  // Generate company pages
  console.log('\nGenerating company pages...');
  for (const company of companies) {
    const compProducts = productsByCompany.get(company.slug) || [];
    const html = generateCompanyPage(company, compProducts, companies);
    fs.writeFileSync(path.join(OUT_DIR, `${company.slug}.html`), html, 'utf-8');
  }
  console.log(`  ${companies.length} company pages generated.`);

  // Generate product pages
  if (products.length > 0) {
    console.log('Generating product pages...');
    for (const product of products) {
      const company = companyMap.get(product.company_slug);
      const html = generateProductPage(product, company);
      fs.writeFileSync(path.join(OUT_DIR, 'products', `${product.slug}.html`), html, 'utf-8');
    }
    console.log(`  ${products.length} product pages generated.`);
  }

  // Generate category pages
  console.log('Generating category pages...');
  const catEntries = [];
  for (const catName of categoryNames) {
    const catSlug = slugify(catName);
    const catCompanies = companies.filter(c => (c.categories_en || []).includes(catName));
    const catProducts = products.filter(p => (p.categories_en || []).includes(catName));
    const html = generateCategoryPage(catName, catSlug, catCompanies, catProducts);
    fs.writeFileSync(path.join(OUT_DIR, 'category', `${catSlug}.html`), html, 'utf-8');
    catEntries.push([catName, catSlug]);
  }
  console.log(`  ${catEntries.length} category pages generated.`);

  // Generate directory index
  console.log('Generating directory index...');
  const indexHtml = generateDirectoryIndex(companies, categoryNames);
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), indexHtml, 'utf-8');

  // Generate sitemap
  console.log('Generating sitemap...');
  const sitemapXml = generateSitemap(companies, products, catEntries);
  fs.writeFileSync(path.join(OUT_DIR, 'sitemap-directory.xml'), sitemapXml, 'utf-8');

  const totalPages = companies.length + products.length + catEntries.length + 1;
  console.log(`\n=== Done ===`);
  console.log(`Total pages generated: ${totalPages}`);
  console.log(`Output: ${OUT_DIR}/`);
  console.log(`Sitemap: ${OUT_DIR}/sitemap-directory.xml\n`);
}

main();
