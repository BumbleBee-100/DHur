export default {
  async fetch(request) {
    const url = new URL(request.url);
    let targetUrl = url.searchParams.get('url');

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    if (!targetUrl) {
      return new Response('Cloudflare Proxy Active.', {
        headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Auto-fix URL protocol if missing
    targetUrl = targetUrl.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    try {
      const fetchOptions = {
        method: request.method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow'
      };

      // Forward request body for POST/PUT method
      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        fetchOptions.body = await request.arrayBuffer();
      }

      const response = await fetch(targetUrl, fetchOptions);

      const newHeaders = new Headers(response.headers);

      // FIX 1: Delete compression & length headers to prevent browser decoding errors
      newHeaders.delete('content-encoding');
      newHeaders.delete('content-length');

      // FIX 2: Delete security restrictions to allow embedding/rendering
      newHeaders.delete('content-security-policy');
      newHeaders.delete('content-security-policy-report-only');
      newHeaders.delete('x-frame-options');

      // FIX 3: Enable CORS
      newHeaders.set('Access-Control-Allow-Origin', '*');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    } catch (err) {
      return new Response('Proxy Error: ' + err.message, {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};
