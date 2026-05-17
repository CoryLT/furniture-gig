import { z } from 'zod'

export const workerProfileSchema = z.object({
    first_name: z.string().min(1, 'First name is required').max(50),
    last_name: z.string().max(50).optional().default(''),
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username must be at most 30 characters')
      .regex(/^[a-z0-9_-]+$/, 'Username can only contain lowercase letters, numbers, underscores, and hyphens'),
    phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits').optional().default(''),
    city: z.string().max(100).optional().default(''),
    state: z.string().length(2, 'State must be 2 characters').optional().default(''),
    bio: z.string().max(500, 'Bio must be under 500 characters').optional().default(''),
    skills: z.array(z.string()).optional().default([]),
    paypal_email: z.string().email('Invalid email').optional().default(''),
    profile_public: z.boolean().default(false),
})

export const flipperProfileSchema = z.object({
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username must be at most 30 characters')
      .regex(/^[a-z0-9_-]+$/, 'Username can only contain lowercase letters, numbers, underscores, and hyphens'),
    business_name: z.string().min(1, 'Business name is required').max(100),
    bio: z.string().max(500, 'Bio must be under 500 characters').optional().default(''),
    city: z.string().max(100).optional().default(''),
    state: z.string().length(2, 'State must be 2 characters').optional().default(''),
    website: z.string().url('Invalid URL').optional().default(''),
    profile_public: z.boolean().default(false),
})

export type WorkerProfileFormInput = z.infer<typeof workerProfileSchema>
export type FlipperProfileFormInput = z.infer<typeof flipperProfileSchema>
