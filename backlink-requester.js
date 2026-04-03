// backlink-requester.js
import { setTimeout as sleep } from 'timers/promises';

// ===== CONFIGURATION =====
const JSON_URL = 'https://raw.githubusercontent.com/faysaldon121-beep/Backlinker/master/urlbacklinks.json';
const YOUR_SITE = 'https://gameslib.vercel.app';

// Request settings
const REQUEST_METHOD = 'GET';        // 'GET' or 'POST'
const DELAY_MS = 1000;               // Wait 1 second between requests
const TIMEOUT_MS = 10000;            // 10s timeout per request
const USER_AGENT = 'BacklinkGenerator/1.0';

// For POST requests
const POST_DATA = { url: YOUR_SITE, source: 'backlink_generator' };

// ===== CORE FUNCTIONS =====
async function fetchTargetUrls() {
  const response = await fetch(JSON_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('JSON is not an array');

  const urls = [];
  for (const item of data) {
    if (typeof item === 'string' && item.startsWith('http')) urls.push(item);
    else if (typeof item === 'object' && item !== null) {
      const url = item.url || item.link;
      if (url && typeof url === 'string' && url.startsWith('http')) urls.push(url);
    }
  }
  if (urls.length === 0) throw new Error('No valid URLs found');
  return urls;
}

async function sendRequest(targetUrl) {
  // Use AbortSignal.timeout for a cleaner timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let response;
    if (REQUEST_METHOD === 'GET') {
      const urlWithParam = new URL(targetUrl);
      urlWithParam.searchParams.set('url', YOUR_SITE);
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
        body: JSON.stringify(POST_DATA),
        signal: controller.signal,
      });
    } else {
      throw new Error(`Unsupported method: ${REQUEST_METHOD}`);
    }

    return { success: response.ok, status: response.status, url: targetUrl };
  } catch (error) {
    if (error.name === 'AbortError') return { success: false, status: 'timeout', url: targetUrl };
    return { success: false, status: error.message, url: targetUrl };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function main() {
  console.log(`Fetching target URLs from ${JSON_URL}...`);
  const targets = await fetchTargetUrls();
  console.log(`Found ${targets.length} URLs. Sending ${REQUEST_METHOD} requests...\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < targets.length; i++) {
    const url = targets[i];
    process.stdout.write(`[${i+1}/${targets.length}] ${url} ... `);
    const result = await sendRequest(url);
    if (result.success) {
      console.log(`✅ HTTP ${result.status}`);
      successCount++;
    } else {
      console.log(`❌ ${result.status}`);
      failCount++;
    }
    // Wait between requests – using the renamed 'sleep' function
    if (i < targets.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\nDone. Success: ${successCount}, Failed: ${failCount}`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
