export interface ScopeTemplate {
  id: string;
  name: string;
  badge: string;
  recommended?: boolean;
  approxChars: string;
  description: string;
  body: string;
}

export const SCOPE_TEMPLATES: ScopeTemplate[] = [
  {
    id: "template-1",
    name: "Template 1 – Direct Loyalty Offer",
    badge: "Recommended Default",
    recommended: true,
    approxChars: "~148 chars",
    description: "Clear value + action. High conversion default for broad consented audience.",
    body: "BooranSMH: Exclusive loyalty offer for valued customers. Claim your reward today: {link} {optout}",
  },
  {
    id: "template-2",
    name: "Template 2 – Personalised Welcome-Back",
    badge: "Personalised",
    approxChars: "~165 chars",
    description: "Higher engagement when customer first name is available in the target list.",
    body: "Hi {firstName}, Booran South Morang Hyundai has a special loyalty reward waiting for you. View & claim: {link} {optout}",
  },
  {
    id: "template-3",
    name: "Template 3 – Ownership / Service Reminder",
    badge: "Relationship",
    approxChars: "~168 chars",
    description: "Reinforces existing dealership relationship; supports inferred consent where applicable.",
    body: "BooranSMH: As a valued Hyundai owner at South Morang, unlock your exclusive loyalty benefit. Tap to claim: {link} {optout}",
  },
  {
    id: "template-4",
    name: "Template 4 – Short & High-Urgency",
    badge: "Cost Saver (1-Segment)",
    approxChars: "~118 chars",
    description: "Ideal for guaranteed single-segment delivery, maximum reliability, and lowest telco cost.",
    body: "BooranSMH loyalty reward is ready. Claim yours now: {link} {optout}",
  },
  {
    id: "template-5",
    name: "Template 5 – Offer-Focused with Soft CTA",
    badge: "Informational",
    approxChars: "~172 chars",
    description: "Positions page as an information + registration step rather than a hard sell.",
    body: "Booran South Morang Hyundai: Your loyalty offer is live. See details and register your interest: {link} {optout}",
  },
  {
    id: "template-6",
    name: "Template 6 – Value + Time-Sensitive",
    badge: "Urgency",
    approxChars: "~158 chars",
    description: "Adds gentle urgency without pushy language to motivate prompt engagement.",
    body: "BooranSMH: Limited-time loyalty reward for past customers. Don’t miss out – claim here: {link} {optout}",
  },
  {
    id: "template-7",
    name: "Template 7 – Clean Professional",
    badge: "Executive",
    approxChars: "~155 chars",
    description: "Formal, brand-aligned phrasing suitable for VIP and corporate owners.",
    body: "Booran South Morang Hyundai loyalty programme: Exclusive offer available. Access yours: {link} {optout}",
  },
];

export interface DeliveryMilestone {
  step: number;
  dates: string;
  title: string;
  owner: string;
  status: "completed" | "in_progress" | "upcoming";
  details: string;
}

export const DELIVERY_MILESTONES: DeliveryMilestone[] = [
  {
    step: 1,
    dates: "31 Oct – 3 Nov",
    title: "Scope & Copy Approval",
    owner: "Client + OmniSuiteAI",
    status: "completed",
    details: "Scope confirmation, consented target list receipt, SMS copy sign-off, and Sender ID verification.",
  },
  {
    step: 2,
    dates: "4 – 6 Nov",
    title: "Subdomain & CRM Mapping",
    owner: "OmniSuiteAI",
    status: "in_progress",
    details: "loyalty.smh.goodshowroom.com provision, sending platform frequency configuration, and DealerSocket + GoodShowroom routing.",
  },
  {
    step: 3,
    dates: "7 – 8 Nov",
    title: "End-to-End Simulation",
    owner: "OmniSuiteAI + Client",
    status: "upcoming",
    details: "Verified SMS dispatch test, shortlink attribution, landing form enquiry capture, and immediate opt-out suppression.",
  },
  {
    step: 4,
    dates: "9 Nov 2026",
    title: "Go-Live First Send",
    owner: "OmniSuiteAI",
    status: "upcoming",
    details: "First compliant outbound broadcast to eligible audience with real-time manager routing in both CRMs.",
  },
];

export function calculateSmsTelemetry(
  template: string,
  sampleName = "Alex",
  subdomain = "loyalty.smh.goodshowroom.com"
) {
  // Approximate realistic link and opt-out lengths
  const sampleLink = `https://${subdomain}/r/c8f2a1b9`;
  const sampleOptOut = `Opt out: https://${subdomain}/u/c8f2a1b9`;

  const rendered = template
    .replaceAll("{firstName}", sampleName)
    .replaceAll("{link}", sampleLink)
    .replaceAll("{optout}", sampleOptOut);

  // GSM-7 Basic Character Set test
  const gsm7Regex = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\[~\]|€]*$/;
  const isUnicode = !gsm7Regex.test(rendered);

  const length = rendered.length;

  // Segment calculation:
  // GSM-7: single message is up to 160 chars; concatenated messages are 153 chars/segment
  // Unicode: single message is up to 70 chars; concatenated messages are 67 chars/segment
  let segments = 1;
  if (!isUnicode) {
    if (length > 160) {
      segments = Math.ceil(length / 153);
    }
  } else {
    if (length > 70) {
      segments = Math.ceil(length / 67);
    }
  }

  return {
    rawLength: template.length,
    renderedLength: length,
    renderedText: rendered,
    isUnicode,
    segments,
    singlePartMax: isUnicode ? 70 : 160,
  };
}

