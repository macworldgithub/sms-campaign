# Booran Loyalty Studio

Next.js operator portal for South Morang Hyundai, using the supplied `#e22837` and white theme.

Run `npm run dev` and open http://localhost:3000. The backend is expected at http://127.0.0.1:4000. Read `PORTAL_PASSWORD` from the ignored `.env.local` to sign in. See [backend operations guide](../sms-campaign-backend/PORTAL.md) for setup, environment configuration, integrations, webhook contracts and remaining go-live requirements.

The portal includes Overview, Campaigns, Audience (CSV/XLSX), Leads, Suppression, Reports and Integrations. Data is loaded through authenticated server routes. Run `npm run dev:public` for the separate public landing service at http://localhost:3001/loyalty. It preserves the supplied experience and connects registrations to immediate suppression. Its operator API is disabled. Production builds use `npm run build` and `npm run build:public`, with separate hostnames for the two services.

## Client-approved one-way campaign

The portal follows: consented audience -> one-way SMS -> tracked loyalty page -> enquiry form -> DealerSocket and GoodShowroom Sales Floor -> suppression and CRM follow-up. Replies are not enquiries. Integrations shows outbound delivery history, and Leads shows independent delivery states for each CRM. GoodShowroom enquiries remain queued with the agreed placeholder until API access is supplied. Web unsubscribe lives at /unsubscribe/<message-token> on the public instance (GET confirms only, POST opts out). A public HTTPS base URL is required for sending and one-way connection tests.
