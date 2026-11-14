// Every service on the site. Add, remove or edit one here and its page, the menus and the sitemap all update.
// `instantQuote: true` means the online quote tool can price it (new asphalt by the square foot, and seal coats).

export interface Service {
  slug: string;
  name: string;
  group: 'Asphalt' | 'Upkeep' | 'Dirt work';
  line: string; // one line for lists
  title: string; // page headline
  description: string; // Google description
  intro: string[];
  includes: string[];
  signs: { heading: string; items: string[] };
  faqs: { q: string; a: string }[];
  instantQuote: boolean;
}

export const services: Service[] = [
  {
    slug: 'asphalt-driveways',
    name: 'Asphalt driveways',
    group: 'Asphalt',
    line: 'New driveways and tear-out replacements for homes, shops and barns.',
    title: 'Asphalt driveway paving in Longview and East Texas',
    description: 'New asphalt driveways and replacements in Longview, Kilgore, Tyler and across East Texas. Built on a proper base and sloped to drain. Get a price range online in about a minute.',
    intro: [
      'A driveway is only as good as what is under it. We shape the ground so water runs off, fix soft spots and washouts, add rock base where the soil needs it, then pave with hot mix and roll it tight.',
      'Most home driveways are a one or two day job once the ground is ready. You get a price range online first, then we come look at it in person before any work starts.',
    ],
    includes: [
      'Layout and grading so water drains away from the house and garage',
      'Base repair and rock where the ground is soft or washed out',
      'Hot mix asphalt built to TxDOT Type D specifications, laid with our own paver',
      'Rolled and compacted edges, and clean tie-ins at the street and garage',
      'Site cleaned up before we leave',
    ],
    signs: {
      heading: 'A new driveway makes sense when',
      items: [
        'You are on gravel or dirt and tired of ruts, dust and mud',
        'The old asphalt is cracked all the way through or breaking into chunks',
        'Water stands on the drive or runs toward the house',
        'You are building a new home, shop or barn',
      ],
    },
    faqs: [
      { q: 'How much does an asphalt driveway cost?', a: 'It depends on the size, the shape the ground is in and how much rock it needs. Our quote tool gives you a price range in about a minute from your measurements, and a free site visit confirms it.' },
      { q: 'Can you pave over my gravel driveway?', a: 'Often, yes. Packed gravel can make a good base. We check how thick and solid it is, regrade it so it drains, add rock where it is thin, and pave on top.' },
      { q: 'How long before I can drive on it?', a: 'New asphalt needs time to cool and harden, and hot weather stretches that out. We tell you exactly when it is ready for cars before we leave the job.' },
      { q: 'Do you tear out old concrete or asphalt?', a: 'Yes. We have the dozer, backhoe, skid steer and dump trucks to remove and haul off the old surface, then rebuild from the base up.' },
    ],
    instantQuote: true,
  },
  {
    slug: 'parking-lots',
    name: 'Parking lots',
    group: 'Asphalt',
    line: 'New lots, expansions and rebuilds for churches, shops and businesses.',
    title: 'Parking lot paving in Longview and East Texas',
    description: 'Parking lot paving, expansions and rebuilds for East Texas churches, businesses and shopping centers. Grading, base, asphalt and striping from one Longview crew.',
    intro: [
      'A parking lot is the first thing your customers or congregation touch. We build lots that drain, hold up to delivery trucks and stay smooth, and we stripe them when we are done so you only make one phone call.',
      'We can work in sections so part of the lot stays open while we pave.',
    ],
    includes: [
      'Grading and drainage so water leaves the lot instead of pooling',
      'Rock base sized for the traffic the lot carries',
      'Hot mix asphalt built to TxDOT Type D specifications',
      'Striping: stalls, ADA spaces, fire lanes, arrows and numbering',
      'Work phased around your business hours when the job allows',
    ],
    signs: {
      heading: 'Time to call when',
      items: [
        'Potholes keep coming back in the same spots',
        'Large areas are cracked in a pattern that looks like alligator skin',
        'Water stands for days after rain',
        'You are adding on to the building or need more spaces',
      ],
    },
    faqs: [
      { q: 'Can you keep my business open while you pave?', a: 'On most lots, yes. We split the job into sections and move traffic around the work so customers can still get in and park.' },
      { q: 'Do you handle the striping too?', a: 'Yes. Stalls, ADA spaces, fire lanes, arrows and numbering are part of what we do, so the lot is ready to use when we leave.' },
      { q: 'Should I overlay the lot or rebuild it?', a: 'If the base is solid and the damage is on the surface, an overlay costs less and adds years. If the base has failed, new asphalt on top will crack the same way. We look at it and tell you straight which one you need.' },
    ],
    instantQuote: true,
  },
  {
    slug: 'private-roads',
    name: 'Private and ranch roads',
    group: 'Asphalt',
    line: 'Ranch entrances, long drives, subdivision and county-style roads.',
    title: 'Private road and ranch road paving in East Texas',
    description: 'Paving for private roads, ranch entrances, long drives and subdivision roads across East Texas and the Ark-La-Tex. Dirt work, base and asphalt from one crew.',
    intro: [
      'Long roads live or die by drainage and base. We cut the ditches and crown, build up the base with crushed limestone, and pave a road that sheds water and carries trucks, trailers and equipment.',
      'Because we do our own dirt work and hauling, the same crew that shapes the road is the crew that paves it.',
    ],
    includes: [
      'Clearing, cutting grade, crowning and ditching',
      'Crushed limestone base, placed and compacted',
      'Culvert and entrance tie-ins',
      'Hot mix asphalt built to TxDOT Type D specifications',
      'Options for overlaying an existing road that still has a sound base',
    ],
    signs: {
      heading: 'Common jobs',
      items: [
        'Ranch and farm entrances off a county road or highway',
        'Long home drives that wash out every spring',
        'Subdivision and HOA roads',
        'Roads to shops, barns and equipment yards',
      ],
    },
    faqs: [
      { q: 'Can the online quote price a long road?', a: 'Yes. Enter the length and width and it gives you a range. Long roads vary a lot with drainage and base, so the site visit matters more here than on a small driveway.' },
      { q: 'How far do you travel?', a: 'We are based in Longview and work across East Texas and into Louisiana, Arkansas and Oklahoma for larger jobs.' },
    ],
    instantQuote: true,
  },
  {
    slug: 'asphalt-overlays',
    name: 'Overlays and resurfacing',
    group: 'Asphalt',
    line: 'A new asphalt surface over pavement that still has a solid base.',
    title: 'Asphalt overlays and resurfacing in East Texas',
    description: 'Asphalt overlays from 1.5 to 3.5 inches for driveways, parking lots and roads in Longview and East Texas. Leveling, patching and a new surface at a fraction of full replacement.',
    intro: [
      'If the pavement is worn and rough but the base underneath is still solid, you may not need to tear it out. We patch the failed spots, level the low areas, then lay 1.5 to 3.5 inches of new asphalt over the top.',
      'An overlay gives you a surface that looks and rides like new for less than a full rebuild.',
    ],
    includes: [
      'Inspection of the existing pavement and base',
      'Patching of failed areas before the overlay goes down',
      'Leveling course to take out dips and standing water',
      '1.5 to 3.5 inches of new hot mix, compacted',
      'Clean transitions at garages, streets and sidewalks',
    ],
    signs: {
      heading: 'An overlay is a good fit when',
      items: [
        'The surface is gray, rough or lightly cracked but still firm',
        'There are a few bad spots, not failure across the whole area',
        'You want a new surface without the cost of tearing everything out',
      ],
    },
    faqs: [
      { q: 'How thick is an overlay?', a: 'We lay overlays from 1.5 to 3.5 inches depending on the traffic and the condition of what is underneath.' },
      { q: 'Will cracks come back through?', a: 'Cracks from a failed base will. That is why we fix the bad areas first and tell you up front if an overlay is not the right answer for your pavement.' },
    ],
    instantQuote: true,
  },
  {
    slug: 'asphalt-repair',
    name: 'Patching and pothole repair',
    group: 'Upkeep',
    line: 'Cut-out patches and pothole repair that fix the cause, not just the hole.',
    title: 'Asphalt patching and pothole repair in East Texas',
    description: 'Asphalt patching and pothole repair for driveways, parking lots and roads in Longview and East Texas. We cut out the failed area, fix the base and patch with hot mix.',
    intro: [
      'A pothole is a base problem that finally showed up on top. Filling the hole buys you a few months. We cut out the failed area square, fix the base underneath, and patch it with hot mix so it stays fixed.',
    ],
    includes: [
      'Saw-cut or squared edges around the failed area',
      'Removal of broken asphalt and wet or soft base',
      'New compacted base where needed',
      'Hot mix patch, rolled flush with the surrounding pavement',
    ],
    signs: {
      heading: 'Fix it soon if',
      items: [
        'A pothole is growing or holding water',
        'One area is sinking or pumping mud after rain',
        'Edges are breaking off where vehicles turn',
      ],
    },
    faqs: [
      { q: 'Is there a minimum for small repairs?', a: 'Small jobs still take a crew, a truck and hot mix, so there is a minimum. Tell us what you have and we will give you an honest number before we roll out.' },
      { q: 'Can you patch in the winter?', a: 'Most days in East Texas, yes. Hot mix needs reasonable temperatures and dry ground, so we watch the weather and schedule around it.' },
    ],
    instantQuote: false,
  },
  {
    slug: 'sealcoating',
    name: 'Sealcoating',
    group: 'Upkeep',
    line: 'A protective coat that slows sun and water damage and brings back the black.',
    title: 'Asphalt sealcoating in Longview and East Texas',
    description: 'Driveway and parking lot sealcoating in Longview and East Texas. Slows oxidation and water intrusion and makes old asphalt look new again.',
    intro: [
      'East Texas sun dries asphalt out and rain works into every crack. Sealcoat is a protective layer that slows both down. It also turns faded gray pavement black again, which makes fresh striping stand out.',
      'Sealcoat protects good pavement. It does not fix pavement that is already broken, so we fill cracks and patch first.',
    ],
    includes: [
      'Cleaning the surface so the sealer bonds',
      'Crack filling and patching before sealing',
      'Sealer applied evenly edge to edge',
      'Restriping for parking lots',
    ],
    signs: {
      heading: 'Your pavement is ready for sealcoat when',
      items: [
        'The surface has faded from black to gray',
        'Small cracks are starting to show',
        'It has been a few years since it was last sealed',
      ],
    },
    faqs: [
      { q: 'How often should asphalt be sealed?', a: 'It depends on sun and traffic. Most pavement benefits from a fresh coat every few years. We look at yours and tell you whether it needs it yet.' },
      { q: 'What does a seal coat cost?', a: 'Enter the size in the price tool and pick Seal coat. You see a price range for each kind of sealer we put down, how long each one lasts and how it works. No name or phone number is needed to see it.' },
      { q: 'Can you seal brand new asphalt?', a: 'New asphalt needs time to cure before it is sealed. We let you know when yours is ready.' },
    ],
    instantQuote: true,
  },
  {
    slug: 'crack-filling',
    name: 'Rubber crack filling',
    group: 'Upkeep',
    line: 'Hot rubber that seals cracks and keeps water out of the base.',
    title: 'Hot rubber crack filling in East Texas',
    description: 'Hot rubber crack filling for asphalt driveways, parking lots and roads in Longview and East Texas. Seals cracks before water reaches the base.',
    intro: [
      'Every crack is a way in for water, and water in the base is what turns a crack into a pothole. We clean the cracks out and fill them with hot rubber that flexes with the pavement through heat and cold.',
      'It is the cheapest work you can do on asphalt, and it protects the most expensive part.',
    ],
    includes: [
      'Cleaning cracks of dirt and weeds',
      'Hot-applied rubber crack filler',
      'Often paired with sealcoating for a full reset',
    ],
    signs: {
      heading: 'Fill cracks when',
      items: [
        'You can see single cracks running across or along the pavement',
        'Weeds are growing up through the surface',
        'You are planning to sealcoat',
      ],
    },
    faqs: [
      { q: 'Which cracks can be filled?', a: 'Single cracks fill well. Areas cracked in a tight web usually mean the base has failed, and those need to be cut out and patched instead.' },
    ],
    instantQuote: false,
  },
  {
    slug: 'striping',
    name: 'Striping and marking',
    group: 'Upkeep',
    line: 'Stalls, ADA spaces, fire lanes, arrows and numbering.',
    title: 'Parking lot striping and marking in East Texas',
    description: 'Parking lot striping in Longview and East Texas: stalls, ADA spaces, fire lanes, arrows and numbering. New layouts and restripes.',
    intro: [
      'Clear lines make a lot safer, fit more cars and keep you on the right side of fire and accessibility rules. We lay out and stripe new lots and restripe faded ones.',
    ],
    includes: [
      'Parking stalls and drive lanes',
      'ADA accessible spaces and markings',
      'Fire lanes and curbs',
      'Arrows, stop bars, numbering and stencils',
    ],
    signs: {
      heading: 'Restripe when',
      items: [
        'Lines are faded enough that people park crooked',
        'You just sealcoated or paved',
        'The layout no longer fits how the lot is used',
      ],
    },
    faqs: [
      { q: 'Do you stripe lots you did not pave?', a: 'Yes. We restripe existing lots and can pair it with sealcoating so the whole lot looks new.' },
    ],
    instantQuote: false,
  },
  {
    slug: 'road-base-grading',
    name: 'Road base and grading',
    group: 'Dirt work',
    line: 'Crushed limestone base, grading and drainage that make pavement last.',
    title: 'Road base and grading in Longview and East Texas',
    description: 'Road base, grading and drainage work in Longview and East Texas. Crushed limestone base, washout repair and regrading for driveways, lots and roads.',
    intro: [
      'Base and drainage decide how long pavement lasts. We regrade drives and lots, repair washouts, and place and compact crushed limestone so the surface on top has something solid to sit on.',
      'Not ready for asphalt yet? A well-built rock drive is a big step up from dirt, and it is ready to pave later.',
    ],
    includes: [
      'Regrading for drainage and a smooth ride',
      'Washout and rut repair',
      'Crushed limestone base, hauled, placed and compacted',
      'Rock driveways and pads',
    ],
    signs: {
      heading: 'You need base work when',
      items: [
        'The drive washes out after heavy rain',
        'There are ruts, soft spots or standing water',
        'You are getting ground ready to pave',
      ],
    },
    faqs: [
      { q: 'How is rock priced?', a: 'By the dump truck load, plus the work to place and compact it. The quote tool estimates loads from the size of the area that needs it.' },
      { q: 'Does every paving job need base work?', a: 'No. Solid, well-drained ground or an existing packed gravel drive may need very little. Washouts, soft spots and bad drainage do need to be fixed first, or the new asphalt will fail in the same places.' },
    ],
    instantQuote: false,
  },
  {
    slug: 'dirt-work',
    name: 'Dirt work',
    group: 'Dirt work',
    line: 'Dozer, backhoe and skid steer work with our own dump trucks.',
    title: 'Dirt work in Longview and East Texas',
    description: 'Dirt work in Longview and East Texas with our own dozer, backhoe, skid steer and dump trucks. Site prep, grading, fill, tear-outs and haul-off.',
    intro: [
      'We own the iron: dozer, backhoe, skid steer and two dump trucks. That means we can clear, cut, fill and haul without waiting on someone else, whether the job ends in asphalt or not.',
    ],
    includes: [
      'Site prep and rough grading',
      'Cut and fill, building up low areas',
      'Tear-out and haul-off of old pavement',
      'Hauling rock, base and fill material',
      'Drainage shaping and ditch work',
    ],
    signs: {
      heading: 'Typical jobs',
      items: [
        'Getting a site ready for a driveway, lot or building pad',
        'Fixing drainage that sends water where you do not want it',
        'Building up or cutting down ground to grade',
      ],
    },
    faqs: [
      { q: 'Do you do oilfield lease roads and pads?', a: 'Our sister company, A&H Lease Services, handles oilfield lease roads, pads and location maintenance.' },
      { q: 'Can I get a quote online for dirt work?', a: 'Dirt work depends too much on the ground to price from a form. Call or send us the details and we will come look at it.' },
    ],
    instantQuote: false,
  },
];

export const groups: Service['group'][] = ['Asphalt', 'Upkeep', 'Dirt work'];
export const getService = (slug: string) => services.find((s) => s.slug === slug);
