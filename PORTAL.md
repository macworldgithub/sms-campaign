# Booran Loyalty Studio

Next.js operator portal for South Morang Hyundai, using the supplied `#e22837` and white theme.

Run `npm run dev` and open http://localhost:3000. The backend is expected at http://127.0.0.1:4000. Sign in with your individual staff username and password. The first administrator is created from the backend bootstrap environment only once. See [backend operations guide](../sms-campaign-backend/PORTAL.md) for setup, environment configuration, integrations, webhook contracts and remaining go-live requirements.

The portal includes Overview, Campaigns, Audience (CSV/XLSX), Leads, Suppression, Reports and Integrations. Data is loaded through authenticated server routes. The same page at `/` on port 3000 switches between Customer loyalty and Staff / Admin. Run only `npm run dev`; no second frontend service or APP_ROLE is needed.

## Client-approved one-way campaign

The Leads page has two distinct sections: DealerSocket opportunities from the saved South Morang Hyundai snapshot (searchable and paginated), and campaign landing-page enquiries with independent CRM delivery states. The CRM section shows its capture time, worker health and exact queue coverage. Refresh requests use the existing authenticated Chrome worker. Missing detail fields are explicitly labelled; this snapshot is not the dealership's full historical customer export and never imports recipients into the consented SMS audience.

The portal follows: consented audience -> one-way SMS -> tracked loyalty page -> enquiry form -> DealerSocket and GoodShowroom Sales Floor -> suppression and CRM follow-up. Replies are not enquiries. Integrations shows outbound delivery history, and Leads shows independent delivery states for each CRM. GoodShowroom enquiries remain queued with the agreed placeholder until API access is supplied. Web unsubscribe lives at /unsubscribe/<message-token> on the public instance (GET confirms only, POST opts out). A public HTTPS base URL is required for sending and one-way connection tests.


## Individual staff access and operations

Sign in with a username and password. First administrator: `PORTAL_BOOTSTRAP_USERNAME` (default `admin`) and `PORTAL_BOOTSTRAP_PASSWORD` in the backend environment. The old frontend `PORTAL_PASSWORD` is no longer used. Staff access and sessions are stored in MongoDB; temporary passwords must be changed at first login. Admins activate the five supplied disabled staff records in Staff and assign permissions. Those names are not a customer audience.

Settings holds approved offer details, eligibility and Melbourne expiry. Operations provides durable campaign progress, pause/resume, uncertain-send provider lookup and evidence-based CRM reconciliation. Browser closure does not cancel a queued campaign; the backend worker continues. No unknown SMS is automatically resent. The public offer page remains paused until an approved future-dated offer exists. GoodShowroom continues to show “It will be integrated soon” while its enquiries remain queued.


## Unified portal and access rules (6 November 2026)

- `http://localhost:3000/`: individual staff sign-in and role-controlled workspace.
- Customer loyalty toggle on `http://localhost:3000/`: public offer and enquiry form; no staff account required. Old `/loyalty` links redirect to this view.
- `/r/<token>`: tracked campaign redirect; `/unsubscribe/<token>`: public unsubscribe confirmation. `/experience` redirects to the root customer view for old links.
- Staff session cookies and the customer form session are separate. A public session cannot authenticate operator APIs. The backend validates all staff roles, including when requests bypass the UI. Unknown staff operations are denied by default.
- Admin: accounts, settings, routing, campaigns and recovery. Campaign manager: audiences, campaigns, CRM matching/recovery; may read offer settings but not change them or staff access. Viewer: read-only operational data. Every staff member can change their own password under My account; changing it signs out all sessions.
- New passwords require 12–256 characters. Bootstrap creates an administrator only if no accounts exist; it never restores an older password. Existing account passwords are retained during this update.
- The customer page is maintained in this repository. It renders the configured offer/eligibility/expiry directly, checks eligibility and enquiry response permission, and uses the existing idempotent capture/suppression/outbox flow. No external Manus scripts execute beside staff sessions. Legacy remote asset/config proxy routes return 410.
- Set the backend `PUBLIC_PORTAL_URL` to the origin, without `/loyalty`: locally `http://localhost:3000`, and a public HTTPS origin before any live campaign. Sending remains disabled for localhost. No separate port 3001, public build, or cross-origin cookie setup is needed. Old `*:public` scripts are compatibility aliases for the same app.
- `npm run build` builds all routes. `npm run test:unified` starts the built app against an isolated local stub and checks staff/public isolation, origin protection, consent, offer expiry gate and enquiry attribution without using real customers, MongoDB, SMS or CRM services.


## Main-page view toggle (6 November 2026)

Open `http://localhost:3000`. The header switches between Customer loyalty and Staff / Admin without navigating to another page. Staff accounts still require authentication; the toggle never grants a role. Views stay mounted after first opening so switching does not discard an enquiry or campaign draft.

Campaign invitations now redirect to `/?view=customer&ref=...` with UTM attribution. Old `/loyalty` and `/experience` links redirect to this main-page view. The customer view remains inactive until approved terms and a future expiry are configured.

The Tailwind loader applies only to globals.css; CSS modules use Next's normal processing. The staff sidebar is sized below the toggle header, with independently scrolling navigation and an accessible sign-out footer.
