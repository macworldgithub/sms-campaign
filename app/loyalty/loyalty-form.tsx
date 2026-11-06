"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import styles from "./loyalty.module.css";
import Link from "next/link";
import Image from "next/image";

type Offer = { active: boolean; offerName: string; offerDetails: string; eligibility: string; expiresAt: string };
export default function LoyaltyForm({ campaignRef, viewSwitch }: { campaignRef: string; viewSwitch: ReactNode }) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState("");
  useEffect(() => {
    let active = true;
    fetch(`/api/loyalty/config${campaignRef ? `?ref=${encodeURIComponent(campaignRef)}` : ""}`, { cache: "no-store" })
      .then(async response => { const value = await response.json(); if (!response.ok) throw new Error(value.message); if (active) setOffer(value); })
      .catch(failure => { if (active) setError(failure.message || "Unable to load the offer."); });
    return () => { active = false; };
  }, [campaignRef]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/trpc/campaign.enquire", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ json: { firstName: fields.get("firstName"), lastName: fields.get("lastName"), email: fields.get("email"), phone: fields.get("phone"), website: fields.get("website"), existingCustomer: fields.get("existingCustomer") === "on", contactConsent: fields.get("contactConsent") === "on" } }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.json?.message || "We could not register your enquiry. Please try again.");
      setReference(result.result.data.json.reference);
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  return <div className={styles.page}>
    <header className={styles.header}><Link href="/" aria-label="South Morang Hyundai loyalty"><Image src="/booran-motors-black.png" alt="Booran Motors" width={160} height={48} priority /></Link><span>South Morang Hyundai</span>{viewSwitch}</header>
    <main className={styles.main}>
      <section className={styles.intro}><span className={styles.eyebrow}>THE SOUTH MORANG HYUNDAI LOYALTY PROGRAMME</span><h1>A little loyalty.<br /><em>A lasting connection.</em></h1><p>Thank you for being part of our Hyundai community. Discover your loyalty offer and let our team help with your next step.</p><div className={styles.promise}><span>01 &nbsp; Explore your offer</span><span>02 &nbsp; Register your interest</span><span>03 &nbsp; Hear from our team</span></div></section>
      <section className={styles.card} aria-live="polite">
        {reference ? <><span className={styles.eyebrow}>ENQUIRY RECEIVED</span><h2>Thank you for your interest.</h2><p>Our South Morang Hyundai team will be in touch. Your reference is <strong>{reference}</strong>.</p><p>You will receive no further SMS from this loyalty campaign.</p></> : offer?.active ? <>
          <span className={styles.eyebrow}>YOUR LOYALTY OFFER</span><h2>{offer.offerName}</h2><p className={styles.terms}>{offer.offerDetails}</p><div className={styles.eligibility}><strong>Who is eligible?</strong><p>{offer.eligibility}</p><small>Offer ends {new Date(offer.expiresAt).toLocaleDateString("en-AU", { timeZone: "Australia/Melbourne", day: "numeric", month: "long", year: "numeric" })}, Melbourne time.</small></div>
          <form onSubmit={submit} className={styles.form}>
            <div className={styles.names}><label>First name<input name="firstName" autoComplete="given-name" maxLength={100} required /></label><label>Last name<input name="lastName" autoComplete="family-name" maxLength={100} required /></label></div>
            <label>Mobile number<input name="phone" type="tel" autoComplete="tel" placeholder="04xx xxx xxx" maxLength={32} required /></label>
            <label>Email address<input name="email" type="email" autoComplete="email" maxLength={320} required /></label>
            <div className={styles.trap} aria-hidden="true"><label>Leave this blank<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
            <label className={styles.check}><input name="existingCustomer" type="checkbox" required /><span>I am an existing South Morang Hyundai customer and meet the offer eligibility above.</span></label>
            <label className={styles.check}><input name="contactConsent" type="checkbox" required /><span>I agree to be contacted by South Morang Hyundai about this enquiry.</span></label>
            <p className={styles.privacy}>Your details are used to respond to this enquiry. This permission does not subscribe you to future SMS campaigns.</p>
            <button disabled={busy}>{busy ? "Registering your interest…" : "Register my interest →"}</button>
          </form>
        </> : offer ? <><span className={styles.eyebrow}>SOUTH MORANG HYUNDAI LOYALTY</span><h2>Stay connected.</h2><p>This offer is not currently active. Please contact the dealership for current offers.</p></> : !error ? <p>Loading your loyalty offer…</p> : null}
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </section>
    </main><footer className={styles.footer}>Booran Motors Group · South Morang Hyundai</footer>
  </div>;
}
