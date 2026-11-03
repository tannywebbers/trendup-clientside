export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ad_settings: {
        Row: {
          ad_code: string | null
          ad_type: string
          created_at: string
          id: string
          is_enabled: boolean | null
          placement: string | null
          updated_at: string
        }
        Insert: {
          ad_code?: string | null
          ad_type: string
          created_at?: string
          id?: string
          is_enabled?: boolean | null
          placement?: string | null
          updated_at?: string
        }
        Update: {
          ad_code?: string | null
          ad_type?: string
          created_at?: string
          id?: string
          is_enabled?: boolean | null
          placement?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      admin_login_attempts: {
        Row: {
          attempt_type: string
          created_at: string
          email: string
          id: string
          ip_address: string | null
          is_successful: boolean
          user_id: string | null
        }
        Insert: {
          attempt_type?: string
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          is_successful?: boolean
          user_id?: string | null
        }
        Update: {
          attempt_type?: string
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          is_successful?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      admin_totp_secrets: {
        Row: {
          backup_codes: string[] | null
          created_at: string
          failed_attempts: number
          id: string
          is_verified: boolean
          locked_until: string | null
          secret_encrypted: string
          updated_at: string
          user_id: string
        }
        Insert: {
          backup_codes?: string[] | null
          created_at?: string
          failed_attempts?: number
          id?: string
          is_verified?: boolean
          locked_until?: string | null
          secret_encrypted: string
          updated_at?: string
          user_id: string
        }
        Update: {
          backup_codes?: string[] | null
          created_at?: string
          failed_attempts?: number
          id?: string
          is_verified?: boolean
          locked_until?: string | null
          secret_encrypted?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ads: {
        Row: {
          comment_keywords: string[] | null
          completed_count: number
          created_at: string
          creator_id: string
          id: string
          is_active: boolean
          points_per_task: number
          required_completions: number
          screenshot_example_url: string | null
          task_type: Database["public"]["Enums"]["task_type"]
          tiktok_post_url: string
          updated_at: string
          video_description: string | null
        }
        Insert: {
          comment_keywords?: string[] | null
          completed_count?: number
          created_at?: string
          creator_id: string
          id?: string
          is_active?: boolean
          points_per_task?: number
          required_completions?: number
          screenshot_example_url?: string | null
          task_type: Database["public"]["Enums"]["task_type"]
          tiktok_post_url: string
          updated_at?: string
          video_description?: string | null
        }
        Update: {
          comment_keywords?: string[] | null
          completed_count?: number
          created_at?: string
          creator_id?: string
          id?: string
          is_active?: boolean
          points_per_task?: number
          required_completions?: number
          screenshot_example_url?: string | null
          task_type?: Database["public"]["Enums"]["task_type"]
          tiktok_post_url?: string
          updated_at?: string
          video_description?: string | null
        }
        Relationships: []
      }
      ai_config: {
        Row: {
          api_key_set: boolean
          created_at: string
          id: string
          is_default: boolean
          is_enabled: boolean
          provider: string
          updated_at: string
        }
        Insert: {
          api_key_set?: boolean
          created_at?: string
          id?: string
          is_default?: boolean
          is_enabled?: boolean
          provider: string
          updated_at?: string
        }
        Update: {
          api_key_set?: boolean
          created_at?: string
          id?: string
          is_default?: boolean
          is_enabled?: boolean
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_prompts: {
        Row: {
          confidence_threshold: number
          created_at: string
          id: string
          is_active: boolean
          prompt_content: string
          prompt_name: string
          task_type: string
          updated_at: string
        }
        Insert: {
          confidence_threshold?: number
          created_at?: string
          id?: string
          is_active?: boolean
          prompt_content: string
          prompt_name: string
          task_type: string
          updated_at?: string
        }
        Update: {
          confidence_threshold?: number
          created_at?: string
          id?: string
          is_active?: boolean
          prompt_content?: string
          prompt_name?: string
          task_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      allowed_email_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          is_enabled: boolean
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          is_enabled?: boolean
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          is_enabled?: boolean
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          accent_color: string | null
          app_description: string | null
          app_name: string | null
          community_label: string | null
          community_link: string | null
          created_at: string
          favicon_url: string | null
          id: string
          logo_url: string | null
          meta_description: string | null
          meta_title: string | null
          platform_display_name_label: string | null
          platform_name: string | null
          platform_username_label: string | null
          points_name: string | null
          points_short_name: string | null
          primary_color: string | null
          pwa_icon_url: string | null
          social_links: Json | null
          support_email: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          app_description?: string | null
          app_name?: string | null
          community_label?: string | null
          community_link?: string | null
          created_at?: string
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          platform_display_name_label?: string | null
          platform_name?: string | null
          platform_username_label?: string | null
          points_name?: string | null
          points_short_name?: string | null
          primary_color?: string | null
          pwa_icon_url?: string | null
          social_links?: Json | null
          support_email?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          app_description?: string | null
          app_name?: string | null
          community_label?: string | null
          community_link?: string | null
          created_at?: string
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          platform_display_name_label?: string | null
          platform_name?: string | null
          platform_username_label?: string | null
          points_name?: string | null
          points_short_name?: string | null
          primary_color?: string | null
          pwa_icon_url?: string | null
          social_links?: Json | null
          support_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          is_from_user: boolean
          is_read: boolean
          message: string
          moderator_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_from_user?: boolean
          is_read?: boolean
          message: string
          moderator_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_from_user?: boolean
          is_read?: boolean
          message?: string
          moderator_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_sessions: {
        Row: {
          assigned_moderator_id: string | null
          closed_at: string | null
          created_at: string
          id: string
          status: string
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_moderator_id?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_moderator_id?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_verifications: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          user_id: string | null
          verification_type: string
          verified_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          user_id?: string | null
          verification_type?: string
          verified_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          user_id?: string | null
          verification_type?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      follow_verifications: {
        Row: {
          ad_id: string
          advertiser_tiktok_username: string
          created_at: string
          delay_check_at: string | null
          delay_check_passed: boolean | null
          id: string
          initial_check_at: string | null
          initial_check_passed: boolean
          performer_tiktok_username: string
          scheduled_delay_check: string | null
          status: string
          submission_id: string
          user_id: string
        }
        Insert: {
          ad_id: string
          advertiser_tiktok_username: string
          created_at?: string
          delay_check_at?: string | null
          delay_check_passed?: boolean | null
          id?: string
          initial_check_at?: string | null
          initial_check_passed?: boolean
          performer_tiktok_username: string
          scheduled_delay_check?: string | null
          status?: string
          submission_id: string
          user_id: string
        }
        Update: {
          ad_id?: string
          advertiser_tiktok_username?: string
          created_at?: string
          delay_check_at?: string | null
          delay_check_passed?: boolean | null
          id?: string
          initial_check_at?: string | null
          initial_check_passed?: boolean
          performer_tiktok_username?: string
          scheduled_delay_check?: string | null
          status?: string
          submission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_verifications_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_comments: {
        Row: {
          ad_id: string
          comment_text: string
          created_at: string
          id: string
          is_used: boolean
          user_id: string
        }
        Insert: {
          ad_id: string
          comment_text: string
          created_at?: string
          id?: string
          is_used?: boolean
          user_id: string
        }
        Update: {
          ad_id?: string
          comment_text?: string
          created_at?: string
          id?: string
          is_used?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_comments_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_content: {
        Row: {
          button_text: string | null
          button_url: string | null
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          is_visible: boolean
          metadata: Json | null
          section_key: string
          sort_order: number
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          button_text?: string | null
          button_url?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_visible?: boolean
          metadata?: Json | null
          section_key: string
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          button_text?: string | null
          button_url?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_visible?: boolean
          metadata?: Json | null
          section_key?: string
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      moderator_activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          moderator_id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          moderator_id: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          moderator_id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      moderator_permissions: {
        Row: {
          can_manage_chat: boolean
          can_manage_users: boolean
          can_review_submissions: boolean
          created_at: string
          id: string
          invited_at: string
          invited_by: string | null
          is_suspended: boolean
          pages: string[]
          suspend_reason: string | null
          suspended_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          can_manage_chat?: boolean
          can_manage_users?: boolean
          can_review_submissions?: boolean
          created_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          is_suspended?: boolean
          pages?: string[]
          suspend_reason?: string | null
          suspended_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          can_manage_chat?: boolean
          can_manage_users?: boolean
          can_review_submissions?: boolean
          created_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          is_suspended?: boolean
          pages?: string[]
          suspend_reason?: string | null
          suspended_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          reference_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          reference_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          reference_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          ban_reason: string | null
          banned_at: string | null
          country: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          is_banned: boolean | null
          last_name: string | null
          referral_code: string | null
          referred_by: string | null
          tik_points: number
          tiktok_username: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          country?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          is_banned?: boolean | null
          last_name?: string | null
          referral_code?: string | null
          referred_by?: string | null
          tik_points?: number
          tiktok_username?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          country?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          is_banned?: boolean | null
          last_name?: string | null
          referral_code?: string | null
          referred_by?: string | null
          tik_points?: number
          tiktok_username?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_commissions: {
        Row: {
          commission_percentage: number
          commission_points: number
          created_at: string
          id: string
          purchase_amount: number
          referred_id: string
          referrer_id: string
          transaction_id: string
        }
        Insert: {
          commission_percentage: number
          commission_points: number
          created_at?: string
          id?: string
          purchase_amount: number
          referred_id: string
          referrer_id: string
          transaction_id: string
        }
        Update: {
          commission_percentage?: number
          commission_points?: number
          created_at?: string
          id?: string
          purchase_amount?: number
          referred_id?: string
          referrer_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_commissions_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_commissions_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_commissions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      smtp_config: {
        Row: {
          created_at: string
          from_email: string
          from_name: string
          host: string
          id: string
          is_enabled: boolean
          password_set: boolean
          port: number
          smtp_password: string | null
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          from_email: string
          from_name?: string
          host: string
          id?: string
          is_enabled?: boolean
          password_set?: boolean
          port?: number
          smtp_password?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          from_email?: string
          from_name?: string
          host?: string
          id?: string
          is_enabled?: boolean
          password_set?: boolean
          port?: number
          smtp_password?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      task_submissions: {
        Row: {
          ad_id: string
          admin_notes: string | null
          ai_analysis: Json | null
          created_at: string
          id: string
          points_awarded: number | null
          screenshot_urls: string[]
          status: Database["public"]["Enums"]["task_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          ad_id: string
          admin_notes?: string | null
          ai_analysis?: Json | null
          created_at?: string
          id?: string
          points_awarded?: number | null
          screenshot_urls?: string[]
          status?: Database["public"]["Enums"]["task_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          ad_id?: string
          admin_notes?: string | null
          ai_analysis?: Json | null
          created_at?: string
          id?: string
          points_awarded?: number | null
          screenshot_urls?: string[]
          status?: Database["public"]["Enums"]["task_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_submissions_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      credit_purchase_points: {
        Args: {
          _amount_paid: number
          _points: number
          _reference: string
          _user_id: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      task_status: "pending" | "approved" | "rejected" | "needs_review"
      task_type:
        | "like"
        | "comment"
        | "save"
        | "watch"
        | "follow"
        | "combo_mini"
        | "combo_large"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      task_status: ["pending", "approved", "rejected", "needs_review"],
      task_type: [
        "like",
        "comment",
        "save",
        "watch",
        "follow",
        "combo_mini",
        "combo_large",
      ],
    },
  },
} as const
