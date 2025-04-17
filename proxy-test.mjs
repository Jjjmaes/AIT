import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent'; // Note: Use HttpsProxyAgent

const TEST_URL = 'https://www.google.com';
const TIMEOUT_MS = 15000; // 15 seconds

async function testProxy() {
  // Axios typically uses HTTPS_PROXY for https URLs
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
  console.log(`Using HTTPS_PROXY URL: ${proxyUrl || 'None detected'}`);

  if (!proxyUrl) {
    console.error('Error: No HTTPS_PROXY environment variable set.');
    return;
  }

  // Ensure the proxy URL starts with http:// for HttpsProxyAgent
  if (!proxyUrl.startsWith('http://')) {
     console.error(`Error: https-proxy-agent requires an http:// proxy URL, but got: ${proxyUrl}`);
     return;
  }

  const httpsAgent = new HttpsProxyAgent(proxyUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
     console.error(`Request timed out after ${TIMEOUT_MS}ms`);
     controller.abort();
   }, TIMEOUT_MS);


  console.log(`Attempting to fetch ${TEST_URL} via proxy ${proxyUrl} using axios...`);

  try {
    const response = await axios.get(TEST_URL, {
      httpsAgent: httpsAgent, // Use httpsAgent for HTTPS requests via HTTP proxy
      proxy: false, // Important: Disable axios's default proxy handling
      signal: controller.signal,
      timeout: TIMEOUT_MS, // Axios has its own timeout parameter
      headers: { 'User-Agent': 'NodeJS-Axios-Proxy-Test' }
    });
    clearTimeout(timeoutId); // Clear our manual timeout if axios completes
    console.log(`Axios fetch successful! Status: ${response.status} ${response.statusText}`);
    // console.log(`Response headers:`, response.headers);
  } catch (error) {
    clearTimeout(timeoutId); // Clear timeout on error too
    console.error('Axios fetch failed:');
    if (axios.isAxiosError(error)) {
        console.error(`  Error Code: ${error.code}`);
        console.error(`  Message: ${error.message}`);
        if (error.response) {
            console.error(`  Response Status: ${error.response.status}`);
            // console.error(`  Response Data:`, error.response.data);
        }
    } else {
        console.error(error); // Log non-axios errors
    }
    // Log the cause if available
    if (error.cause) {
         console.error('Cause:', error.cause);
    }
  }
}

testProxy();