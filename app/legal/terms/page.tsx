import Link from "next/link";
import { LEGAL, placeholder } from "@/lib/legal";
import { DocHeader } from "../DocHeader";

export const metadata = { title: "Terms of Use · Hedgehog" };

export default function TermsPage() {
  const who = placeholder(LEGAL.operator, "operator name");
  const email = placeholder(LEGAL.contactEmail, "contact email");
  const state = placeholder(LEGAL.governingState, "state");
  return (
    <>
      <DocHeader
        title="Terms of Use"
        summary={
          <ul>
            <li>Hedgehog is software. It is not an exchange, broker, financial advisor or insurance company.</li>
            <li>Nothing here is financial advice. You decide, and you approve every order.</li>
            <li>A hedge can reduce a loss but can&apos;t remove it, and you can lose what you pay for it.</li>
            <li>For adults 18+ in the United States only.</li>
          </ul>
        }
      />

      <h2 id="agreement">1. Agreement</h2>
      <p>
        These Terms of Use (&ldquo;Terms&rdquo;) are an agreement between you and {who} (&ldquo;we,&rdquo; &ldquo;us&rdquo;) about your use of the Hedgehog
        website and services (the &ldquo;Service&rdquo;). By using the Service you agree to these Terms, our{" "}
        <Link href="/legal/privacy">Privacy Policy</Link> and our <Link href="/legal/risk">Risk Disclosure</Link>. If you don&apos;t agree, don&apos;t use
        the Service.
      </p>

      <h2 id="what">2. What Hedgehog is, and isn&apos;t</h2>
      <p>
        Hedgehog is a software tool. It shows odds from third-party prediction markets, explains how a market relates to a risk you describe, and
        helps you prepare orders for your review. Hedgehog:
      </p>
      <ul>
        <li>is <strong>not</strong> an exchange, broker, futures commission merchant, introducing broker or trading platform;</li>
        <li>is <strong>not</strong> a financial, investment, tax, legal or commodity trading advisor, and does not recommend that you buy or sell anything;</li>
        <li>is <strong>not</strong> insurance, does not provide coverage, and does not pay claims;</li>
        <li>does <strong>not</strong> hold your money or crypto, and never asks for your private keys or seed phrase.</li>
      </ul>
      <p>
        Prediction market contracts are offered by Gemini (or another venue), not by us, and are governed by that venue&apos;s own terms, rules and
        eligibility requirements.
      </p>

      <h2 id="eligibility">3. Who can use it</h2>
      <p>
        You must be at least 18, located in the United States, and legally allowed to use prediction markets where you are. Some states restrict or
        challenge event contracts; it&apos;s your responsibility to make sure your use is lawful. If you trade on a venue, you must also meet that
        venue&apos;s requirements.
      </p>

      <h2 id="trading">4. Paper trading and live trading</h2>
      <p>
        The Service may run in <strong>paper mode</strong>, where approved hedges are simulated at live market prices and no money moves, or in
        <strong> live mode</strong>, where approved orders are sent to the venue. The site shows which mode is active. In live mode, an order you
        approve is final once the venue accepts it; prices can change between your review and execution, and orders may fill partly or not at all.
      </p>

      <h2 id="your-decisions">5. Your decisions and responsibilities</h2>
      <ul>
        <li>You decide whether to hedge, and you review and approve every order. We never place an order without your approval.</li>
        <li>You&apos;re responsible for the accuracy of what you enter, such as amounts held and costs.</li>
        <li>Before approving, review the contract&apos;s rules on the venue, including how and when it settles, and the venue&apos;s fees.</li>
        <li>You&apos;re responsible for any taxes that result from your activity.</li>
      </ul>

      <h2 id="ai">6. AI and automated analysis</h2>
      <p>
        Hedgehog uses AI and automated tools to interpret descriptions, find markets, compare contract rules and estimate sizes. These can be
        wrong, incomplete or out of date. Odds shown are market prices, not predictions or guarantees. Always review the market, its rules and the
        numbers yourself before approving anything.
      </p>

      <h2 id="acceptable-use">7. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>use the Service for anything unlawful, including evading restrictions that apply to you;</li>
        <li>interfere with, overload, scrape or attempt to break the Service or its security;</li>
        <li>submit content that is unlawful, infringing, or that contains other people&apos;s personal or confidential information; or</li>
        <li>misrepresent your identity or eligibility.</li>
      </ul>

      <h2 id="third-parties">8. Third-party services</h2>
      <p>
        The Service relies on third parties, including Gemini, Solana network data providers, price providers, AI providers and our host. We
        don&apos;t control them and aren&apos;t responsible for their availability, accuracy, or conduct. Your use of a venue is governed by its terms.
      </p>

      <h2 id="ip">9. Intellectual property</h2>
      <p>
        The Service, including its design, text, graphics and software, belongs to us or our licensors. You may use it for your personal,
        non-commercial use under these Terms. Third-party names and logos belong to their owners and are used only to identify their products.
      </p>

      <h2 id="disclaimers">10. Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE,&rdquo; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
        MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY AND NON-INFRINGEMENT. WE DON&apos;T WARRANT THAT THE SERVICE WILL BE
        UNINTERRUPTED OR ERROR-FREE, THAT ODDS, PRICES OR ANALYSIS ARE ACCURATE OR CURRENT, OR THAT ANY HEDGE WILL REDUCE YOUR LOSSES.
      </p>

      <h2 id="liability">11. Limitation of liability</h2>
      <p>
        TO THE FULLEST EXTENT PERMITTED BY LAW, WE WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, OR
        FOR ANY TRADING LOSSES, LOST PROFITS, OR LOSS OF DATA, ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO
        THE SERVICE WILL NOT EXCEED ONE HUNDRED US DOLLARS ($100). Some jurisdictions don&apos;t allow some of these limits, so they may not apply to
        you.
      </p>

      <h2 id="indemnity">12. Indemnity</h2>
      <p>
        You agree to indemnify and hold us harmless from claims, losses and expenses (including reasonable legal fees) arising from your misuse of
        the Service or your violation of these Terms or the law.
      </p>

      <h2 id="changes">13. Changes and termination</h2>
      <p>
        We may change or stop the Service, or update these Terms, at any time. We&apos;ll post updates here with a new effective date; continuing to
        use the Service means you accept them. We may suspend access for anyone who violates these Terms.
      </p>

      <h2 id="law">14. Governing law</h2>
      <p>
        These Terms are governed by the laws of the State of {state} and applicable US federal law, without regard to conflict-of-law rules. Disputes
        will be resolved in the state or federal courts located in {state}, unless the law requires otherwise.
      </p>

      <h2 id="contact">15. Contact</h2>
      <p>
        Questions about these Terms: <strong>{email}</strong>.
      </p>
    </>
  );
}
