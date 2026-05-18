import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Normalize username to lowercase for consistency
    const username = (body.username || '').trim().toLowerCase()
    const sharedAvatar = body.avatarUrl || ''
    const sharedCity = body.city || ''
    const sharedState = body.state || ''

    // Worker profile fields (personal stuff: name, phone, paypal)
    const workerData = {
      user_id: user.id,
      full_name: body.fullName || '',
      username,
      phone: body.phone || '',
      state: sharedState,
      city: sharedCity,
      paypal_email: body.paypalEmail || '',
      avatar_url: sharedAvatar,
      onboarding_complete: true,
    }

    // Flipper profile fields (business stuff: bio, website, public flag)
    const flipperData = {
      user_id: user.id,
      username,
      business_name: body.businessName || '',
      bio: body.bio || '',
      city: sharedCity,
      state: sharedState,
      website: body.website || '',
      avatar_url: sharedAvatar,
      profile_public: body.profilePublic !== false,
      onboarding_complete: true,
    }

    // Save to worker_profiles first
    const { error: workerError } = await supabase
      .from('worker_profiles')
      .upsert(workerData, { onConflict: 'user_id' })

    if (workerError) {
      console.error('[unified-save] worker upsert error:', workerError)
      if (workerError.code === '23505' || workerError.message.includes('unique')) {
        return NextResponse.json(
          { error: 'That username is already taken. Pick a different one.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: workerError.message }, { status: 500 })
    }

    // Then save to flipper_profiles
    const { error: flipperError } = await supabase
      .from('flipper_profiles')
      .upsert(flipperData, { onConflict: 'user_id' })

    if (flipperError) {
      console.error('[unified-save] flipper upsert error:', flipperError)
      if (flipperError.code === '23505' || flipperError.message.includes('unique')) {
        return NextResponse.json(
          { error: 'That username is already taken. Pick a different one.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: flipperError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[unified-save] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
