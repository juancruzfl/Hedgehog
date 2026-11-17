// "One market, many risks": real-world risks a single prediction market can offset.
// Each use links into the right flow with the description prefilled.

export interface RiskUse {
  who: string; // "Delivery fleet"
  risk: string; // "Diesel jumps before month-end"
  /** Typical dollars at stake, used to show "put in $X, get $payout back". */
  payout: number;
  href: string;
}

/** Business links run the analysis immediately (auto=1). */
const biz = (q: string) => `/business?q=${encodeURIComponent(q)}&auto=1`;

export function cryptoUses(asset: string, strike: string, by: string): RiskUse[] {
  return [
    { who: `${asset} holder`, payout: 1000, risk: `Your ${asset} falls below ${strike} before ${by}`, href: `/crypto?asset=${asset}` },
    {
      who: "Online shop",
      payout: 1000,
      risk: `You accept ${asset} and hold a week of sales before converting`,
      href: biz(`My online shop accepts ${asset}. We hold about $5,000 of ${asset} from sales until we convert to dollars on ${by}. If ${asset} falls below ${strike}, we lose money.`),
    },
    {
      who: "Freelancer",
      payout: 600,
      risk: `A client is paying your invoice in ${asset} on ${by}`,
      href: biz(`I'm a freelancer and a client pays my $3,000 invoice in ${asset} on ${by}. If ${asset} drops below ${strike} before then, I get paid less.`),
    },
    {
      who: "Crypto treasury",
      payout: 5000,
      risk: `A small team keeps runway in ${asset}`,
      href: `/crypto?asset=${asset}`,
    },
  ];
}

export function commodityUses(name: string, strike: string, by: string): RiskUse[] {
  if (name === "Gold") {
    return [
      { who: "Jeweler", payout: 2000, risk: `Gold for holiday inventory rises above ${strike}`, href: biz(`I'm a jeweler and need to buy about 20 oz of gold before ${by}. If gold rises above ${strike}, my margins disappear.`) },
      { who: "Dental lab", payout: 1000, risk: "Gold alloy for crowns gets pricier", href: biz(`Our dental lab buys about 10 oz of gold alloy a month. If gold rises above ${strike} by ${by}, our costs jump.`) },
      { who: "Pawn & resale shop", payout: 1500, risk: "Buy-back promises get more expensive", href: biz(`Our pawn shop promised fixed buy-back prices on about 15 oz of gold. If gold rises above ${strike} by ${by}, we lose money.`) },
    ];
  }
  return [
    { who: "Delivery fleet", payout: 1000, risk: `Diesel jumps before ${by}`, href: biz(`We run 6 delivery vans that burn about 2,500 gallons of diesel a month. A jump in fuel prices before ${by} would wreck our margins.`) },
    { who: "Food truck", payout: 300, risk: "Fuel for the truck and generator spikes", href: biz(`I run a food truck that uses about 400 gallons of fuel a month for driving and the generator. If oil rises above ${strike} by ${by}, my costs go up.`) },
    { who: "Landscaping crew", payout: 500, risk: "Gas for mowers and trucks climbs", href: biz(`Our landscaping crew burns about 800 gallons of gasoline a month. If oil rises above ${strike} before ${by}, we lose money on fixed-price contracts.`) },
    { who: "Small airline charter", payout: 2000, risk: "Jet fuel tracks crude higher", href: biz(`Our charter company buys about 3,000 gallons of jet fuel a month. If oil rises above ${strike} by ${by}, our quoted trips become unprofitable.`) },
  ];
}

export function gameUses(dog: string, fav: string, day: string): RiskUse[] {
  return [
    {
      who: "Sports bar",
      payout: 3000,
      risk: `Half-price wings if ${dog} wins`,
      href: biz(`I run a sports bar. If ${dog} beats ${fav} on ${day}, wings are half price all night. We usually sell about 500 orders and the discount is $6 each.`),
    },
    {
      who: "Pizza shop",
      payout: 1500,
      risk: `Free delivery all night if ${dog} wins`,
      href: biz(`My pizza shop promised free delivery all night if ${dog} beats ${fav} on ${day}. That's about 300 deliveries at $5 each.`),
    },
    {
      who: "Car dealership",
      payout: 10000,
      risk: `"$500 back on every car sold this week if ${dog} wins"`,
      href: biz(`Our car dealership is running a promo: $500 back on every car sold this week if ${dog} beats ${fav} on ${day}. We expect to sell about 20 cars.`),
    },
    {
      who: "Fan store",
      payout: 2000,
      risk: `25% off everything the day after ${dog} wins`,
      href: biz(`My fan store gives 25% off everything the day after ${dog} beats ${fav} on ${day}. A normal day is about $8,000 in sales.`),
    },
  ];
}
