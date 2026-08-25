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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          allow_partial_confirmation: boolean
          id: boolean
          stale_days: number
          updated_at: string
        }
        Insert: {
          allow_partial_confirmation?: boolean
          id?: boolean
          stale_days?: number
          updated_at?: string
        }
        Update: {
          allow_partial_confirmation?: boolean
          id?: boolean
          stale_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          business_location: string | null
          city: string | null
          cnpj: string | null
          company_name: string
          contact_email: string | null
          created_at: string
          credit_limit: string | null
          customer: string | null
          customer_since: string | null
          destination: string | null
          distribution_channel: string | null
          id: string
          incoterms: string | null
          key_account: string | null
          last_credit_check: string | null
          notes: string | null
          package: string | null
          payment_terms: string | null
          phone: string | null
          region: string | null
          sales_org: string | null
          sap_code: string | null
          segment: string | null
          state: string | null
          state_registration: string | null
          updated_at: string
          xml_email: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          business_location?: string | null
          city?: string | null
          cnpj?: string | null
          company_name?: string
          contact_email?: string | null
          created_at?: string
          credit_limit?: string | null
          customer?: string | null
          customer_since?: string | null
          destination?: string | null
          distribution_channel?: string | null
          id?: string
          incoterms?: string | null
          key_account?: string | null
          last_credit_check?: string | null
          notes?: string | null
          package?: string | null
          payment_terms?: string | null
          phone?: string | null
          region?: string | null
          sales_org?: string | null
          sap_code?: string | null
          segment?: string | null
          state?: string | null
          state_registration?: string | null
          updated_at?: string
          xml_email?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          business_location?: string | null
          city?: string | null
          cnpj?: string | null
          company_name?: string
          contact_email?: string | null
          created_at?: string
          credit_limit?: string | null
          customer?: string | null
          customer_since?: string | null
          destination?: string | null
          distribution_channel?: string | null
          id?: string
          incoterms?: string | null
          key_account?: string | null
          last_credit_check?: string | null
          notes?: string | null
          package?: string | null
          payment_terms?: string | null
          phone?: string | null
          region?: string | null
          sales_org?: string | null
          sap_code?: string | null
          segment?: string | null
          state?: string | null
          state_registration?: string | null
          updated_at?: string
          xml_email?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      engineering_requests: {
        Row: {
          created_at: string
          id: string
          lead_time: number | null
          order_item_id: string
          product_code: string | null
          requested_at: string
          requested_by: string | null
          responded_at: string | null
          responded_by: string | null
          routing: string | null
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_time?: number | null
          order_item_id: string
          product_code?: string | null
          requested_at?: string
          requested_by?: string | null
          responded_at?: string | null
          responded_by?: string | null
          routing?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_time?: number | null
          order_item_id?: string
          product_code?: string | null
          requested_at?: string
          requested_by?: string | null
          responded_at?: string | null
          responded_by?: string | null
          routing?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "engineering_requests_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_status_logs: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["item_status"] | null
          id: string
          note: string | null
          order_item_id: string
          to_status: Database["public"]["Enums"]["item_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["item_status"] | null
          id?: string
          note?: string | null
          order_item_id: string
          to_status: Database["public"]["Enums"]["item_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["item_status"] | null
          id?: string
          note?: string | null
          order_item_id?: string
          to_status?: Database["public"]["Enums"]["item_status"]
        }
        Relationships: [
          {
            foreignKeyName: "item_status_logs_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          order_id: string | null
          read_at: string | null
          target_role: Database["public"]["Enums"]["app_role"] | null
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          read_at?: string | null
          target_role?: Database["public"]["Enums"]["app_role"] | null
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          read_at?: string | null
          target_role?: Database["public"]["Enums"]["app_role"] | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_attachments: {
        Row: {
          content_type: string | null
          created_at: string
          file_name: string
          file_path: string
          id: string
          order_id: string
          size_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          order_id: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          order_id?: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_attachments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          confirmed_at: string | null
          confirmed_delivery_date: string | null
          created_at: string
          description: string
          icms_rate: number
          id: string
          lead_time: number | null
          notes: string | null
          order_id: string
          product_code: string | null
          qty_per_unit: number
          quantity: number
          requested_delivery_date: string | null
          routing: string | null
          status: Database["public"]["Enums"]["item_status"]
          status_changed_at: string
          tax_category: string
          total_price: number | null
          unit_of_measure: string
          unit_price: number
          units_count: number
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_delivery_date?: string | null
          created_at?: string
          description: string
          icms_rate?: number
          id?: string
          lead_time?: number | null
          notes?: string | null
          order_id: string
          product_code?: string | null
          qty_per_unit?: number
          quantity?: number
          requested_delivery_date?: string | null
          routing?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          status_changed_at?: string
          tax_category?: string
          total_price?: number | null
          unit_of_measure?: string
          unit_price?: number
          units_count?: number
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_delivery_date?: string | null
          created_at?: string
          description?: string
          icms_rate?: number
          id?: string
          lead_time?: number | null
          notes?: string | null
          order_id?: string
          product_code?: string | null
          qty_per_unit?: number
          quantity?: number
          requested_delivery_date?: string | null
          routing?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          status_changed_at?: string
          tax_category?: string
          total_price?: number | null
          unit_of_measure?: string
          unit_price?: number
          units_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          confirmed_at: string | null
          created_at: string
          cs_owner_id: string | null
          customer_name: string
          customer_po: string | null
          id: string
          notes: string | null
          order_date: string
          order_number: string
          salesperson_id: string
          sap_inserted: boolean
          sap_number: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          cs_owner_id?: string | null
          customer_name: string
          customer_po?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          salesperson_id: string
          sap_inserted?: boolean
          sap_number?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          cs_owner_id?: string | null
          customer_name?: string
          customer_po?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          salesperson_id?: string
          sap_inserted?: boolean
          sap_number?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Relationships: []
      }
      planning_requests: {
        Row: {
          created_at: string
          delivery_date: string | null
          id: string
          order_item_id: string
          requested_at: string
          requested_by: string | null
          responded_at: string | null
          responded_by: string | null
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_date?: string | null
          id?: string
          order_item_id: string
          requested_at?: string
          requested_by?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_date?: string | null
          id?: string
          order_item_id?: string
          requested_at?: string
          requested_by?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_requests_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          code: string
          created_at: string
          default_lead_time: number | null
          description: string
          id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          default_lead_time?: number | null
          description?: string
          id?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          default_lead_time?: number | null
          description?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      units_of_measure: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string
          id?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
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
      app_role:
        | "vendas"
        | "customer_service"
        | "engenharia"
        | "planejamento"
        | "admin"
      item_status:
        | "novo"
        | "aguardando_codigo"
        | "codigo_recebido"
        | "aguardando_data"
        | "confirmado"
        | "cancelado"
      order_status:
        | "aberto"
        | "em_processamento"
        | "aguardando_engenharia"
        | "aguardando_planejamento"
        | "confirmado"
        | "cancelado"
      request_status: "pendente" | "respondida"
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
      app_role: [
        "vendas",
        "customer_service",
        "engenharia",
        "planejamento",
        "admin",
      ],
      item_status: [
        "novo",
        "aguardando_codigo",
        "codigo_recebido",
        "aguardando_data",
        "confirmado",
        "cancelado",
      ],
      order_status: [
        "aberto",
        "em_processamento",
        "aguardando_engenharia",
        "aguardando_planejamento",
        "confirmado",
        "cancelado",
      ],
      request_status: ["pendente", "respondida"],
    },
  },
} as const
