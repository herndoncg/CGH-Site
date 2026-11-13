// Service-area pages. Each town gets its own page (good for "paving in <town>" searches).
// Add a town here and its page appears automatically.

export interface Area {
  slug: string;
  city: string;
  county: string;
  drive: string; // from the Longview yard
  local: string; // one honest, town-specific paragraph
  nearby: string[];
}

export const areas: Area[] = [
  {
    slug: 'longview-tx', city: 'Longview', county: 'Gregg County', drive: 'Home base',
    local: 'Longview is home. Our yard is here, our crew lives here, and most weeks we are paving somewhere between Loop 281, Judson Road and Spring Hill. Being local means we can usually come look at a job within a few days and get hot mix to the site while it is still hot.',
    nearby: ['White Oak', 'Hallsville', 'Kilgore', 'Spring Hill', 'Lakeport'],
  },
  {
    slug: 'kilgore-tx', city: 'Kilgore', county: 'Gregg and Rusk counties', drive: 'About 15 minutes from our yard',
    local: 'Kilgore is a short run down US 259 from our yard. We pave home driveways, shop and yard entrances, church lots and private roads from downtown out toward Liberty City and Laird Hill.',
    nearby: ['Liberty City', 'Laird Hill', 'Overton', 'Longview'],
  },
  {
    slug: 'tyler-tx', city: 'Tyler', county: 'Smith County', drive: 'About 45 minutes from our yard',
    local: 'We work Tyler and Smith County regularly, from home driveways off Loop 323 to parking lots and private roads out toward Whitehouse, Chapel Hill and Lindale.',
    nearby: ['Whitehouse', 'Chapel Hill', 'Lindale', 'Winona'],
  },
  {
    slug: 'marshall-tx', city: 'Marshall', county: 'Harrison County', drive: 'About 30 minutes from our yard',
    local: 'Marshall is a straight shot east on I-20 or US 80. We pave driveways, ranch entrances and lots across Harrison County, and keep going east into Louisiana for bigger jobs.',
    nearby: ['Hallsville', 'Scottsville', 'Waskom', 'Jefferson'],
  },
  {
    slug: 'henderson-tx', city: 'Henderson', county: 'Rusk County', drive: 'About 35 minutes from our yard',
    local: 'Rusk County has a lot of long drives and ranch roads on red clay, which is exactly where grading and base matter most. We handle the dirt work and the paving on jobs around Henderson, Tatum and Mount Enterprise.',
    nearby: ['Tatum', 'Mount Enterprise', 'New London', 'Kilgore'],
  },
  {
    slug: 'gilmer-tx', city: 'Gilmer', county: 'Upshur County', drive: 'About 30 minutes from our yard',
    local: 'North of Longview on US 271, Gilmer and Upshur County are mostly country drives, farm entrances and church lots. Sandy soil and hills make drainage the first thing we look at here.',
    nearby: ['Gladewater', 'Big Sandy', 'Union Grove', 'Diana'],
  },
  {
    slug: 'hallsville-tx', city: 'Hallsville', county: 'Harrison County', drive: 'About 15 minutes from our yard',
    local: 'Hallsville sits on US 80 between Longview and Marshall and has grown fast. We pave new home driveways, long drives on acreage and shop entrances all around town.',
    nearby: ['Longview', 'Marshall', 'Harleton'],
  },
  {
    slug: 'white-oak-tx', city: 'White Oak', county: 'Gregg County', drive: 'About 10 minutes from our yard',
    local: 'White Oak is right next door on US 80. It is some of the closest work we do, which makes small jobs like driveway replacements and patching easy to schedule.',
    nearby: ['Longview', 'Gladewater', 'Clarksville City'],
  },
  {
    slug: 'gladewater-tx', city: 'Gladewater', county: 'Gregg and Upshur counties', drive: 'About 20 minutes from our yard',
    local: 'Where US 80 meets US 271, Gladewater has plenty of older driveways and lots that are ready for an overlay or a full rebuild. We look at the base first and tell you which one you actually need.',
    nearby: ['White Oak', 'Gilmer', 'Union Grove', 'Big Sandy'],
  },
  {
    slug: 'carthage-tx', city: 'Carthage', county: 'Panola County', drive: 'About 45 minutes from our yard',
    local: 'We pave in Carthage and across Panola County: home drives, ranch roads and business lots along US 59 and US 79, out to Beckville and Gary.',
    nearby: ['Beckville', 'Gary', 'Tatum', 'De Berry'],
  },
];

export const getArea = (slug: string) => areas.find((a) => a.slug === slug);
