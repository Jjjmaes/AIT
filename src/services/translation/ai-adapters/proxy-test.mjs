import { fetch } from 'undici'; // Use undici's fetch directly
import { ProxyAgent } from 'proxy-agent';

const TEST_URL = 'https://www.google.com'; // Or 'https://api.x.ai/v1/chat/completions' if you want to test Grok directly (needs API key header)
const TIMEOUT_MS = 15000; // 15 seconds

async function testProxy() {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  console.log(`Using Proxy URL: ${proxyUrl || 'None detected'}`);

  if (!proxyUrl) {
    console.error('Error: No HTTP_PROXY or HTTPS_PROXY environment variable set.');
    return;
  }

  const agent = new ProxyAgent(); // Should pick up env vars automatically
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error(`Request timed out after ${TIMEOUT_MS}ms`);
    controller.abort();
  }, TIMEOUT_MS);

  console.log(`Attempting to fetch ${TEST_URL} via proxy ${proxyUrl}...`);

  try {
    const response = await fetch(TEST_URL, {
      agent: agent,
      signal: controller.signal,
      headers: { 'User-Agent': 'NodeJS-Proxy-Test' } // Simple header for Google test
      // If testing Grok, add: 'Authorization': `Bearer YOUR_GROK_API_KEY`
    });
    clearTimeout(timeoutId);
    console.log(`Fetch successful! Status: ${response.status} ${response.statusText}`);
    // Optionally try to read body
    // const body = await response.text();
    // console.log(`Response body (first 100 chars): ${body.substring(0, 100)}...`);
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Fetch failed:');
    console.error(error);
    if (error.cause) {
       console.error('Cause:', error.cause);
    }
  }
}

testProxy();