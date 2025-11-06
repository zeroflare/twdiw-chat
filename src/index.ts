import { Hono } from 'hono'
import { v4 as uuidv4 } from 'uuid';

// Define bindings from wrangler.toml
export type Bindings = {
  DB: D1Database;
  TWDIW_API_URL: string;
  TWDIW_API_TOKEN: string;
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => {
  return c.text('Hello from Hono on Cloudflare Workers!')
})

// 1. Endpoint to initiate the verification process
app.post('/verify/initiate', async (c) => {
  try {
    const transactionId = uuidv4();
    const apiUrl = c.env.TWDIW_API_URL;
    const apiToken = c.env.TWDIW_API_TOKEN;

    const ref = "27950876_vp_swaggerui_test_2"; // Placeholder

    const fullUrl = `${apiUrl}/api/oidvp/qrcode?ref=${ref}&transactionId=${transactionId}`;

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Access-Token': apiToken,
      },
    });

    if (!response.ok) {
      console.error('Failed to call TWDIW API', await response.text());
      return c.json({ error: 'Failed to initiate verification' }, { status: 500 });
    }

    const data = await response.json() as { authUri: string, qrcodeImage: string, transactionId: string };

    return c.json({ 
      transactionId: data.transactionId, 
      authUri: data.authUri 
    });

  } catch (error) {
    console.error('Error initiating verification:', error);
    return c.json({ error: 'An internal error occurred' }, { status: 500 });
  }
});

// 2. Endpoint for the frontend to poll for the verification result
app.get('/verify/status/:transactionId', async (c) => {
  const { transactionId } = c.req.param();
  const apiUrl = c.env.TWDIW_API_URL;
  const apiToken = c.env.TWDIW_API_TOKEN;

  try {
    const response = await fetch(`${apiUrl}/api/oidvp/result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': apiToken,
      },
      body: JSON.stringify({ transactionId }),
    });

    if (response.status === 200) {
      const data = await response.json();
      return c.json({ status: 'success', data });
    }

    if (response.status === 400) {
      return c.json({ status: 'pending' });
    }

    console.error('Failed to poll TWDIW result API', await response.text());
    return c.json({ error: 'Failed to get verification status' }, { status: response.status });

  } catch (error) {
    console.error('Error polling for status:', error);
    return c.json({ error: 'An internal error occurred' }, { status: 500 });
  }
});


export default app
