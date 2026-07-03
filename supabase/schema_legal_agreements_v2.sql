-- ============================================================
-- FlipWork — Terms of Service + Privacy Policy v2.0
-- ============================================================
-- WHY: v1.0 described the old two-sided marketplace (gig matching,
-- a buy/sell furniture marketplace, a 2% platform fee, and Stripe-held
-- escrow payments). FlipWork is now an operator-only SOFTWARE HUB:
-- a subscription tool one business operator uses to run a resale/flip
-- business. FlipWork does not run a marketplace, does not match or
-- employ workers, and never processes, holds, or transmits payments.
--
-- WHAT THIS SQL DOES (idempotent — safe to re-run):
--   1. Inserts Terms of Service v2.0 and Privacy Policy v2.0 (inactive).
--   2. Deactivates EVERY version of those two documents.
--   3. Activates only v2.0, so the site shows the new text.
--
-- NOTE: This is a good-faith rewrite to match the current product. It
-- is NOT legal advice and has not been reviewed by an attorney. Have a
-- North Carolina business/tech attorney review it before relying on it.
-- ============================================================

-- ------------------------------------------------------------
-- Step 1: Insert Terms of Service v2.0 (inactive for now).
-- ------------------------------------------------------------
insert into public.legal_agreements (title, version, content, required, active)
select 'Terms of Service', '2.0', $tos2$FLIPWORK TERMS OF SERVICE

Version 2.0
Effective Date: July 3, 2026

Operator: Groovy Greens, LLC, a North Carolina limited liability company, doing business as "FlipWork" ("FlipWork," "we," "us," or "our")
Contact: CoryThacker@proton.me
Website: https://myflipwork.com

--------------------------------------------------------------------
PLAIN-ENGLISH SUMMARY (not legally binding — read the full terms below)
--------------------------------------------------------------------

FlipWork is software that helps you run a resale/flipping business by
yourself. You use it to track the items you buy and resell, log what you
paid and what you spent, keep your books, scan receipts, keep a private
list of helpers you hire, and keep payment records. Here's the deal in
plain English:

  - You must be 18 or older and a U.S. resident to use FlipWork.
  - FlipWork is a tool, not a marketplace, staffing agency, bank, or
    payment service. We never hold, send, or process your money or
    anyone else's.
  - If you hire help, that is between you and them. FlipWork is not their
    employer and is not a party to your deal. You are responsible for
    paying them, for taxes and paperwork (like 1099s), and for following
    all worker and tax laws.
  - The bookkeeping, profit, and 1099 features are tools based on the
    numbers YOU enter. They are not accounting, tax, or legal advice.
  - FlipWork may cost money as a paid subscription. If you owe fees,
    they'll be described when you sign up for a paid plan.
  - Disputes are handled by binding arbitration under North Carolina law,
    and you waive class actions. Please read Section 15 carefully.

--------------------------------------------------------------------

1. ACCEPTANCE OF TERMS

1.1. These Terms of Service ("Terms") form a binding agreement between
you and Groovy Greens, LLC d/b/a FlipWork governing your access to and
use of the FlipWork website, applications, and services (collectively,
the "Service").

1.2. By creating an account, clicking to accept, or otherwise accessing
or using the Service, you agree to these Terms and to our Privacy Policy,
which is incorporated by reference. If you do not agree, do not use the
Service.

1.3. We may update these Terms from time to time. If we make material
changes, we will take reasonable steps to notify you (for example, by
posting the updated Terms with a new version number and effective date,
or by requiring you to re-accept). Your continued use of the Service
after an update takes effect means you accept the updated Terms.

2. ELIGIBILITY

2.1. You must be at least 18 years old, a resident of the United States,
and able to form a binding contract to use the Service. The Service is
intended for use in operating a lawful business.

2.2. You represent that all information you provide is accurate and that
you will keep it up to date.

2.3. The Service is intended for a single business operator and the
people that operator authorizes. You are responsible for all activity
under your account.

3. YOUR ACCOUNT

3.1. You are responsible for maintaining the confidentiality of your
login credentials and for all activity that occurs under your account.

3.2. You agree to notify us promptly of any unauthorized use of your
account. We are not liable for any loss arising from unauthorized use of
your account.

3.3. You may not share, sell, or transfer your account without our prior
written consent.

4. DESCRIPTION OF THE SERVICE

