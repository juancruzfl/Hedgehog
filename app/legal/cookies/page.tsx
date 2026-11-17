import { STORAGE_KEYS } from "@/lib/legal";
import { DocHeader } from "../DocHeader";

export const metadata = { title: "Cookies & Storage · Hedgehog" };

export default function CookiesPage() {
  return (
    <>
      <DocHeader
        title="Cookies & Storage Notice"
        summary={
          <ul>
            <li>Hedgehog doesn&apos;t use cookies.</li>
            <li>We save two small items in your browser so the site works the way you expect. Nothing is used for tracking or ads.</li>
          </ul>
        }
      />

      <h2 id="cookies">Cookies</h2>
      <p>
        Hedgehog does not set cookies, and we don&apos;t use advertising, analytics or other third-party tracking tools. The site loads its fonts
        and code from our own server.
      </p>

      <h2 id="storage">What we save in your browser</h2>
      <p>
        We use your browser&apos;s local storage, which stays on your device and isn&apos;t sent to us automatically. It holds only these items:
      </p>
      {/* Wide tables scroll inside their own box on small screens */}
      <div className="overflow-x-auto">
      <table className="min-w-[36rem]">
        <thead>
          <tr>
            <th>Key</th>
            <th>What it holds</th>
            <th>Why</th>
            <th>How long</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>{STORAGE_KEYS.holdings}</code>
            </td>
            <td>The coins and amounts you entered or imported</td>
            <td>So you don&apos;t have to re-enter what you hold each visit</td>
            <td>Until you remove them or clear site data</td>
          </tr>
          <tr>
            <td>
              <code>{STORAGE_KEYS.notice}</code>
            </td>
            <td>That you dismissed the storage notice</td>
            <td>So the notice doesn&apos;t show again</td>
            <td>Until you clear site data</td>
          </tr>
        </tbody>
      </table>
      </div>
      <p>
        These items are needed for features you choose to use. Your holdings are sent to our server only when you ask for odds, to calculate
        them, and aren&apos;t stored there.
      </p>

      <h2 id="clear">How to clear it</h2>
      <ul>
        <li>Remove individual assets with <strong>Edit assets</strong> on the Crypto page.</li>
        <li>Or clear this site&apos;s data in your browser settings (often under Privacy, &ldquo;Cookies and site data&rdquo;).</li>
      </ul>

      <h2 id="wallets">Wallet extensions</h2>
      <p>
        If you connect a wallet extension such as Phantom, the extension runs in your browser under its own privacy policy. Hedgehog only receives
        the public address it shares.
      </p>

      <h2 id="hosting">Our host</h2>
      <p>
        Our hosting provider may use technical mechanisms that are strictly necessary to deliver and secure the site. We don&apos;t use these to
        track you.
      </p>
    </>
  );
}
