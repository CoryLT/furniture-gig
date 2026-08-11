// ---------------------------------------------------------------------------
// Statement auto-sorter.
//
// Takes ONE normalized transaction (from the Relay or Wells Fargo reader) and
// decides what it is, using Cory's rules:
//
//   • Card / store purchases  -> Materials & Supplies   (the catch-all)
//   • Gas stations / c-stores -> Transport & Gas (fuel)
//   • Known software / online -> Software & Subscriptions
//   • Facebook / Craigslist   -> Advertising & Marketing
//   • Bank service fees       -> Bank & Merchant Fees
//   • Transfer OUT to personal / "Owner Withdrawal" -> Owner's Draws
//   • Transfer IN from personal / savings / brokerage / opening deposit
//                             -> Owner's Contributions
//   • Money IN from Venmo / Cash App / Zelle / ATM cash deposit
//                             -> a SALE you already logged, so we DON'T re-book
//                                it as income — we just move it Cash -> Bank.
//   • ATM withdrawal          -> cash moved to your wallet (Bank -> Cash on Hand),
//                                NOT a purchase (that got logged on the piece).
//   • Tiny "ACCTVERIFY" pennies -> a bank check, cancelled out (dismiss).
//   • Anything it truly can't place -> "review" (left for a quick look).
//
// Pure logic only — no database. The importer takes this result and calls the
// matching ledger function. Account NAMES here match the app's default buckets.
// ---------------------------------------------------------------------------

import type { NormalizedTxn } from './relay'

// The exact default bucket names this app creates (see app/books/page.tsx).
export const ACCOUNTS = {
  cash: 'Cash on Hand',
  bank: 'Bank / Checking',
  sales: 'Sales',
  materials: 'Materials & Supplies',
  fuel: 'Transport & Gas',
  software: 'Software & Subscriptions',
  advertising: 'Advertising & Marketing',
  bankFees: 'Bank & Merchant Fees',
  ownerDraw: "Owner's Draws",
  ownerContribution: "Owner's Contributions",
} as const

export type SortAction = 'expense' | 'income' | 'transfer' | 'dismiss' | 'review'

export type SortResult = {
  action: SortAction
  label: string // plain-English name of the decision (shown to Cory)
  reason: string // why we decided that
  confident: boolean // true = safe to auto-post; false = leave for review
  accountName?: string // expense bucket (expense) or credit bucket (income)
  fromAccountName?: string // transfer: money out of this bucket
  toAccountName?: string // transfer: money into this bucket
}

// Case-insensitive "does the text contain any of these words" helper.
function has(text: string, needles: string[]): boolean {
  const t = text.toLowerCase()
  return needles.some((n) => t.includes(n))
}

// Gas stations & convenience stores -> fuel.
const FUEL = [
  'circle k', 'circlek', "bj's fuel", 'bjs fuel', 'quiktrip', 'quik trip', 'sheetz', 'wawa',
  'sunoco', 'speedway', 'shell', 'exxon', 'mobil', 'chevron', 'texaco', 'bp ',
  'marathon', 'valero', 'citgo', 'racetrac', 'race trac', 'kangaroo', 'sams gas',
  "sam's gas", 'costco gas', 'murphy', '7-eleven', '7 eleven', 'quik mart',
  ' fuel', 'gas station', 'convenience',
]

// Known online services / SaaS -> software & subscriptions.
const SOFTWARE = [
  'anthropic', 'claude.ai', 'claude ai', 'vercel', 'supabase', 'sightengine',
  'anytime mailbox', 'anytimemailbo', 'mailbox', 'myflipwork', 'openai', 'github',
  'godaddy', 'namecheap', 'google cloud', 'google *', 'notion', 'canva', 'adobe',
  'zoom', 'dropbox', 'quickbooks', 'intuit', 'squarespace', 'wix', 'cloudflare',
  'resend', 'twilio', 'aws', 'digitalocean', 'microsoft', 'apple.com/bill',
]

// Ad platforms -> advertising & marketing.
const ADVERTISING = [
  'facebk', 'facebook', 'meta platforms', 'meta pltfm', 'instagram', 'craigslist',
  'google ads', 'googleads', 'offerup promote', 'nextdoor ad',
]

// Bank service fees -> bank & merchant fees.
const BANK_FEES = [
  'monthly service fee', 'service charge', 'overdraft', 'atm fee', 'wire fee',
  'maintenance fee', 'stop payment', 'nsf fee', 'returned item',
]

// Payment apps / cash deposits that represent SALES you already logged.
const SALE_INFLOWS = [
  'venmo', 'cash app', 'cashapp', 'cash-app', 'zelle', 'square', 'squareup',
  'sq *', 'atm cash deposit', 'cash deposit', 'paypal',
]

