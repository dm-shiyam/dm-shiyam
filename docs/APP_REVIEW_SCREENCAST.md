# Meta App Review — Screencast Script

**Target duration:** 2:45–3:15 minutes
**Recording tool:** QuickTime, OBS, Loom (any 1080p screen recorder)
**Aspect ratio:** 16:9, 1920×1080 or better
**Audio:** Optional — narrate in English OR add on-screen captions. Meta accepts both.
**Reuse:** Upload **this same video** to every permission request. Meta reviewers accept a single video that demonstrates all requested permissions in one natural flow.

---

## Permissions covered by this video

| Permission | Where in the video |
|---|---|
| `instagram_business_basic` | Scene 2 (OAuth connect) |
| `pages_show_list` | Scene 2 (Facebook page selection) |
| `instagram_business_manage_comments` | Scene 4 (webhook receives comment → public reply posts) |
| `instagram_business_manage_messages` | Scene 4 (Private Reply DM arrives in commenter's inbox) |
| `business_management` *(if requested)* | Scene 2 (Business account selection screen) |

---

## Pre-recording checklist

Before you hit record, prepare **two Instagram accounts** you own:

- **Account A** (the "creator"): The IG Business account that will connect to DM Shiyam. Must be a Business or Creator account linked to a Facebook Page.
- **Account B** (the "commenter"): A regular personal IG account that will post the trigger comment. Log into Account B on a **different device or browser profile** so you can screen-record its inbox in Scene 5.

Also prepare:

- A **test post/reel on Account A** with a caption inviting comments (e.g. "Comment 'INFO' below and I'll DM you the details").
- One **automation already created** in DM Shiyam with:
  - Trigger keyword: `info`
  - DM template: `Hi {{username}}! Here's the info you asked for: https://dm-shiyam.vercel.app`
  - Public comment reply enabled: `Sent you a DM! Check your inbox 📩`

Have a **fresh account** ready to demonstrate signup, OR delete `dmshiyamofficial@gmail.com` from Neon beforehand so you can re-run signup live.

---

## Shot list — narration in *italics*

### Scene 1 · Homepage & signup (0:00–0:25)

**Show:** https://dm-shiyam.vercel.app

*"This is DM Shiyam — an Instagram automation tool that lets creators automatically DM users who comment a keyword on their posts."*

- Scroll the landing page briefly (5s)
- Click **"Get Started"** or **"Sign Up"**
- Enter test email + password → click **Sign up**
- Land on the empty dashboard

*"After signing up, users land on their dashboard. To do anything useful, they need to connect their Instagram Business account."*

---

### Scene 2 · Connect Instagram (0:25–0:55) — **[proves `instagram_business_basic` + `pages_show_list`]**

**Show:** Dashboard → click **"Connect Instagram"** button

*"When the user clicks Connect Instagram, they're taken to Meta's official OAuth consent screen."*

- The browser navigates to `facebook.com/dialog/oauth` (Meta's own domain — visible in URL bar)
- **[If two-factor required, complete it]**
- Consent screen shows the permissions being requested — *pause here for 3 seconds so reviewers can see the exact permission list*
- Select the **Facebook Page** linked to Account A
- Select the **Instagram Business account** to connect
- Click **Continue** / **Allow**
- Browser redirects back to DM Shiyam dashboard

*"The user grants permission, selects which Facebook Page and Instagram account to connect, and we're redirected back to DM Shiyam. The Instagram account is now linked."*

- Show the dashboard now displaying the connected Instagram username

---

### Scene 3 · Create an automation (0:55–1:20)

**Show:** Dashboard → **"Create Automation"**

*"Now the creator sets up an automation. They pick a trigger keyword, write the DM template, and optionally add a public comment reply."*

- Fill in the form:
  - Name: `Info Request Auto-Reply`
  - Trigger keyword: `info`
  - DM template: `Hi {{username}}! Here's the info you asked for: https://dm-shiyam.vercel.app`
  - Public reply toggle: **ON**
  - Public reply text: `Sent you a DM! Check your inbox 📩`
- Click **Save**
- Show the automation now listed as **Active** on the dashboard

*"The automation is now live. Any comment containing the word 'info' on my Instagram posts will trigger this."*

---

### Scene 4 · Trigger the automation (1:20–2:10) — **[proves `instagram_business_manage_comments`]**

**Show:** Instagram app or web on the **second device** (Account B)

*"Let me now switch to a different Instagram account — this is a real user who's about to comment on my post."*

- Navigate to the test post/reel from Account A
- Tap the comment box, type: **`info`**
- Post the comment
- **[Wait 3-5 seconds]**
- The **public reply** from Account A appears under the commenter's comment: *"Sent you a DM! Check your inbox 📩"*

*"Within seconds, DM Shiyam's webhook receives the comment, matches the keyword, and posts the public reply on my behalf. Notice how the reply appears immediately."*

**Optional B-roll:** Split-screen or picture-in-picture of the DM Shiyam **Activity Log** page showing the new event: *"Comment received from @[username] → DM sent → Reply posted."*

---

### Scene 5 · Verify the DM arrived (2:10–2:35) — **[proves `instagram_business_manage_messages`]**

**Show:** Still on Account B's device — open Instagram Direct inbox

*"On the commenter's phone, a direct message has just arrived from my Instagram account, sent via Meta's Private Replies API."*

- Show the DM in Account B's inbox from Account A
- Open the DM — display the message body: *"Hi [username]! Here's the info you asked for..."*
- Highlight the **timestamp** — matches the comment time within seconds

*"This is exactly what DM Shiyam is built for: turning public comments into private, timely DMs — an approved use of Meta's Private Replies API."*

---

### Scene 6 · Data control + deletion (2:35–3:00)

**Show:** Back to DM Shiyam dashboard on the original device

*"Users have full control over their data. They can pause any automation, delete it, and remove their Instagram connection at any time."*

- On the dashboard, click **pause/delete** on the automation → confirm it disappears
- Click **Disconnect Instagram** → confirm the account is removed from the dashboard

*"When a user disconnects, we immediately delete their Instagram access token. Users can also request full data deletion via our data-deletion endpoint at any time, per Meta's requirements."*

- **Briefly show** https://dm-shiyam.vercel.app/privacy → scroll to the "Sub-processors" section (proves you have a compliant privacy policy)

---

### Scene 7 · Close (3:00–3:15)

*"That's DM Shiyam — a comment-to-DM automation platform built on Meta's official APIs, with a clear privacy policy, sub-processor disclosures, and a data-deletion pathway for every user."*

- End on the homepage or dashboard logo — hold 2 seconds — fade out

---

## Recording tips

- **Zoom the browser to 110–125%** before recording — reviewers watch on smaller screens
- **Enlarge the mouse cursor** in OS settings so it's easy to follow
- **Trim dead air** — anything longer than 2 seconds of silence should be cut
- **Add on-screen text captions** for each scene name (e.g. "Scene 2: Connect Instagram") — this is what pushes rejection risk down the most, because reviewers can skim to the exact permission being tested
- **Do not blur the Meta OAuth screen** — reviewers need to see the exact permissions being consented to
- **Do blur** anything that isn't relevant (other tabs, personal notifications)
- **Do not use production customer data** — use your own test accounts throughout

## After recording

1. Export as **`.mp4` (H.264)**, under **100 MB** if possible (Meta's upload limit)
2. Test playback in a fresh browser tab to confirm audio + video sync
3. Upload the same file to each permission's "Screencast" upload field in App Review
4. In the **Reviewer Instructions** text box for each permission, paste:

   > See the attached screencast. This permission is demonstrated at Scene [N] of the video.
   > Test IG account: [Account A username]
   > Test commenter account: [Account B username]
   > Reproduce: sign up on https://dm-shiyam.vercel.app → connect Instagram → create automation with keyword `info` → comment `info` on any post of the connected account → DM + reply arrive within 5 seconds.

## Common rejection reasons this script avoids

| Reviewer complaint | How this script solves it |
|---|---|
| "We couldn't see the permission being used" | Each scene explicitly maps to a permission; caption them on-screen |
| "Video shows dev environment, not production" | Recording is on `dm-shiyam.vercel.app`, the real production URL |
| "Use case is unclear" | Scene 1 opens with a plain-English pitch of what the app does |
| "No way for users to control their data" | Scene 6 explicitly demonstrates pause / delete / disconnect / privacy policy |
| "OAuth consent screen not shown" | Scene 2 shows the Meta consent dialog end-to-end with the permission list visible |
