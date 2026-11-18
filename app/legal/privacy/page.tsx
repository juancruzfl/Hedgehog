import Link from "next/link";
import { LEGAL, STORAGE_KEYS, placeholder } from "@/lib/legal";
import { DocHeader } from "../DocHeader";

export const metadata = { title: "Privacy Policy · Hedgehog" };

export default function PrivacyPage() {
  const who = placeholder(LEGAL.operator, "operator name");
  const email = placeholder(LEGAL.contactEmail, "contact email");
  return (
    <>
      <DocHeader
        title="Privacy Policy"
        summary={
          <ul>
            <li>No accounts, no cookies, no ads, no analytics. We don&apos;t sell or share your personal information.</li>
            <li>What you hold is saved in your browser, not on our servers.</li>
            <li>To answer your questions, some of what you type is sent to the services that power Hedgehog (Gemini, blockchain data providers, and AI providers).</li>
            <li>Don&apos;t type anything confidential into the business risk box.</li>
          </ul>
        }
      />

      <h2 id="who">1. Who we are</h2>
      <p>
        Hedgehog (&ldquo;Hedgehog,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) is a website, operated by {who}, that shows the odds of real-world risks using
        prediction markets and helps you set up hedges on Gemini. This policy explains what information we handle when you use the site and what
        we do with it. Hedgehog is currently a demonstration project and is offered only to people in the United States.
      </p>

      <h2 id="collect">2. What we collect, and why</h2>
      <h3>What you hold (crypto)</h3>
      <p>
        When you enter coins and amounts, or import them, the list is saved in your own browser (see{" "}
        <Link href="/legal/cookies">Cookies &amp; Storage</Link>). To show you odds, the coins and amounts are sent to our server, which uses them
        to calculate the forecast and then discards them. We don&apos;t store them on our servers. &ldquo;Import from Gemini&rdquo; reads balances
        from the Gemini account connected to this site; we never ask for your Gemini login or API keys.
      </p>
      <h3>Wallet addresses</h3>
      <p>
        If you paste a Solana, Ethereum or Bitcoin address, or connect a wallet such as Phantom, MetaMask or Coinbase Wallet, we receive the public
        address only. We send it to a data provider for that network to read its balances. We never ask for, receive or store a private key, seed
        phrase or signature, and we don&apos;t store the address on our servers. Wallet addresses and balances are public on their blockchains.
      </p>
      <h3>Business risk descriptions</h3>
      <p>
        When you describe a business risk, the text is sent to our server and to our AI providers (OpenRouter, which routes it to the AI model we
        use) so they can interpret it and help find matching markets. AI providers may keep this text under their own policies. We don&apos;t store
        the text itself unless you approve a hedge (below). <strong>Please don&apos;t include confidential, personal or customer information.</strong>
      </p>
      <h3>Hedges you approve</h3>
      <p>
        When you approve a hedge, we store a record of it on our server: a short summary of the risk, the markets, amounts and prices, and the
        time. In the current demo these are paper trades (no real money moves), and the &ldquo;My hedges&rdquo; list is shared by everyone using the
        hosted demo, so other visitors can see approved hedges.
      </p>
      <h3>Technical information</h3>
      <p>
        Like most websites, our hosting provider automatically records basic request information (such as IP address, browser type, the page
        requested and the time) to run the service, keep it secure and fix problems.
      </p>
      <h3>What we don&apos;t collect</h3>
      <p>
        We don&apos;t ask for your name, email, phone number or payment details. We don&apos;t use cookies, advertising or analytics tools, and we
        don&apos;t build profiles about you.
      </p>

      <h2 id="share">3. Who we share it with</h2>
      <p>We share information only with the service providers that make Hedgehog work, and only what each one needs:</p>
      <ul>
        <li>
          <strong>Gemini</strong>: market data, prices and, when live trading is enabled, order placement. Our server talks to Gemini; your browser
          does not.
        </li>
        <li>
          <strong>Blockchain data providers</strong>: read balances for a wallet address you provide: a Solana network provider, Ethereum and Base
          network providers (PublicNode by default), and a Bitcoin explorer (mempool.space, with blockstream.info as a backup).
        </li>
        <li>
          <strong>Hyperliquid</strong>: a backup source of public crypto prices (no personal information is sent).
        </li>
        <li>
          <strong>OpenRouter and the AI model provider it routes to</strong>: business risk descriptions, to interpret them.
        </li>
        <li>
          <strong>Our hosting provider (Railway)</strong>: runs the site and stores approved hedge records and request logs.
        </li>
      </ul>
      <p>
        We may also disclose information if required by law, to protect the rights, safety or security of users or the service, or as part of a
        merger or transfer of the service (in which case this policy would continue to apply). We do not sell personal information, and we do not
        share it for cross-context behavioral advertising.
      </p>

      <h2 id="retention">4. How long we keep it</h2>
      <ul>
        <li>Holdings saved in your browser stay until you remove them or clear your browser&apos;s site data.</li>
        <li>Approved hedge records are kept while the demo runs, or until you ask us to delete them.</li>
        <li>Hosting request logs are kept for the period set by our hosting provider.</li>
        <li>We don&apos;t keep wallet addresses or crypto holdings on our servers.</li>
      </ul>

      <h2 id="rights">5. Your choices and rights</h2>
      <p>
        You can remove saved holdings at any time with <strong>Edit assets</strong>, or by clearing this site&apos;s data in your browser. Depending
        on where you live (including California, Colorado, Connecticut, Virginia, Utah, Texas, Oregon and other US states with privacy laws), you
        may have the right to:
      </p>
      <ul>
        <li>know what personal information we have about you and get a copy of it;</li>
        <li>correct inaccurate personal information;</li>
        <li>delete personal information we hold about you;</li>
        <li>opt out of the sale or sharing of personal information, or its use for targeted advertising or profiling (we don&apos;t do any of these);</li>
        <li>appeal our decision about your request; and</li>
        <li>not be treated differently for exercising these rights.</li>
      </ul>
      <p>
        To make a request, email <strong>{email}</strong>. We&apos;ll confirm the request and respond within 45 days (we may extend this once where
        the law allows). Because we don&apos;t have accounts, we may ask for details that help us find the records you mean, such as the time and
        content of a hedge you approved. You can use an authorized agent to make a request on your behalf.
      </p>

      <h2 id="notice-at-collection">6. Notice at collection (California)</h2>
      <p>This table summarizes the categories of personal information we collect, why, and how long we keep them.</p>
      {/* Wide tables scroll inside their own box on small screens */}
      <div className="overflow-x-auto">
      <table className="min-w-[36rem]">
        <thead>
          <tr>
            <th>Category</th>
            <th>Examples</th>
            <th>Why we use it</th>
            <th>Sold or shared?</th>
            <th>Kept for</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Identifiers</td>
            <td>IP address; public wallet address you provide</td>
            <td>Running and securing the site; reading wallet balances you ask for</td>
            <td>No</td>
            <td>Logs: per hosting provider. Wallet address: not stored</td>
          </tr>
          <tr>
            <td>Commercial / financial information</td>
            <td>Crypto holdings you enter; hedges you approve</td>
            <td>Showing odds; recording approved hedges</td>
            <td>No</td>
            <td>Holdings: in your browser only. Hedges: while the demo runs or until deletion</td>
          </tr>
          <tr>
            <td>Information you type</td>
            <td>Business risk descriptions</td>
            <td>Interpreting the risk to find matching markets</td>
            <td>No</td>
            <td>Not stored by us unless you approve a hedge; AI providers per their policies</td>
          </tr>
          <tr>
            <td>Internet activity</td>
            <td>Pages requested, browser type, time</td>
            <td>Running, securing and fixing the site</td>
            <td>No</td>
            <td>Per hosting provider</td>
          </tr>
        </tbody>
      </table>
      </div>
      <p>We don&apos;t collect sensitive personal information as defined by California law, and we don&apos;t use personal information to infer characteristics about you.</p>

      <h2 id="children">7. Children</h2>
      <p>Hedgehog is for adults 18 and older. We don&apos;t knowingly collect information from anyone under 18. If you believe a child has used the site, contact us and we&apos;ll delete related records.</p>

      <h2 id="security">8. Security</h2>
      <p>
        We use reasonable measures to protect information, including keeping API keys on our servers and never handling private keys or seed
        phrases. No method of transmission or storage is completely secure, so we can&apos;t guarantee absolute security.
      </p>

      <h2 id="changes">9. Changes</h2>
      <p>We&apos;ll post any changes on this page and update the effective date. If changes are significant, we&apos;ll make that clear on the site.</p>

      <h2 id="contact">10. Contact</h2>
      <p>
        Questions or requests: <strong>{email}</strong> ({who}).
      </p>
      <p className="text-xs">Browser storage key used for holdings: <code>{STORAGE_KEYS.holdings}</code>.</p>
    </>
  );
}
