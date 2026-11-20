// FAQ for people new to all of this: no prior knowledge of prediction markets, crypto or
// blockchains assumed. Layout after Ramp's FAQ: a big title, then full-width rows split by
// hairlines, each opening its answer underneath. Native <details>, so it works without JS.

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "What is Hedgehog, in plain English?",
    a: (
      <>
        Hedgehog helps you prepare for things that could cost you money: a promo that pays out if the home team wins, a fuel bill that jumps, a cold weekend
        that empties your patio, or a drop in the coins you own. You describe the worry, Hedgehog finds a market that pays out if that exact thing happens,
        and shows you what it would cost to set money aside against it. If it happens, the payout helps cover your loss.
      </>
    ),
  },
  {
    q: "What's a prediction market?",
    a: (
      <>
        A place where people buy and sell simple yes-or-no questions about the future, like &ldquo;Will Indianapolis beat Houston?&rdquo; or &ldquo;Will oil
        be above $93 on Nov 30?&rdquo; Each share pays $1 if the answer turns out to be yes, and nothing if it&apos;s no. The price tells you how likely
        people think it is: a share that costs 16¢ means the market sees about a 16% chance. Hedgehog uses the markets on Gemini, a US exchange.
      </>
    ),
  },
  {
    q: "How does this actually save me money?",
    a: (
      <>
        Say you promise half-price wings if your team wins, and that would cost you about $3,000. If the market gives the team a 16% chance, you can buy
        shares that pay $3,000 if they win for about $480. If they win, the $3,000 payout covers the promo. If they lose, the promo cost you nothing and
        you&apos;re out the $480. Either way, you knew your cost up front instead of risking $3,000.
      </>
    ),
  },
  {
    q: "What if the thing I'm worried about doesn't happen?",
    a: (
      <>
        Then the hedge doesn&apos;t pay out and you lose what you paid for it, the same way you&apos;d spend money on a spare tire you never use. Hedgehog
        always shows you that amount before you decide, so there are no surprises.
      </>
    ),
  },
  {
    q: "Can I lose more than I put in?",
    a: (
      <>
        No. You buy shares at the price you see, and each share pays either $1 or $0. The most you can lose on a hedge is what you paid for it.
      </>
    ),
  },
  {
    q: "Is this the same as insurance?",
    a: (
      <>
        No. Hedgehog isn&apos;t an insurance company and doesn&apos;t sell insurance. You&apos;re buying shares in a regulated market that pay out when a
        specific, measurable thing happens, like a final score or an official temperature reading. There&apos;s nothing to file and no one decides whether
        you &ldquo;qualify&rdquo;: if the event happens, the shares pay.
      </>
    ),
  },
  {
    q: "Do I need to know anything about crypto or blockchain?",
    a: (
      <>
        No. Most things Hedgehog helps with, like promos, fuel and weather, have nothing to do with crypto, and everything is priced in US dollars. Crypto
        only comes up if you already own some and want to see how a price drop could affect you.
      </>
    ),
  },
  {
    q: "Where does my money go? Does Hedgehog hold it?",
    a: (
      <>
        Hedgehog never holds your money. Trades happen in your own account at Gemini, and nothing is ever bought without you approving it first. Hedgehog
        can&apos;t move your money, and it will never ask for passwords to a crypto wallet.
      </>
    ),
  },
  {
    q: "What is Gemini, and why do I need an account there?",
    a: (
      <>
        Gemini is a US company that runs the markets Hedgehog uses. Its prediction markets are regulated by the CFTC, the US government agency that oversees
        these kinds of markets. You sign in with your Gemini account so any trade you approve is made in your name, with your money staying in your account.
      </>
    ),
  },
  {
    q: "How much does it cost?",
    a: (
      <>
        You pay the market price of the shares you buy, which Hedgehog shows before you approve anything (for example, 16¢ for every $1 you could get back).
        Gemini charges its own trading fees on top of that, and Hedgehog points them out before you decide.
      </>
    ),
  },
  {
    q: "What does “sealed on Solana” mean, and do I have to do anything?",
    a: (
      <>
        You don&apos;t have to do anything. Every hour, Hedgehog takes a fingerprint of all the prices it recorded and stamps it onto Solana, a public
        record that nobody can edit afterward, a bit like a notarized timestamp. It means anyone can check that a price Hedgehog showed you is the real one
        from that moment and hasn&apos;t been changed since.
      </>
    ),
  },
  {
    q: "Is an AI making decisions with my money?",
    a: (
      <>
        No. AI helps Hedgehog understand what you type and find markets that match. All the math (what you pay, what you get back) follows fixed rules, and
        nothing is bought until you review the numbers and approve.
      </>
    ),
  },
  {
    q: "Who can use Hedgehog?",
    a: <>Adults 18 and older in the United States. Gemini&apos;s prediction markets are only available to US customers.</>,
  },
];

export function Faq() {
  return (
    <section className="py-14 md:py-24" aria-labelledby="faq-title">
      <div className="mx-auto max-w-6xl px-4">
        <h2 id="faq-title" className="text-center text-3xl font-medium tracking-[-0.02em] sm:text-[44px] sm:leading-tight">
          Frequently asked questions
        </h2>
        <div className="mt-12 border-b border-border">
          {FAQS.map((f) => (
            <details key={f.q} className="group border-t border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 text-base md:py-5 md:text-[17px] [&::-webkit-details-marker]:hidden">
                {f.q}
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-text transition group-hover:border-text-3"
                  aria-hidden
                >
                  <svg viewBox="0 0 16 16" className="h-4 w-4 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m4 6 4 4 4-4" />
                  </svg>
                </span>
              </summary>
              <div className="max-w-3xl pb-6 pr-12 text-[15px] leading-relaxed text-text-2">{f.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
