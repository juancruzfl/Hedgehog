// "One market, many risks": real-world risks a single prediction market can offset.
// Each use links into the right flow with the description prefilled.

export interface RiskUse {
  who: string; // "Delivery fleet"
  /** What sets it off, shared by every use of one market: "If oil tops $93 by Nov 30". */
  trigger: string;
  /** What it costs the business when it happens: "Diesel for 6 vans costs more". */
  risk: string;
  /** Typical dollars at stake, used to show "put in $X, get $payout back". */
  payout: number;
  href: string;
}

/** Business links run the analysis immediately (auto=1). */
const biz = (q: string) => `/business?q=${encodeURIComponent(q)}&auto=1`;

export function cryptoUses(asset: string, strike: string, by: string): RiskUse[] {
  const trigger = `If ${asset} falls below ${strike}`;
  return [
    { who: `${asset} holder`, trigger, payout: 1000, risk: `Your ${asset} loses value`, href: `/crypto?asset=${asset}` },
    {
      who: "Online shop",
      trigger,
      payout: 1000,
      risk: `A week of sales held in ${asset} shrinks`,
      href: biz(`My online shop accepts ${asset}. We hold about $5,000 of ${asset} from sales until we convert to dollars on ${by}. If ${asset} falls below ${strike}, we lose money.`),
    },
    {
      who: "Freelancer",
      trigger,
      payout: 600,
      risk: `An invoice paid in ${asset} is worth less`,
      href: biz(`I'm a freelancer and a client pays my $3,000 invoice in ${asset} on ${by}. If ${asset} drops below ${strike} before then, I get paid less.`),
    },
    {
      who: "Crypto treasury",
      trigger,
      payout: 5000,
      risk: `Runway kept in ${asset} shrinks`,
      href: `/crypto?asset=${asset}`,
    },
  ];
}

export function commodityUses(name: string, strike: string, by: string): RiskUse[] {
  const trigger = `If ${name.toLowerCase()} tops ${strike}`;
  if (name === "Gold") {
    return [
      { who: "Jeweler", trigger, payout: 2000, risk: "Gold for holiday inventory costs more", href: biz(`I'm a jeweler and need to buy about 20 oz of gold before ${by}. If gold rises above ${strike}, my margins disappear.`) },
      { who: "Dental lab", trigger, payout: 1000, risk: "Gold alloy for crowns gets pricier", href: biz(`Our dental lab buys about 10 oz of gold alloy a month. If gold rises above ${strike} by ${by}, our costs jump.`) },
      { who: "Pawn & resale shop", trigger, payout: 1500, risk: "Buy-back promises cost more", href: biz(`Our pawn shop promised fixed buy-back prices on about 15 oz of gold. If gold rises above ${strike} by ${by}, we lose money.`) },
    ];
  }
  return [
    { who: "Delivery fleet", trigger, payout: 1000, risk: "Diesel for six vans costs more", href: biz(`We run 6 delivery vans that burn about 2,500 gallons of diesel a month. A jump in fuel prices before ${by} would wreck our margins.`) },
    { who: "Food truck", trigger, payout: 300, risk: "Fuel for the truck and generator spikes", href: biz(`I run a food truck that uses about 400 gallons of fuel a month for driving and the generator. If oil rises above ${strike} by ${by}, my costs go up.`) },
    { who: "Landscaping crew", trigger, payout: 500, risk: "Gas for mowers and trucks climbs", href: biz(`Our landscaping crew burns about 800 gallons of gasoline a month. If oil rises above ${strike} before ${by}, we lose money on fixed-price contracts.`) },
    { who: "Small airline charter", trigger, payout: 2000, risk: "Jet fuel follows crude higher", href: biz(`Our charter company buys about 3,000 gallons of jet fuel a month. If oil rises above ${strike} by ${by}, our quoted trips become unprofitable.`) },
  ];
}

export function gameUses(dog: string, fav: string, day: string): RiskUse[] {
  const trigger = `If ${dog} wins`;
  return [
    {
      who: "Sports bar",
      trigger,
      payout: 3000,
      risk: "Half-price wings all night",
      href: biz(`I run a sports bar. If ${dog} beats ${fav} on ${day}, wings are half price all night. We usually sell about 500 orders and the discount is $6 each.`),
    },
    {
      who: "Pizza shop",
      trigger,
      payout: 1500,
      risk: "Free delivery all night",
      href: biz(`My pizza shop promised free delivery all night if ${dog} beats ${fav} on ${day}. That's about 300 deliveries at $5 each.`),
    },
    {
      who: "Car dealership",
      trigger,
      payout: 10000,
      risk: "$500 back on every car sold this week",
      href: biz(`Our car dealership is running a promo: $500 back on every car sold this week if ${dog} beats ${fav} on ${day}. We expect to sell about 20 cars.`),
    },
    {
      who: "Fan store",
      trigger,
      payout: 2000,
      risk: "25% off everything the next day",
      href: biz(`My fan store gives 25% off everything the day after ${dog} beats ${fav} on ${day}. A normal day is about $8,000 in sales.`),
    },
  ];
}
