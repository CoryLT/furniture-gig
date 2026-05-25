import Anthropic from '@anthropic-ai/sdk'

if (!process.env.ANTHROPIC_API_KEY) {
  // Don't throw at import time — the support routes will fail
  // gracefully if the key is missing. This just warns in logs.
  console.warn('ANTHROPIC_API_KEY is not set. AI support chat will not work.')
}

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// The model we use for AI support. Keep this in one place so we
// can swap easily.
export const SUPPORT_MODEL = 'claude-haiku-4-5-20251001'

// Hard limits to protect against runaway cost.
export const MAX_MESSAGES_PER_CONVERSATION = 50
export const MAX_CONVERSATIONS_PER_USER_PER_DAY = 5
