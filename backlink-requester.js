// backlink-requester.js
import { setTimeout as sleep } from 'timers/promises';

// ===== CONFIGURATION =====
const JSON_URL = 'https://raw.githubusercontent.com/faysaldon121-beep/Backlinker/master/urlbacklinks.json';
const YOUR_SITE = 'gameslib.vercel.app';          // without protocol
const YOUR_SITE_FULL = 'https://' + YOUR_SITE;

// Request settings
const REQUEST_METHOD = 'GET';        // 'GET' or 'POST'
const DELAY_MS = 1000;               // 1 second between requests
const TIMEOUT_MS = 10000;            // 10s timeout per request
const USER_AGENT = 'BacklinkGenerator/1.0';

// ===== TRANSFORM URL: replace path with YOUR_SITE =====
function transformUrl(originalUrl) {
  try {
    const urlObj = new URL(originalUrl);
    // Replace the entire pathname with your site (remove any existing path)
    urlObj.pathname = YOUR_SITE;
    // Also remove any query or hash to keep it clean
    urlObj.search = '';
    urlObj.hash = '';
    return urlObj.toString();
  } catch (e) {
    console.error(`Invalid URL: ${originalUrl}`);
    return null;
  }
}

// ===== FETCH TARGET URLS FROM JSON =====
async function fetchTargetUrls() {
  const response = await fetch(JSON_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('JSON is not an array');

  const urls = [];
  for (const item of data) {
    if (typeof item === 'string' && item.startsWith('http')) {
      urls.push(item);
    } else if (typeof item === 'object' && item !== null) {
      const url = item.url || item.link;
      if (url && typeof url === 'string' && url.startsWith('http')) urls.push(url);
    }
  }
  if (urls.length === 0) throw new Error('No valid URLs found');
  return urls;
}

// ===== SEND REQUEST TO THE TRANSFORMED URL =====
async function sendRequest(originalUrl) {
  const targetUrl = transformUrl(originalUrl);
  if (!targetUrl) return { success: false, status: 'invalid URL', url: originalUrl };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let response;
    if (REQUEST_METHOD === 'GET') {
      // Optionally add a query parameter with your full site (many ping services expect this)
      const urlWithParam = new URL(targetUrl);
      urlWithParam.searchParams.set('url', YOUR_SITE_FULL);
      response = await fetch(urlWithParam.toString(), {
        method: 'GET',
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal,
      });
    } else if (REQUEST_METHOD === 'POST') {
      response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: YOUR_SITE_FULL }),
        signal: controller.signal,
      });
    }
    return { success: response.ok, status: response.status, originalUrl, transformedUrl: targetUrl };
  } catch (error) {
    if (error.name === 'AbortError') return { success: false, status: 'timeout', originalUrl, transformedUrl: targetUrl };
    return { success: false, status: error.message, originalUrl, transformedUrl: targetUrl };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ===== MAIN LOOP =====
async function main() {
  console.log(`Fetching target URLs from ${JSON_URL}...`);
  const originalUrls = await fetchTargetUrls();
  console.log(`Found ${originalUrls.length} URLs.`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < originalUrls.length; i++) {
    const original = originalUrls[i];
    const result = await sendRequest(original);
    process.stdout.write(`[${i+1}/${originalUrls.length}] ${original} → ${result.transformedUrl} ... `);
    if (result.success) {
      console.log(`✅ HTTP ${result.status}`);
      successCount++;
    } else {
      console.log(`❌ ${result.status}`);
      failCount++;
    }
    if (i < originalUrls.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n✅ Success: ${successCount} | ❌ Failed: ${failCount}`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