4.1. FlipWork is a software-as-a-service tool that helps a single
business operator manage a resale or "flipping" business. Features may
include, without limitation: tracking inventory items through stages
(sourced, in progress, listed, sold); logging purchase costs, materials,
and labor; a double-entry bookkeeping ledger; receipt scanning assisted
by artificial intelligence; a private roster of contractors or helpers
("crew"), including people who do not have a FlipWork account, together
with your private ratings and notes; tools that generate advertisement or
recruiting text you can copy and use elsewhere to find help; records of
amounts you have paid helpers, with automated informational reminders
about tax reporting thresholds (such as IRS Form 1099); and installable
app and notification features.

4.2. WHAT FLIPWORK IS NOT. FlipWork is a software tool only. FlipWork is
NOT, and does not act as: (a) a marketplace, auction, or platform for
buying or selling goods between users; (b) a staffing, employment, or
recruiting agency; (c) an employer, joint employer, or agent of you or
of anyone you hire; (d) a bank, money transmitter, payment processor, or
escrow service; (e) a bookkeeper, accountant, certified public
accountant, tax preparer, or tax advisor; or (f) a law firm or provider
of legal advice.

4.3. We may add, change, suspend, or remove features of the Service at
any time. Some features that appear in the code or interface may be
inactive, experimental, or reserved for future use.

5. NO PAYMENT PROCESSING

5.1. FlipWork does not process, hold, transmit, escrow, or facilitate any
payment between you and any worker, vendor, customer, or other third
party. FlipWork never takes custody of your funds or anyone else's.

5.2. Any payment you make to a helper, contractor, or vendor happens
entirely outside of FlipWork, using whatever method you choose (for
example, cash, Cash App, Venmo, or Zelle). FlipWork only records the
amounts and details that YOU enter for your own record-keeping.

5.3. Because FlipWork does not handle payments, we charge no transaction
fee or commission on any amount you pay or receive.

6. FEES AND SUBSCRIPTIONS

6.1. Access to the Service, or to certain features, may require a paid
subscription. If you subscribe to a paid plan, the price, billing period,
and features will be described at the time of purchase.

6.2. Unless stated otherwise, paid subscriptions renew automatically at
the end of each billing period at the then-current price until you
cancel. You may cancel at any time, effective at the end of the current
billing period.

6.3. Except where required by law, fees are non-refundable and partial
periods are not prorated. We may change our prices or plans on a
going-forward basis with reasonable notice. You are responsible for any
applicable taxes.

7. WORKERS, CONTRACTORS, AND CLASSIFICATION (IMPORTANT)

7.1. FlipWork helps you keep records about helpers you engage. It does
not hire, pay, supervise, or employ anyone. Any relationship between you
and a helper is solely between you and that person.

7.2. YOU ARE SOLELY RESPONSIBLE for correctly classifying anyone you
engage (for example, as an independent contractor or employee), for
paying them, for withholding and remitting any taxes, for issuing any
required tax forms (such as IRS Form 1099), for maintaining any required
agreements, insurance, or licenses, and for complying with all applicable
labor, wage, tax, and worker-classification laws.

7.3. Misclassifying a worker can carry serious legal and tax
consequences. FlipWork does not advise you on classification and makes no
representation that your practices comply with any law. You should
consult a qualified employment/tax attorney or accountant.

7.4. The tax-threshold reminders in the Service (for example, 1099
alerts) are automated, informational estimates based only on the amounts
you enter. Thresholds and tax rules change and may be inaccurate or
incomplete. They are not tax advice and are not a substitute for a
qualified professional.

8. NO PROFESSIONAL ADVICE

8.1. The bookkeeping, ledger, profit, expense, receipt-scanning, and
reporting features are informational tools. Their output depends entirely
on the accuracy and completeness of the information you enter, and on
third-party technology that may contain errors.

8.2. Nothing in the Service constitutes accounting, tax, financial, or
legal advice. You are responsible for verifying all figures and for your
own compliance, filings, and business decisions. Consult a qualified
professional before relying on any output.

9. ACCEPTABLE USE

9.1. You agree not to: (a) use the Service for any unlawful purpose or to
track, promote, or facilitate any unlawful activity, including the resale
of stolen, counterfeit, recalled, or illegally trafficked goods; (b)
upload content that infringes others' rights, is defamatory, or is
unlawful; (c) enter another person's information without a lawful basis
and any required notice or consent; (d) attempt to gain unauthorized
access to the Service or other users' data; (e) interfere with or
disrupt the Service, or probe, scan, or test its security; (f) reverse
engineer, scrape, or build a competing service from the Service; or (g)
misuse the artificial-intelligence features, including by submitting
content you have no right to submit.

9.2. We may investigate and take appropriate action, including removing
content and suspending or terminating accounts, for any suspected
violation.

10. YOUR CONTENT

10.1. "Your Content" means the information, images (such as photos of
items and receipts), records, and other materials you submit to the
Service. As between you and us, you retain ownership of Your Content.

