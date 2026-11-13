// One place for business facts. Change a value here (or in the JSON files beside it,
// which the content portal edits) and it updates everywhere on the site.
import business from './business.json';
import reviewData from './reviews.json';
import workData from './work-photos.json';

const digits = business.phone.replace(/\D/g, '').slice(-10);

export const site = {
  name: 'CGH Operations',
  legalName: 'CGH Operations LLC',
  tagline: 'Christ. Community. CGH Operations.',
  // The motto from the CGH logo.
  motto: 'Rooted in Faith. Focused on Christ. Operating with Integrity for a Better Future.',
  url: 'https://cghoperations.com',
  phone: business.phone,
  phoneHref: 'tel:+1' + digits,
  phoneSchema: `+1-${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`,
  email: business.email,
  city: business.city,
  state: business.state,
  postalCode: business.postalCode,
  foundedYear: business.foundedYear,
  hours: business.hours,
  // Flip to true in the content portal ONLY once a policy is active. Turns on "Insured" site-wide.
  insured: business.insured,
  statesServed: business.statesServed,
  social: business.social,
  verse: business.verse,
  sister: business.sisterCompany,
  googleReviewLink: business.googleReviewLink,
  // Where the quote tool and job application send leads. '/' = Netlify Forms (the site's own host collects them
  // and emails Colton, same as the old site's forms). To use a Make webhook instead, paste its address here.
  formEndpoint: '/',
};

export const reviews: { quote: string; name: string; town: string; job: string }[] = reviewData;
export const workPhotos: { src: string; alt: string; caption: string }[] = workData;

import baData from './before-after.json';
export const beforeAfter: { title: string; before: string; after: string; beforeAlt: string; afterAlt: string; service: string }[] = baData;

// Which photo sits at the top of each service page (edit freely; leave a service out for no photo).
export const servicePhotos: Record<string, { src: string; alt: string }> = {
  'asphalt-driveways': { src: '/img/work/curved-asphalt-driveway-east-texas.webp', alt: 'Finished curved asphalt driveway in front of a new home' },
  'parking-lots': { src: '/img/work/compacting-asphalt-patch.webp', alt: 'Crew compacting new asphalt in a commercial parking lot' },
  'private-roads': { src: '/img/work/ranch-entrance-asphalt-drive.webp', alt: 'Long asphalt ranch drive behind a gate and cattle guard' },
  'asphalt-overlays': { src: '/img/work/long-curved-asphalt-drive.webp', alt: 'Long curved asphalt drive with a fresh surface' },
  'asphalt-repair': { src: '/img/work/parking-lot-patch-after.webp', alt: 'Square hot mix patch in a concrete and asphalt parking lot' },
  'road-base-grading': { src: '/img/work/base-repair-cut-out.webp', alt: 'Failed pavement cut out and base being rebuilt' },
  'dirt-work': { src: '/img/work/dump-truck-and-roller.webp', alt: 'CGH Operations dump truck and roller on a job site' },
};