// Signs a money-IN line is you funding the business (owner contribution).
const CONTRIBUTION_INFLOWS = [
  'clear access', 'way2save', 'way 2 save', 'brokerage', 'savings',
  'opening deposit', 'ach pull', 'from thacker', 'transfer from',
]

// Signs a money-OUT line is you paying yourself (owner draw). You take money
// out two ways: transfers to your personal accounts, and Zelle to Erica Rhew.
const DRAW_OUTFLOWS = [
  'owner withdrawal', 'clear access', 'way2save', 'way 2 save', 'brokerage',
  'to thacker', 'transfer to', 'ach push',
  'rhew erica', 'erica rhew', // Zelle to Erica = how you pay yourself
]

export function sortTxn(txn: NormalizedTxn): SortResult {
  const text = `${txn.payee ?? ''} ${txn.rawDescription ?? ''}`.trim()
  const isMoneyIn = txn.amount > 0
  const abs = Math.abs(txn.amount)

  // --- Tiny account-verification pennies (Square etc.): cancel them out. -----
  if (has(text, ['acctverify', 'account verif', 'micro deposit', 'microdeposit']) || abs <= 0.01) {
    return {
      action: 'dismiss',
      label: 'Bank check — cancelled out',
      reason: 'A tiny verification amount, not real income or spending.',
      confident: true,
    }
  }

  // --- ATM cash withdrawal: you pull this cash to buy supplies, not to pay
  //     yourself — so it is NOT a draw. Default it to Materials (retag if a
  //     given one was really personal).
  if (has(text, ['atm withdrawal', 'withdrawal authorized', 'cash withdrawal'])) {
    return {
      action: 'expense',
      label: 'ATM cash (supplies)',
      reason: 'Cash pulled out, which you use for supplies. Retag if it was personal.',
      confident: true,
      accountName: ACCOUNTS.materials,
    }
  }

  if (isMoneyIn) {
    // --- A sale landing in the bank (Venmo / Cash App / Zelle / ATM deposit).
    //     Book it straight into the bank as Sales income so the bank balance
    //     matches your statement. (No phantom "cash on hand" move — that was
    //     what drove the old drift.)
    if (has(text, SALE_INFLOWS)) {
      return {
        action: 'income',
        label: 'Sale',
        reason: 'Money from a sale landing in the bank.',
        confident: true,
        accountName: ACCOUNTS.sales,
      }
    }
    // --- Money you put into the business (owner contribution). ---------------
    if (has(text, CONTRIBUTION_INFLOWS)) {
      return {
        action: 'income',
        label: 'Owner contribution',
        reason: 'Money coming in from your personal / savings / brokerage.',
        confident: true,
        accountName: ACCOUNTS.ownerContribution,
      }
    }
    // --- Money in we can't confidently place -> quick look. ------------------
    return {
      action: 'review',
      label: 'Money in — needs a look',
      reason: "Could be a sale or money you put in; not sure which.",
      confident: false,
    }
  }

  // ----- From here down: money OUT ------------------------------------------

  // --- Paying yourself (owner draw). ----------------------------------------
  if (has(text, DRAW_OUTFLOWS)) {
    return {
      action: 'expense',
      label: 'Owner draw',
      reason: 'Money moved out to your personal / savings account.',
      confident: true,
      accountName: ACCOUNTS.ownerDraw,
    }
  }
  // --- Fuel. ----------------------------------------------------------------
  if (has(text, FUEL)) {
    return {
      action: 'expense',
      label: 'Fuel',
      reason: 'Gas station or convenience store.',
      confident: true,
      accountName: ACCOUNTS.fuel,
    }
  }
  // --- Software / online subscriptions. -------------------------------------
  if (has(text, SOFTWARE)) {
    return {
      action: 'expense',
      label: 'Software & subscriptions',
      reason: 'A known online service or subscription.',
      confident: true,
      accountName: ACCOUNTS.software,
    }
  }
  // --- Advertising. ---------------------------------------------------------
  if (has(text, ADVERTISING)) {
    return {
      action: 'expense',
      label: 'Advertising',
      reason: 'An ad platform (Facebook, Craigslist, etc.).',
      confident: true,
      accountName: ACCOUNTS.advertising,
    }
  }
  // --- Bank fees. -----------------------------------------------------------
  if (has(text, BANK_FEES)) {
    return {
      action: 'expense',
      label: 'Bank fee',
      reason: 'A bank service fee.',
      confident: true,
      accountName: ACCOUNTS.bankFees,
    }
  }
  // --- Everything else that goes OUT: materials (your catch-all rule). ------
  return {
    action: 'expense',
    label: 'Materials & supplies',
    reason: 'Your default: any purchase that isn\u2019t fuel is materials.',
    confident: true,
    accountName: ACCOUNTS.materials,
  }
}
