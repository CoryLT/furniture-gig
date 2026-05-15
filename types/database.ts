export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          role: 'worker' | 'admin' | 'flipper'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role?: 'worker' | 'admin' | 'flipper'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'worker' | 'admin' | 'flipper'
          created_at?: string
          updated_at?: string
        }
      }
      worker_profiles: {
        Row: {
          id: string
          user_id: string
          first_name: string
          last_name: string
          phone: string
          city: string
          state: string
          paypal_email: string
          username: string | null
          bio: string
          skills: string[]
          avatar_url: string
          profile_public: boolean
          onboarding_complete: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          first_name?: string
          last_name?: string
          phone?: string
          city?: string
          state?: string
          paypal_email?: string
          username?: string | null
          bio?: string
          skills?: string[]
          avatar_url?: string
          profile_public?: boolean
          onboarding_complete?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          first_name?: string
          last_name?: string
          phone?: string
          city?: string
          state?: string
          paypal_email?: string
          username?: string | null
          bio?: string
          skills?: string[]
          avatar_url?: string
          profile_public?: boolean
          onboarding_complete?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      flipper_profiles: {
        Row: {
          id: string
          user_id: string
          username: string | null
          business_name: string
          bio: string
          city: string
          state: string
          website: string
          avatar_url: string
          profile_public: boolean
          onboarding_complete: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          username?: string | null
          business_name?: string
          bio?: string
          city?: string
          state?: string
          website?: string
          avatar_url?: string
          profile_public?: boolean
          onboarding_complete?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          username?: string | null
          business_name?: string
          bio?: string
          city?: string
          state?: string
          website?: string
          avatar_url?: string
          profile_public?: boolean
          onboarding_complete?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      admin_profiles: {
        Row: {
          id: string
          user_id: string
          display_name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          display_name?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          display_name?: string
          created_at?: string
          updated_at?: string
        }
      }
      legal_agreements: {
        Row: {
          id: string
          title: string
          version: string
          content: string
          required: boolean
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          version?: string
          content: string
          required?: boolean
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          version?: string
          content?: string
          required?: boolean
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_agreement_acceptances: {
        Row: {
          id: string
          user_id: string
          agreement_id: string
          version: string
          accepted_at: string
        }
        Insert: {
          id?: string
          user_id: string
          agreement_id: string
          version: string
          accepted_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          agreement_id?: string
          version?: string
          accepted_at?: string
        }
      }
      gigs: {
        Row: {
          id: string
          title: string
          slug: string
          summary: string
          description: string
          furniture_type: string
          location_text: string
          city: string
          state: string
          pay_amount: number
          required_skills: string[]
          due_date: string | null
          status: 'draft' | 'open' | 'claimed' | 'in_review' | 'completed' | 'archived'
          exclusive_claim: boolean
          created_by: string | null
          poster_user_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          summary?: string
          description?: string
          furniture_type?: string
          location_text?: string
          city?: string
          state?: string
          pay_amount?: number
          required_skills?: string[]
          due_date?: string | null
          status?: 'draft' | 'open' | 'claimed' | 'in_review' | 'completed' | 'archived'
          exclusive_claim?: boolean
          created_by?: string | null
          poster_user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          slug?: string
          summary?: string
          description?: string
          furniture_type?: string
          location_text?: string
          city?: string
          state?: string
          pay_amount?: number
          required_skills?: string[]
          due_date?: string | null
          status?: 'draft' | 'open' | 'claimed' | 'in_review' | 'completed' | 'archived'
          exclusive_claim?: boolean
          created_by?: string | null
          poster_user_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      gig_checklist_items: {
        Row: {
          id: string
          gig_id: string
          title: string
          description: string
          sort_order: number
          required: boolean
          created_at: string
        }
        Insert: {
          id?: string
          gig_id: string
          title: string
          description?: string
          sort_order?: number
          required?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          gig_id?: string
          title?: string
          description?: string
          sort_order?: number
          required?: boolean
          created_at?: string
        }
      }
      gig_claims: {
        Row: {
          id: string
          gig_id: string
          worker_user_id: string
          status: 'active' | 'submitted_for_review' | 'approved' | 'rejected' | 'cancelled'
          claimed_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          gig_id: string
          worker_user_id: string
          status?: 'active' | 'submitted_for_review' | 'approved' | 'rejected' | 'cancelled'
          claimed_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          gig_id?: string
          worker_user_id?: string
          status?: 'active' | 'submitted_for_review' | 'approved' | 'rejected' | 'cancelled'
          claimed_at?: string
          updated_at?: string
        }
      }
      gig_task_completions: {
        Row: {
          id: string
          checklist_item_id: string
          worker_user_id: string
          completed: boolean
          notes: string
          updated_at: string
        }
        Insert: {
          id?: string
          checklist_item_id: string
          worker_user_id: string
          completed?: boolean
          notes?: string
          updated_at?: string
        }
        Update: {
          id?: string
          checklist_item_id?: string
          worker_user_id?: string
          completed?: boolean
          notes?: string
          updated_at?: string
        }
      }
      gig_photo_uploads: {
        Row: {
          id: string
          gig_id: string
          worker_user_id: string
          file_path: string
          caption: string
          uploaded_at: string
        }
        Insert: {
          id?: string
          gig_id: string
          worker_user_id: string
          file_path: string
          caption?: string
          uploaded_at?: string
        }
        Update: {
          id?: string
          gig_id?: string
          worker_user_id?: string
          file_path?: string
          caption?: string
          uploaded_at?: string
        }
      }
      payout_records: {
        Row: {
          id: string
          gig_id: string
          worker_user_id: string
          amount: number
          payout_status: 'unpaid' | 'pending' | 'paid'
          payout_reference: string
          payout_date: string | null
          notes: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          gig_id: string
          worker_user_id: string
          amount: number
          payout_status?: 'unpaid' | 'pending' | 'paid'
          payout_reference?: string
          payout_date?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          gig_id?: string
          worker_user_id?: string
          amount?: number
          payout_status?: 'unpaid' | 'pending' | 'paid'
          payout_reference?: string
          payout_date?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// Convenience row types
export type UserRow = Database['public']['Tables']['users']['Row']
export type WorkerProfileRow = Database['public']['Tables']['worker_profiles']['Row']
export type FlipperProfileRow = Database['public']['Tables']['flipper_profiles']['Row']
export type AdminProfileRow = Database['public']['Tables']['admin_profiles']['Row']
export type LegalAgreementRow = Database['public']['Tables']['legal_agreements']['Row']
export type UserAgreementAcceptanceRow = Database['public']['Tables']['user_agreement_acceptances']['Row']
export type GigRow = Database['public']['Tables']['gigs']['Row']
export type GigChecklistItemRow = Database['public']['Tables']['gig_checklist_items']['Row']
export type GigClaimRow = Database['public']['Tables']['gig_claims']['Row']
export type GigTaskCompletionRow = Database['public']['Tables']['gig_task_completions']['Row']
export type GigPhotoUploadRow = Database['public']['Tables']['gig_photo_uploads']['Row']
export type PayoutRecordRow = Database['public']['Tables']['payout_records']['Row']

// Status types
export type GigStatus = GigRow['status']
export type ClaimStatus = GigClaimRow['status']
export type PayoutStatus = PayoutRecordRow['payout_status']
export type UserRole = UserRow['role']
