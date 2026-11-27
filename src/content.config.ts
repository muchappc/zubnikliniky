import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const poradna = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/poradna' }),
  schema: z.object({
    title: z.string(),
    h1: z.string(),
    description: z.string(),
    perex: z.string(),
    published: z.coerce.date(),
    updated: z.coerce.date(),
    order: z.number().default(99),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
    sources: z.array(z.object({ title: z.string(), url: z.string() })).default([]),
  }),
});

export const collections = { poradna };
