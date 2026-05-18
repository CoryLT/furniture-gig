# FlipWork — Marketplace Roadmap

_Last updated: May 18, 2026_

This is the to-do list to take FlipWork from "working prototype" to "real marketplace people can actually use."

---

## What's already working ✅

- Signup / login / unified login (anyone can post OR claim gigs)
- Unified profile editing at `/profile`
- Unified public profile at `/u/[username]` with Instagram-style gallery
- Post a gig (with photos)
- Edit a gig (with photos)
- Browse gigs (with city/state filter) — own posted gigs filtered out
- Claim a gig (exclusive — only one worker per gig; users can't claim their own)
- "My Gigs" workflow: checklist + photo uploads + submit for review
- Admin review flow
- Payouts tracking (manual PayPal)
- Photo galleries on profiles
- **Messaging** — realtime chat per gig, typing indicators, read receipts, inbox at `/messages`, unread badge in nav

---

## What's missing to be a real marketplace

### Bucket 1 — Must-have (can't launch without these)

1. **Notifications** — Right now if someone claims your gig or finishes the work, you have no idea unless you log in and check. At minimum: email notifications for "your gig was claimed," "work was submitted for review," "you were approved/rejected," "you got paid." (In-app messaging already notifies via the realtime unread badge, but emails are still needed for people who aren't logged in.)

2. ~~**Messaging between flipper and worker**~~ — ✅ DONE. Realtime chat per gig with typing indicators, read receipts, inbox, and nav badge.

3. **Address / pickup details on gigs** — Right now gigs only have a city/state, not the actual address. You'd want the address visible only to the worker after they claim.

4. **Ratings / reviews** — After a gig completes, both sides rate each other. This is what builds trust on a marketplace.

5. **Terms of Service + privacy policy** — Legal pages everyone has to agree to before using.

6. **Application/approval flow (replaces claim flow)** — Currently first worker to click "Claim" gets the gig with no flipper say. Cory wants to switch this to: workers APPLY, flipper reviews applicants, flipper picks one. Other applicants get rejected. This is a meaty refactor — see the handoff doc section on this. Decisions already made by Cory: (a) messaging stays gig-tied only, opens after a worker is approved (not before — clean inbox preference TBD), (b) TBD whether applicants see how many others applied.

### Bucket 2 — Should-have (launch could happen without these but it'd feel rough)

7. **Search / better filtering on gigs** — Filter by pay range, distance, furniture type, date range.

8. **Worker skills / preferences** — Right now skills exist as a field but they're not used to recommend gigs or filter.

9. **Cancellation flow** — What if a worker claims but then can't do it? Right now they're stuck. Need a "release this gig" button. (Less urgent once application flow lands — flipper can just pick someone else.)

10. **Disputes** — What if a worker submits work that doesn't meet the bar? Right now admin (you) makes the call. Should there be a back-and-forth dispute resolution path?

11. **Onboarding flow improvements** — First-time flippers / first-time workers need a guided tour.

### Bucket 3 — Nice-to-have (post-launch)

12. **Saved/favorited gigs** — workers can bookmark gigs they want to claim later
13. **Recurring gig templates** — flippers who post the same kind of work often
14. **Worker availability calendar** — "I can work Mon–Wed this week"
15. **Public marketplace stats** — "X gigs completed this month" for trust
16. **Mobile app** — eventually

---

## Recommended build order (for a real launch)

1. ~~**Messaging** (#2)~~ — ✅ DONE
2. **Application/approval flow (#6)** — fundamentally changes the claim model, so do this BEFORE address/ratings since both depend on the claim relationship
3. **Address/pickup details on gigs (#3)** — paired with messaging, only visible after approval
4. **Email notifications (#1)** — even just simple "you got a gig" emails
5. **Ratings/reviews (#4)** — builds trust before adding more users
6. **Terms of Service (#5)** — required before letting anyone real sign up

After those, you'd have a real, defensible, trustworthy marketplace. Everything else is improvements on top.
