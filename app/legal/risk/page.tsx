import { DocHeader } from "../DocHeader";

export const metadata = { title: "Risk Disclosure · Hedgehog" };

export default function RiskPage() {
  return (
    <>
      <DocHeader
        title="Risk Disclosure"
        summary={
          <ul>
            <li>You can lose the full amount you pay for a hedge. That happens whenever the event you&apos;re worried about doesn&apos;t occur.</li>
            <li>A hedge reduces a loss; it doesn&apos;t remove it. Some losses aren&apos;t covered at all.</li>
            <li>Odds are market prices, not predictions. Read each contract&apos;s rules before you approve.</li>
          </ul>
        }
      />

      <p>
        Prediction market contracts carry real risk. This page explains the main risks of using them to offset other risks. It is not a complete
        list. If you&apos;re not sure a hedge is right for you, don&apos;t place it, and consider speaking with a qualified professional.
      </p>

      <h2 id="lose">You can lose what you pay</h2>
      <p>
        Each contract pays $1 if its outcome happens and $0 if it doesn&apos;t. If the event you hedged against doesn&apos;t happen, the contract expires
        worthless and you lose everything you paid for it. That is the normal cost of a hedge, not a malfunction.
      </p>

      <h2 id="partial">A hedge is partial, not complete</h2>
      <ul>
        <li>Crypto hedges pay out in steps between price levels, so the payout won&apos;t exactly match your loss.</li>
        <li>The first part of a drop (above the highest level you hedge) and losses beyond the lowest level aren&apos;t offset.</li>
        <li>For promos, the payout is sized to an estimate of your cost. If more or fewer customers show up, your real cost differs.</li>
      </ul>

      <h2 id="basis">Stand-in markets don&apos;t move exactly with your cost</h2>
      <p>
        When no market tracks your exact risk, Hedgehog may use a related one, such as oil prices for diesel costs, or a team&apos;s points total
        for a promo tied to a win. These are labeled &ldquo;partial match&rdquo; or &ldquo;stand-in.&rdquo; They can pay out when you have no loss, or
        not pay out when you do.
      </p>

      <h2 id="rules">Contract rules decide the outcome</h2>
      <p>
        Each contract settles under its venue&apos;s written rules and data source, including how ties, overtime, postponements, cancellations and
        settlement times are handled. These may differ from how you describe your risk. Hedgehog highlights differences it finds, but it can miss
        some. The venue&apos;s rules always control.
      </p>

      <h2 id="prices">Prices, liquidity and fees</h2>
      <ul>
        <li>Prices change constantly. The price you see may not be the price you get.</li>
        <li>Some contracts have few buyers and sellers, so orders may fill partly, slowly or not at all, and positions may be hard to sell before settlement.</li>
        <li>Venues charge fees. Costs shown in Hedgehog exclude venue fees unless stated.</li>
      </ul>

      <h2 id="timing">Short-dated contracts</h2>
      <p>
        Many available contracts settle within days. A risk that lasts longer may need a new hedge after each one settles, at whatever the price is
        then.
      </p>

      <h2 id="odds">Odds are not predictions</h2>
      <p>
        The percentages shown are prices set by market participants. They can be wrong, change quickly, and past odds don&apos;t tell you what will
        happen.
      </p>

      <h2 id="ai">Automated and AI analysis can be wrong</h2>
      <p>
        Hedgehog uses AI and automated tools to interpret your description, find markets, compare rules and size orders. These can make mistakes.
        Review every market, rule and number before approving.
      </p>

      <h2 id="regulatory">Regulatory and venue risk</h2>
      <p>
        Prediction markets are regulated by the CFTC, but some states have challenged or restricted event contracts. Laws, venue rules and the
        availability of particular markets can change, which could affect your ability to place, hold or settle positions. Venues can also have
        outages or other operational problems.
      </p>

      <h2 id="paper">Paper trading is a simulation</h2>
      <p>
        In paper mode, fills and settlements are simulated using live prices and real market outcomes, but no money moves. Real orders can fill at
        different prices, partly, or not at all.
      </p>

      <h2 id="not">Not insurance or advice</h2>
      <p>
        A prediction market contract is not insurance. It pays based only on the contract&apos;s outcome, never on proof of your loss. Hedgehog does
        not give financial, investment, tax or legal advice.
      </p>
    </>
  );
}
