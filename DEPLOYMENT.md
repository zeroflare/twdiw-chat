# Deployment Guide for twdiw-chat

## Overview
This project is a Cloudflare Workers application for daily-match-chat feature with VC verification.

## Prerequisites
- Node.js 18+ and npm
- Cloudflare account with Workers access
- Wrangler CLI: `npm install -g wrangler`

## Configuration

### 1. Environment Variables
Edit `wrangler.jsonc` and update the following:

```jsonc
{
  "vars": {
    "SANDBOX_BASE_URL": "https://your-sandbox-url.com",
    "SANDBOX_TOKEN": "your-actual-sandbox-token"
  }
}
```

### 2. Project Structure
```
twdiw-chat/
├── src/
│   └── index.js          # Cloudflare Worker with API handlers
├── public/               # Static assets (served automatically)
│   ├── index.html        # Main application UI
│   ├── app.js            # Client-side logic
│   └── vc-integration-demo.html  # VC integration demo
├── wrangler.jsonc        # Cloudflare Workers configuration
└── DEPLOYMENT.md         # This file
```

## Deployment Steps

### Local Development
```bash
# Install dependencies (if needed)
npm install

# Start local development server
npx wrangler dev

# Access at http://localhost:8787
```

### Deploy to Cloudflare Workers
```bash
# Login to Cloudflare
npx wrangler login

# Deploy to production
npx wrangler deploy

# Your worker will be available at:
# https://twdiw-chat.<your-subdomain>.workers.dev
```

## API Endpoints

### POST /api/verify-vc
Initiates VC verification with sandbox.

**Request:**
```json
{
  "ref": "0052696330_vc_asset_player_rank_certificate",
  "transactionId": "unique-transaction-id"
}
```

**Response:**
```json
{
  "qrcodeImage": "data:image/png;base64,...",
  "transactionId": "unique-transaction-id"
}
```

### GET /api/verify-result/:transactionId
Queries verification result.

**Response (Pending):**
```json
{
  "status": "pending",
  "message": "Verification in progress"
}
```

**Response (Success):**
```json
{
  "verifyResult": true,
  "data": [...],
  "transactionId": "unique-transaction-id"
}
```

## Testing

### Acceptance Test
1. Open the deployed URL in a browser
2. Select a disclosure level (Basic or higher)
3. QR code should appear
4. Scan with MODA digital wallet
5. Verify credential in wallet
6. Status should change to "✅ 驗證成功！"
7. "下一步" button should be enabled

### Manual Testing Checklist
- [ ] Static assets load correctly
- [ ] VC verification initiates successfully
- [ ] QR code displays properly
- [ ] Polling detects verification completion
- [ ] Navigation flow works (4 steps)
- [ ] tlk.io chat integration functions
- [ ] CORS headers allow cross-origin requests

## Troubleshooting

### Backend API not available
- Ensure wrangler.jsonc has correct environment variables
- Check Cloudflare Workers deployment status
- Verify sandbox API credentials

### QR code not displaying
- Check browser console for errors
- Verify SANDBOX_BASE_URL is accessible
- Check SANDBOX_TOKEN is valid

### Polling timeout
- Default polling interval: 3 seconds
- Verification typically completes within 30-60 seconds
- Check network connectivity

## Rollback Plan
If deployment fails or causes issues:

```bash
# Rollback to previous version
npx wrangler rollback

# Or delete deployment
npx wrangler delete twdiw-chat
```

## Monitoring
- Check logs: `npx wrangler tail`
- View metrics in Cloudflare Dashboard
- Monitor API error rates

## Support
For issues, check:
1. Cloudflare Workers documentation
2. Wrangler CLI documentation
3. Project repository issues
