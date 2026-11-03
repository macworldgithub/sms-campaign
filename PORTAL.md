# Booran Loyalty Studio

Next.js operator portal for South Morang Hyundai, using the supplied `#e22837` and white theme.

Run `npm run dev` and open http://localhost:3000. The backend is expected at http://127.0.0.1:4000. Read `PORTAL_PASSWORD` from the ignored `.env.local` to sign in. See [backend operations guide](../sms-campaign-backend/PORTAL.md) for setup, environment configuration, integrations, webhook contracts and remaining go-live requirements.

The portal includes Overview, Campaigns, Audience (CSV/XLSX), Leads, Suppression, Reports and Integrations. Data is loaded through authenticated server routes. Run `npm run dev:public` for the separate public landing service at http://localhost:3001/loyalty. It preserves the supplied experience and connects registrations to immediate suppression. Its operator API is disabled. Production builds use `npm run build` and `npm run build:public`, with separate hostnames for the two services.
