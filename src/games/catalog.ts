// The games at cghoperations.com/games: names, what each one teaches, and the lesson shown before
// every level. Change the wording here and it changes on the Games pages and inside the games.
// (How each level plays, such as speed and difficulty, lives in that game's own file in this folder.)
//
// The lessons are real jobsite practice in plain words. Colton should read them the same way he reads
// the training lessons in the app: if CGH does something differently, change the sentence here.

export interface Level { name: string; lesson: string }
export interface Game {
  id: 'haul' | 'paver' | 'roller' | 'math' | 'back' | 'skid' | 'patch' | 'flag';
  /** The job photo behind this game's card and page header (a file in public/img/work, without .webp). */
  photo: string;
  slug: string;
  name: string;
  machine: string;
  tagline: string;
  blurb: string;
  how: string[];
  teaches: string[];
  levels: Level[];
}

// Stars earned across all eight games decide the rank shown on the Games page (192 stars possible).
export const RANKS = [
  { stars: 0, name: 'Greenhorn' },
  { stars: 10, name: 'Laborer' },
  { stars: 36, name: 'Operator' },
  { stars: 76, name: 'Lead hand' },
  { stars: 124, name: 'Foreman' },
  { stars: 172, name: 'Superintendent' },
];

export const games: Game[] = [
  {
    id: 'haul',
    photo: 'dump-truck-and-roller',
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
    photo: 'leeboy-paver-laying-hot-mix',
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
    photo: 'roller-compacting-new-driveway',
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
    photo: 'road-entrance-apron-finished',
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
  {
    id: 'back',
    photo: 'paving-crew-with-leeboy-paver',
    slug: 'back-it-in',
    name: 'Back It In',
    machine: 'Dump truck',
    tagline: 'Back up to the paver without a scratch.',
    blurb: 'The paver is waiting on mix and you are the truck. Back through the yard, miss the cones and the crew, and stop with your tailgate lined up just short of the hopper.',
    how: ['Hold REV to back up and FWD to pull ahead. Hold the arrows to turn the wheel; it stays where you leave it.', 'Stop inside the dashed box, just short of the paver. The spotter calls the distance.', 'Do not touch cones, fresh mat or the paver. If a person is behind you, stop.'],
    teaches: ['Backing slow and watching your spotter', 'Stopping short so the paver picks up the truck', 'Getting out to look when it is tight', 'Never backing up with someone behind you'],
    levels: [
      { name: 'Straight Back', lesson: 'Back up slow and stop a few feet short of the paver. The paver comes forward and picks up the truck. The truck never bumps the paver.' },
      { name: 'Line It Up', lesson: 'Get the truck lined up before you are close. Small steering moves made early beat big ones made late.' },
      { name: 'Around the Corner', lesson: 'Use both mirrors and your spotter. If you lose sight of the spotter, stop until you can see them again.' },
      { name: 'Cone Alley', lesson: 'When it is tight, get out and look. A minute on foot is cheaper than a fender.' },
      { name: 'People Behind You', lesson: 'Never back up with someone behind the truck. Stop, wait, and make sure they see you before you move.' },
      { name: 'Fresh Mat', lesson: 'Keep your tires off the fresh mat. Tire marks in hot asphalt do not come out.' },
      { name: 'Pull Up and Try Again', lesson: 'A bad angle does not fix itself. Pull forward, straighten out and back in again.' },
      { name: 'Busy Site', lesson: 'The backup alarm does not clear the way for you. The driver is responsible for what is behind the truck.' },
    ],
  },
  {
    id: 'skid',
    photo: 'base-repair-cut-out',
    slug: 'dirt-dash',
    name: 'Dirt Dash',
    machine: 'Skid steer',
    tagline: 'Scoop it, haul it, load the truck.',
    blurb: 'There is dirt to move and a truck to fill. Run the skid steer from pile to truck against the clock, and keep it away from the crew and off the utility flags.',
    how: ['Hold your finger where you want to drive (or use the arrow keys).', 'Drive into a dirt pile to fill the bucket, then drive up to the side of the truck to dump it.', 'Stay away from people and off the flag lines. Fill the truck before the clock runs out.'],
    teaches: ['Knowing where every person is around a moving machine', 'What the colored utility flags mean', 'Calling 811 before digging', 'A full bucket is slower than an empty one'],
    levels: [
      { name: 'First Bucket', lesson: 'A skid steer turns fast and has blind spots all the way around. Know where every person is before you move.' },
      { name: 'Loaded Is Slower', lesson: 'Carry a full bucket low and slow. The higher and faster you carry it, the easier the machine tips.' },
      { name: 'Call Before You Dig', lesson: 'Call 811 a few days before any digging. The utilities come out and mark their lines for free.' },
      { name: 'Red and Yellow', lesson: 'Red flags and paint mark electric lines. Yellow marks gas and oil. Stay off both.' },
      { name: 'Blue, Green, Orange', lesson: 'Blue marks water. Green marks sewer. Orange marks phone and internet lines.' },
      { name: 'Mud', lesson: 'Soft ground and mud take your traction. Go around when you can, and never spin your way through.' },
      { name: 'People Move', lesson: 'People on a job site do not stand still. If someone walks toward your machine, stop until they are clear.' },
      { name: 'Fill the Truck', lesson: 'Load the truck evenly and do not heap it past the sides. What falls off on the road is on us.' },
    ],
  },
  {
    id: 'patch',
    photo: 'compacting-asphalt-patch',
    slug: 'pothole-patrol',
    name: 'Pothole Patrol',
    machine: 'Patching crew',
    tagline: 'Fix it right before the next car hits it.',
    blurb: 'Potholes keep opening up in a busy parking lot and there is a car headed for every one. Tap the tools in the right order to patch each hole before the car gets there.',
    how: ['A pothole lights up. Tap the tools in the right order to fix it.', 'The wrong tool costs you time. A car that hits an open pothole is a strike.', 'Tap another pothole to work on it first. Three strikes and you are done.'],
    teaches: ['The five steps of a patch that lasts', 'Why a hole gets cut square and cleaned out', 'What tack coat is for', 'Packing the patch so it does not sink'],
    levels: [
      { name: 'Clean, Fill, Pack', lesson: 'A patch is only as good as what is under it. Clean the hole out, fill it, and pack it down.' },
      { name: 'Pick Up the Pace', lesson: 'Loose rock and water left in the hole keep new mix from holding. Clean it down to solid ground every time.' },
      { name: 'Tack Coat', lesson: 'Tack is the sticky black coat sprayed in the hole before the mix. It glues the new asphalt to the old.' },
      { name: 'Cut It Square', lesson: 'Cut the edges back square to solid pavement. Straight sides hold a patch in. Crumbling edges let it pop out.' },
      { name: 'The Whole Job', lesson: 'Cut, clean, tack, fill, pack. Skip a step and you will be back fixing the same hole.' },
      { name: 'Mixed Up', lesson: 'Know the steps by heart, not by where the tools happen to sit on the truck.' },
      { name: 'A Little High', lesson: 'Fill the hole a little high. The compactor packs it down level with the pavement around it.' },
      { name: 'Rush Hour', lesson: 'Work the hole with traffic coming first. Cones and a lookout keep the crew safe while they do it.' },
    ],
  },
  {
    id: 'flag',
    photo: 'driveway-entrance-after',
    slug: 'stop-slow',
    name: 'Stop / Slow',
    machine: 'Flagger',
    tagline: 'One lane, two directions, your call.',
    blurb: 'The crew has one lane closed, so traffic from both directions has to share the other. You hold the paddles. Keep the cars moving, keep the lines short, and never let two directions into the lane at once.',
    how: ['Tap the top half of the screen to flip the top paddle, the bottom half for the bottom paddle.', 'Let one side go, stop it, wait for the lane to empty, then let the other side go.', 'Do not let a line get too long. Trucks and ambulances need the lane cleared for them.'],
    teaches: ['How a STOP / SLOW paddle works', 'Never releasing traffic into a lane that is not empty', 'Taking turns so nobody waits too long', 'Clearing the way for trucks and emergency vehicles'],
    levels: [
      { name: 'Stop and Slow', lesson: 'The paddle says STOP on one side and SLOW on the other. Drivers do what the paddle says, so be sure before you turn it.' },
      { name: 'Clear the Lane', lesson: 'Never release traffic until the last car from the other side is all the way out of the lane.' },
      { name: 'Be Fair', lesson: 'Take turns. A driver who waits too long gets impatient, and impatient drivers do dangerous things.' },
      { name: 'Both Sides Busy', lesson: 'Stand where drivers can see you from far off, wear your vest, and never turn your back on traffic.' },
      { name: 'Truck Coming Out', lesson: 'When a truck needs out of the work zone, stop both sides first. The truck moves only when the road is yours.' },
      { name: 'Lunch Rush', lesson: 'Two flaggers have to agree before anyone moves. Use the radio or clear hand signals, never a guess.' },
      { name: 'Sirens', lesson: 'Emergency vehicles go first. Clear the lane and wave them through as soon as it is safe.' },
      { name: 'Friday at Five', lesson: 'Stay calm when the lines get long. A safe work zone matters more than a fast one.' },
    ],
  },
];

export const bySlug = (slug: string) => games.find((g) => g.slug === slug);
