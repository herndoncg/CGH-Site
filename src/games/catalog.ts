// The games at cghoperations.com/games: names, what each one teaches, and the lesson shown before
// every level. Change the wording here and it changes on the Games pages and inside the games.
// (How each level plays, such as speed and difficulty, lives in that game's own file in this folder.)
//
// The lessons are real jobsite practice in plain words. Colton should read them the same way he reads
// the training lessons in the app: if CGH does something differently, change the sentence here.

export interface Level { name: string; lesson: string }
export interface Game {
  id: 'haul' | 'paver' | 'roller' | 'math';
  slug: string;
  name: string;
  machine: string;
  tagline: string;
  blurb: string;
  how: string[];
  teaches: string[];
  levels: Level[];
}

// Stars earned across all four games decide the rank shown on the Games page.
export const RANKS = [
  { stars: 0, name: 'Greenhorn' },
  { stars: 6, name: 'Laborer' },
  { stars: 20, name: 'Operator' },
  { stars: 40, name: 'Lead hand' },
  { stars: 64, name: 'Foreman' },
  { stars: 88, name: 'Superintendent' },
];

export const games: Game[] = [
  {
    id: 'haul',
    slug: 'haul-run',
    name: 'Haul Run',
    machine: 'Dump truck',
    tagline: 'Get the hot mix to the paver before it cools.',
    blurb: 'You are driving a loaded dump truck from the plant to the job. Dodge what is in the road, slow down where you are supposed to, and get there while the mix is still hot enough to lay.',
    how: ['Swipe left or right to change lanes (or use the arrow keys).', 'Hold the brake pedal to slow down for work zones and school zones.', 'Grab the green checks for points. Every hit and every slow mile costs heat.'],
    teaches: ['Looking far ahead and moving early in a heavy truck', 'Following distance and stopping room', 'Slowing down before a work zone, not in it', 'Why hot mix is on a clock, and why loads get tarped'],
    levels: [
      { name: 'First Load', lesson: 'Look far down the road, not at your hood. A loaded dump truck needs a lot more room to stop or change lanes than a pickup, so make your move early.' },
      { name: 'Rough Road', lesson: 'Potholes and washouts beat up the truck and shake rock off the load. Steer around them when it is safe, and tell the crew about bad spots on the haul route.' },
      { name: 'Traffic', lesson: 'Never ride a bumper. Loaded, a tandem dump truck can weigh more than 50,000 pounds. Leave a gap you could stop in.' },
      { name: 'Work Zone', lesson: 'Orange signs mean slow down before you get there, not once you are in it. In Texas, traffic fines double in a work zone when workers are present.' },
      { name: 'Cold Morning', lesson: 'Hot mix leaves the plant around 300 degrees. If it shows up too cold it will not pack down right, and the load can be turned away. Tarp it and do not waste time.' },
      { name: 'Rain', lesson: 'Wet roads make every stop longer. Slow down, brake early and leave even more room than usual.' },
      { name: 'School Run', lesson: 'School zones and work zones are the two places you never hurry. Check your speed before the sign, not after it.' },
      { name: 'Rush Hour', lesson: 'Smooth beats fast. The driver who gets every load there warm, with no tickets and no dents, is the one who keeps the paver moving.' },
    ],
  },
  {
    id: 'paver',
    slug: 'lay-the-mat',
    name: 'Lay the Mat',
    machine: 'Asphalt paver',
    tagline: 'Hold the line and keep the hopper fed.',
    blurb: 'You are on the paver. Follow the painted line down the driveway, keep mix in the hopper, and lay a mat with straight edges and no gaps.',
    how: ['Drag left and right to steer (or use the arrow keys). The paver steers slow, so start early.', 'Hold FEED to dump mix from the truck into the hopper. Let go before it runs over.', 'Stay between the lines. Gaps and spills cost you.'],
    teaches: ['Watching the line ahead instead of the screed behind', 'Never letting the hopper run empty', 'Why spilled mix in front of the paver makes bumps', 'Steady pace, early steering, straight edges'],
    levels: [
      { name: 'Straight Shot', lesson: 'Watch the line out in front of you, not the screed behind you. Small corrections made early keep the edge straight.' },
      { name: 'Feed the Hopper', lesson: 'Never let the hopper run empty between trucks. When the screed runs out of mix it drops and leaves a low spot you can feel in a car.' },
      { name: 'Easy Bend', lesson: 'Start your turn before the curve gets to you. A paver steers slow, so a late correction shows up as a wavy edge.' },
      { name: 'Do Not Spill', lesson: 'Mix spilled in front of the paver has to be shoveled up before the tracks ride over it. Every lump the tracks climb shows up as a bump in the mat.' },
      { name: 'S-Curve', lesson: 'Keep a steady pace. Every stop and start lets the screed settle and leaves a mark across the mat.' },
      { name: 'Thick Enough', lesson: 'Fresh mat goes down thicker than it will finish. Plan on about a quarter inch extra for every inch, because the roller packs it down.' },
      { name: 'Tight Drive', lesson: 'The truck stops short and lets the paver pick it up. A truck that bumps the paver shoves the screed and dents the mat.' },
      { name: 'The Long One', lesson: 'When you pave beside a strip that is already down, overlap it by about an inch so the joint seals tight.' },
    ],
  },
  {
    id: 'roller',
    slug: 'hot-roll',
    name: 'Hot Roll',
    machine: 'Roller',
    tagline: 'Pack it down while it is still hot.',
    blurb: 'The mat is down and it is cooling. Roll every strip the right number of times before the heat is gone, and never turn on hot asphalt.',
    how: ['The roller drives itself up and down the mat.', 'Tap the left or right side of the screen (or use the arrow keys) to move over one lane.', 'Only move over at the ends, off the hot mat. Turning on hot mat leaves a mark.'],
    teaches: ['Why asphalt has to be rolled while it is hot', 'Changing lanes off the mat, never on it', 'Counting passes and running a pattern', 'Rolling edges first, because they cool first'],
    levels: [
      { name: 'Breakdown Pass', lesson: 'Rolling is what makes asphalt last. The mat has to be packed while it is still hot, so the roller stays close behind the paver.' },
      { name: 'Do Not Turn on It', lesson: 'Never turn or stop on hot mat. Change lanes off the end, where it is already cool, or you leave a mark that never rolls out.' },
      { name: 'Count Your Passes', lesson: 'One trip down the mat is one pass. Every spot needs the same number of passes, so pick a pattern and stick to it.' },
      { name: 'Edges First', lesson: 'Edges and joints cool first. Roll them first, then work toward the middle.' },
      { name: 'Overlap', lesson: 'Overlap each lane by about six inches so no strip gets missed between passes.' },
      { name: 'Cold Wind', lesson: 'Wind, shade and cold ground steal heat fast. On a cold day there is less time to get your passes in.' },
      { name: 'Thin Lift', lesson: 'A thin layer cools much faster than a thick one. The thinner the lift, the closer the roller follows the paver.' },
      { name: 'Final Exam', lesson: 'Once the mat drops to about 175 degrees, more rolling does not help. Get your passes in while it is hot.' },
    ],
  },
  {
    id: 'math',
    slug: 'yardage-boss',
    name: 'Yardage Boss',
    machine: 'Tape measure',
    tagline: 'Measure it, figure it, order it right.',
    blurb: 'Every job starts with numbers. Figure square feet, rock, loads and tons against the clock, the same math our sales and crew use on a real driveway.',
    how: ['Read the job, then tap the right answer before the clock runs out.', 'Get it wrong and the game shows you how the math works.', 'Right answers in a row build a streak for bonus points.'],
    teaches: ['Square feet from length and width', 'Breaking odd shapes into pieces', 'Cubic yards of rock and whole truck loads', 'Tons of hot mix for a job'],
    levels: [
      { name: 'Square Feet', lesson: 'Length times width gives square feet. Measure in feet, and measure twice.' },
      { name: 'Odd Shapes', lesson: 'Break an odd shape into rectangles, figure each one, and add them up.' },
      { name: 'Square Yards', lesson: 'Nine square feet make one square yard. Some plans and suppliers work in square yards, so know how to switch.' },
      { name: 'Rock by the Yard', lesson: 'Rock is ordered by the cubic yard. Square feet times depth in inches, divided by 12, gives cubic feet. Divide that by 27 for cubic yards.' },
      { name: 'Whole Loads', lesson: 'Trucks only come in whole loads, so always round up. One load short and the whole crew stands around waiting.' },
      { name: 'Hot Mix Tons', lesson: 'Hot mix is ordered by the ton. Cubic feet times 145 pounds, divided by 2,000, gives tons.' },
      { name: 'Flares and Circles', lesson: 'A flare at the road is a triangle: half of the base times the height. A round turnaround is 3.14 times the radius times the radius.' },
      { name: 'Bid Day', lesson: 'A good estimate is fast and right. Ask yourself if the answer makes sense before you say it out loud.' },
    ],
  },
];

export const bySlug = (slug: string) => games.find((g) => g.slug === slug);