10.2. You grant FlipWork a worldwide, non-exclusive, royalty-free license
to host, store, reproduce, process, and display Your Content solely to
operate, secure, support, and improve the Service and to provide it to
you. This license ends when you delete Your Content or your account,
except for content retained as required by law or in routine backups for
a limited period.

10.3. You represent and warrant that you have all rights necessary to
submit Your Content and to grant this license, including any rights or
consents needed to submit information about third parties (such as
helpers you list in your crew).

11. INTELLECTUAL PROPERTY

11.1. The Service, including its software, design, text, and logos
(excluding Your Content), is owned by FlipWork or its licensors and is
protected by intellectual-property laws. We grant you a limited,
revocable, non-transferable, non-exclusive license to use the Service for
your internal business purposes, subject to these Terms.

11.2. All rights not expressly granted are reserved.

12. THIRD-PARTY SERVICES

12.1. The Service relies on third-party providers to function, including
providers of hosting, database, authentication, and storage; email
delivery; image moderation; and artificial intelligence. Your use of the
Service may involve your data being processed by these providers as
described in our Privacy Policy.

12.2. We are not responsible for third-party services, websites, or
tools you choose to use in connection with your business. Your dealings
with them are solely between you and them.

13. SUSPENSION AND TERMINATION

13.1. You may stop using the Service and close your account at any time.

13.2. We may suspend or terminate your access, with or without notice, if
we reasonably believe you have violated these Terms, if required by law,
or to protect the Service or others.

13.3. Upon termination, your right to use the Service ends. Sections that
by their nature should survive (including Sections 5, 7, 8, 10.3, 11, 14,
15, 16, and 17) will survive.

14. DISCLAIMERS

14.1. THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT
WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING
ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
PURPOSE, TITLE, AND NON-INFRINGEMENT.

14.2. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE,
OR ERROR-FREE, THAT ANY CALCULATION, RECORD, SCAN, OR REMINDER WILL BE
ACCURATE OR COMPLETE, OR THAT THE SERVICE WILL MEET YOUR REQUIREMENTS OR
ENSURE YOUR COMPLIANCE WITH ANY LAW. YOU USE THE SERVICE AT YOUR OWN
RISK.

15. LIMITATION OF LIABILITY

15.1. TO THE MAXIMUM EXTENT PERMITTED BY LAW, FLIPWORK AND ITS OWNERS,
MEMBERS, AND AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOST
PROFITS, LOST DATA, TAX PENALTIES, OR BUSINESS LOSSES, ARISING OUT OF OR
RELATING TO THE SERVICE OR THESE TERMS, EVEN IF ADVISED OF THE
POSSIBILITY.

15.2. TO THE MAXIMUM EXTENT PERMITTED BY LAW, FLIPWORK'S TOTAL LIABILITY
FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THE SERVICE OR THESE TERMS
WILL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US FOR THE SERVICE
IN THE TWELVE MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM, OR (B)
ONE HUNDRED U.S. DOLLARS ($100).

15.3. Some jurisdictions do not allow certain limitations, so some of the
above may not apply to you.

16. INDEMNIFICATION

