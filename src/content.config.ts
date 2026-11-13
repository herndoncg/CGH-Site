import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Blog posts live in src/content/blog/<slug>.md. The file name becomes the address: my-post.md -> /blog/my-post
// Make (or the content portal) publishes a post by adding one markdown file with this front matter:
//
// ---
// title: "Post title"
// description: "One or two sentences for Google and social previews."
// date: 2026-11-12
// category: "Driveways"     # Driveways | Parking lots | Roads | Upkeep | Dirt work | Company
// image: "/img/blog/xyz.webp"   # optional
// imageAlt: "What the photo shows" # optional
// draft: false               # optional; true hides it
// ---
const opt = z.string().optional().transform((v) => (v && v.trim() ? v.trim() : undefined));
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    category: z.string().optional().transform((v) => (v && v.trim() ? v.trim() : 'Upkeep')),
    image: opt,
    imageAlt: opt,
    author: z.string().optional().transform((v) => (v && v.trim() ? v.trim() : 'CGH Operations')),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
