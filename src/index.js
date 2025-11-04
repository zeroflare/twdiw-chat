// Cloudflare Worker for daily-match-chat MVP
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle API routes
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env);
    }
    
    // Serve static assets (handled by Cloudflare automatically)
    return new Response('Not Found', { status: 404 });
  }
};

async function handleAPI(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    if (path === '/api/verify-vc' && request.method === 'POST') {
      return await handleVerifyVC(request, env, corsHeaders);
    }
    
    if (path.startsWith('/api/verify-result/') && request.method === 'GET') {
      const transactionId = path.split('/').pop();
      return await handleVerifyResult(transactionId, env, corsHeaders);
    }
    
    return new Response('API endpoint not found', { 
      status: 404, 
      headers: corsHeaders 
    });
    
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleVerifyVC(request, env, corsHeaders) {
  const { ref, transactionId } = await request.json();
  
  const response = await fetch(`${env.SANDBOX_BASE_URL}/api/oidvp/qrcode?ref=${ref}&transactionId=${transactionId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${env.SANDBOX_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    return new Response(JSON.stringify({ 
      error: 'Sandbox API error', 
      details: error 
    }), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  const data = await response.json();
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleVerifyResult(transactionId, env, corsHeaders) {
  const response = await fetch(`${env.SANDBOX_BASE_URL}/api/oidvp/result`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.SANDBOX_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ transactionId })
  });
  
  if (!response.ok) {
    return new Response(JSON.stringify({ 
      status: 'pending',
      message: 'Verification in progress' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  const data = await response.json();
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
