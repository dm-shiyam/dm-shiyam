# Landing-page screenshots

These power the hero preview + the "See it in action" proof section on the
public landing page (`src/components/LandingContent.tsx`).

If a file is missing, the component gracefully renders a styled placeholder
so the page always ships. Drop the real screenshots at the paths below and
they take over automatically — no code change needed.

| File                     | Where it renders                       | Suggested shot                                                                                          |
|--------------------------|----------------------------------------|---------------------------------------------------------------------------------------------------------|
| `hero-dashboard.png`     | Hero section, inside browser chrome    | Full-width shot of your DM Shiyam `/dashboard` with analytics/activity visible. ~16:9 aspect works best. |
| `01-comment.png`         | Proof step 1 ("A follower comments…")  | Phone screenshot of an Instagram Reel/post with the commenter dropping the trigger keyword.             |
| `02-dm.png`              | Proof step 2 ("DM Shiyam auto-sends…") | Phone screenshot of the auto-DM inside Instagram's DM thread — the "money shot" that proves it works.    |
| `03-reply.png`           | Proof step 3 ("They reply, you convert") | Phone screenshot of the follow-up where the commenter engages back, ideally a short back-and-forth.      |

## Tips for premium-looking shots

- **Phone shots**: 1170 × 2532 (iPhone 14) or similar. Portrait aspect
  renders inside the proof card's 9:16 frame without cropping.
- **Dashboard shot**: PNG, > 1600px wide. Crop to the active content area
  (header + stats + a few rows) — not a full retina screenshot with
  excessive whitespace.
- **PII**: blur or redact real follower handles / phone numbers / emails
  with a tool like [Figma](https://figma.com) or
  [cleanshot](https://cleanshot.com).
- **File size**: keep under 500 KB each — compress with
  [tinypng.com](https://tinypng.com) if needed. These load above the fold.

Shots live in `/public` so they're served directly from
`https://dmshiyam.com/screenshots/<file>.png` — same origin as the app,
no CDN dep.