16.1. You agree to indemnify, defend, and hold harmless FlipWork and its
owners, members, and agents from and against any claims, damages,
liabilities, and expenses (including reasonable attorneys' fees) arising
out of or relating to: (a) Your Content; (b) your use of the Service; (c)
your engagement, payment, classification, or treatment of any worker or
contractor; (d) your business, tax filings, and legal compliance; (e)
information you enter about any third party; or (f) your violation of
these Terms or any law or the rights of another.

17. DISPUTE RESOLUTION — BINDING ARBITRATION AND CLASS ACTION WAIVER

17.1. PLEASE READ THIS SECTION CAREFULLY. IT AFFECTS YOUR LEGAL RIGHTS,
INCLUDING YOUR RIGHT TO FILE A LAWSUIT IN COURT AND TO HAVE A JURY TRIAL.

17.2. You and FlipWork agree that any dispute, claim, or controversy
arising out of or relating to the Service or these Terms will be resolved
by binding arbitration administered under the rules of a recognized
arbitration provider, rather than in court, except that either party may
bring an individual claim in small-claims court.

17.3. CLASS ACTION WAIVER. You and FlipWork agree that each may bring
claims against the other only in an individual capacity, and not as a
plaintiff or class member in any purported class or representative
proceeding. The arbitrator may not consolidate more than one person's
claims.

17.4. The arbitration will be seated in North Carolina, and North
Carolina law will govern, except that the Federal Arbitration Act governs
the interpretation and enforcement of this arbitration provision.

18. GOVERNING LAW

18.1. These Terms are governed by the laws of the State of North Carolina,
without regard to its conflict-of-laws rules. Subject to Section 17, the
state and federal courts located in North Carolina will have exclusive
jurisdiction over any matter not subject to arbitration.

19. GENERAL

19.1. These Terms, together with the Privacy Policy, are the entire
agreement between you and FlipWork regarding the Service.

19.2. If any provision is held unenforceable, the remaining provisions
will remain in effect, and the unenforceable provision will be modified
to the minimum extent necessary.

19.3. Our failure to enforce a provision is not a waiver. You may not
assign these Terms without our consent; we may assign them in connection
with a merger, acquisition, or sale of assets.

19.4. Notices to you may be sent to the email associated with your
account. Notices to us should be sent to the contact address below.

20. CONTACT

Questions about these Terms may be sent to:
Groovy Greens, LLC d/b/a FlipWork
Email: CoryThacker@proton.me
Website: https://myflipwork.com

--------------------------------------------------------------------
END OF TERMS OF SERVICE
--------------------------------------------------------------------$tos2$, true, false
where not exists (
  select 1 from public.legal_agreements
   where title = 'Terms of Service' and version = '2.0'
);

-- ------------------------------------------------------------
-- Step 2: Insert Privacy Policy v2.0 (inactive for now).
-- ------------------------------------------------------------
insert into public.legal_agreements (title, version, content, required, active)
select 'Privacy Policy', '2.0', $pp2$FLIPWORK PRIVACY POLICY

Version 2.0
Effective Date: July 3, 2026

Operator: Groovy Greens, LLC, a North Carolina limited liability company, doing business as "FlipWork" ("FlipWork," "we," "us," or "our")
Contact: CoryThacker@proton.me
Website: https://myflipwork.com

--------------------------------------------------------------------
PLAIN-ENGLISH SUMMARY (not legally binding — read the full policy below)
--------------------------------------------------------------------

FlipWork is software you use to run your flipping business. Most of the
information in FlipWork is information YOU type in about your own
business — the items you buy and sell, what you paid and spent, your
books, receipt photos, and a private list of helpers. Here's the short
version:

  - We collect the info you give us (your account and business details,
    your bookkeeping records, item and receipt photos, and notes about
    helpers you hire), plus basic technical data needed to run the app.
  - We use it to run the Service for you: keep your books, scan receipts,
    send you notifications, and provide support.
  - We use trusted providers to run the app (hosting, email, image
    checking, and AI). We do NOT sell your personal information.
  - Some things you upload (like receipt images and support messages) are
    processed by an AI provider to make features work.
  - You can access or delete your data by contacting us.
  - FlipWork is for adults (18+) running a business. It is not for
    children.

--------------------------------------------------------------------

1. WHO WE ARE

This Privacy Policy explains how Groovy Greens, LLC d/b/a FlipWork
collects, uses, and shares information in connection with the FlipWork
website, applications, and services (the "Service"). It applies to
information we process as part of providing the Service.

2. INFORMATION WE COLLECT

2.1. Account information. Your email address, a password (stored in
hashed form by our authentication provider), and a display name or
username.

2.2. Business profile information. Details you provide about your
business, which may include your business name, entity type, state, tax
identification number (such as an EIN), bank name, the bookkeeping tools
you use, and your setup status.

2.3. Business and financial records you enter. The information you input
to run your books, including ledger accounts and transactions, purchase
and sale prices, expenses, profit figures, and item details, as well as
images of receipts and the line items extracted from them.

2.4. Inventory content. Titles, stages, and photos of the items you
track.

2.5. Crew and helper information. Information you enter about people you
hire or may hire, which may include their names, your private ratings and
notes, whether you would rehire them, and a history of amounts you have
recorded paying them. This can include people who do NOT have a FlipWork
account ("name-only" contacts). See Section 6 about third-party
information.

2.6. Payment records. The amounts, dates, and names you record for
payments you make to helpers, used to produce your records and automated
tax-threshold reminders (such as 1099 alerts). FlipWork does not process
these payments; we only store what you enter.

2.7. Technical and usage data. Basic information needed to operate and
secure the Service, such as log data, device and browser information,
authentication cookies or local storage, and — if you enable
notifications — a push-notification token.

3. HOW WE USE INFORMATION

We use the information above to: (a) provide, operate, and maintain the
Service; (b) generate your ledgers, records, profit figures, and
automated reminders (including tax-threshold notifications); (c) send you
communications, including email and push notifications related to the
Service; (d) provide customer support, including an AI-assisted support
chat; (e) scan and read receipt images you upload; (f) moderate images
uploaded to the Service; and (g) secure, troubleshoot, analyze, and
improve the Service.

4. SERVICE PROVIDERS WE SHARE WITH

4.1. We use trusted third-party providers ("sub-processors") to run the
Service. They process information on our behalf and are permitted to use
it only to provide their services to us. These include providers of:

  - Hosting, database, authentication, and file storage;
  - Application hosting and delivery;
  - Email delivery (for notifications and account emails);
  - Image moderation (to screen uploaded images); and
  - Artificial intelligence (to power receipt scanning and the support
    chat), which means receipt images and support-chat messages may be
    sent to an AI provider for processing.

4.2. We may also disclose information if required by law or legal process,
to enforce our Terms, to protect the rights, safety, or property of
FlipWork or others, or in connection with a merger, acquisition, or sale
of assets (in which case we will require the recipient to honor this
Policy).

4.3. WE DO NOT SELL your personal information, and we do not share it for
cross-context behavioral advertising.

5. ARTIFICIAL INTELLIGENCE FEATURES

Certain features use AI. When you scan a receipt or use the support chat,
the content you submit is sent to our AI provider to generate a result.
AI output can be inaccurate or incomplete; you should verify it. Do not
submit information through these features that you do not want processed
by our AI provider.

6. INFORMATION ABOUT OTHER PEOPLE

FlipWork lets you record information about helpers, including people
without a FlipWork account. If you enter another person's information, you
are responsible for having any legal basis, notice, or consent required
to do so, and for using that information lawfully. As to the crew and
helper information you enter, you generally act as the party that decides
how it is used, and FlipWork processes it on your behalf to provide the
Service. If one of those individuals contacts us, we may refer them to
you or ask for your assistance in responding.

7. COOKIES AND SIMILAR TECHNOLOGIES

We use cookies and similar technologies (such as browser local storage)
that are necessary to keep you signed in and to operate the Service. We
do not use third-party advertising or cross-site tracking cookies.

8. DATA RETENTION

We retain information for as long as your account is active or as needed
to provide the Service, and afterward as needed to comply with legal
obligations, resolve disputes, and enforce our agreements. When you
delete content or close your account, we will delete or de-identify the
associated personal information within a reasonable period, except where
retention is required by law or exists in routine backups for a limited
time.

9. SECURITY

We use reasonable administrative, technical, and organizational measures
designed to protect information. However, no method of transmission or
storage is completely secure, and we cannot guarantee absolute security.

10. YOUR CHOICES AND RIGHTS

10.1. You may access, update, or delete much of your information directly
in the Service, or by contacting us at the email below. Depending on where
you live, you may have rights to access, correct, delete, or receive a
copy of your personal information, and to be free from discrimination for
exercising those rights.

10.2. You can turn notifications on or off in your account settings.

10.3. To make a request, contact us at the email below. We may need to
verify your identity before acting on a request.

11. CHILDREN'S PRIVACY

The Service is intended for adults (18 or older) operating a business. It
is not directed to children, and we do not knowingly collect personal
information from anyone under 18. If you believe a child has provided us
information, contact us and we will delete it.

12. UNITED STATES

The Service is operated in the United States and intended for U.S. users.
If you access it from elsewhere, you do so on your own initiative and are
responsible for compliance with local law.

13. CHANGES TO THIS POLICY

We may update this Policy from time to time. If we make material changes,
we will take reasonable steps to notify you, such as by posting the
updated Policy with a new version number and effective date. Your
continued use of the Service after an update takes effect means you
accept the updated Policy.

14. CONTACT

Questions or requests about this Privacy Policy may be sent to:
Groovy Greens, LLC d/b/a FlipWork
Email: CoryThacker@proton.me
Website: https://myflipwork.com

--------------------------------------------------------------------
END OF PRIVACY POLICY
--------------------------------------------------------------------$pp2$, true, false
where not exists (
  select 1 from public.legal_agreements
   where title = 'Privacy Policy' and version = '2.0'
);

-- ------------------------------------------------------------
-- Step 3: Deactivate every version of these two documents, then
-- activate ONLY v2.0. This makes the site show the new text and
-- keeps exactly one active version per title.
-- ------------------------------------------------------------
update public.legal_agreements
   set active = false, updated_at = now()
 where title in ('Terms of Service', 'Privacy Policy');

update public.legal_agreements
   set active = true, updated_at = now()
 where title in ('Terms of Service', 'Privacy Policy')
   and version = '2.0';

-- Done. Verify with:
--   select title, version, active, updated_at
--     from public.legal_agreements
--    where title in ('Terms of Service','Privacy Policy')
--    order by title, version;
