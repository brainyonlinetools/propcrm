export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      field_definitions: {
        Row: {
          id: string;
          entity_type: string;
          field_key: string;
          label: string;
          field_type: string;
          options: Json | null;
          is_required: boolean;
          show_in_card: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          entity_type: string;
          field_key: string;
          label: string;
          field_type: string;
          options?: Json | null;
          is_required?: boolean;
          show_in_card?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          entity_type?: string;
          field_key?: string;
          label?: string;
          field_type?: string;
          options?: Json | null;
          is_required?: boolean;
          show_in_card?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      pipeline_stages: {
        Row: {
          id: string;
          label: string;
          color: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          label: string;
          color: string;
          sort_order?: number;
        };
        Update: {
          id?: string;
          label?: string;
          color?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          name: string;
          location: string | null;
          region: string | null;
          status: string | null;
          land_area: string | null;
          total_towers: string | null;
          sizes: string | null;
          usps: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          location?: string | null;
          region?: string | null;
          status?: string | null;
          land_area?: string | null;
          total_towers?: string | null;
          sizes?: string | null;
          usps?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          location?: string | null;
          region?: string | null;
          status?: string | null;
          land_area?: string | null;
          total_towers?: string | null;
          sizes?: string | null;
          usps?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_media: {
        Row: {
          id: string;
          project_id: string;
          storage_path: string;
          media_type: string;
          mime_type: string;
          file_size: number | null;
          caption: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          storage_path: string;
          media_type: string;
          mime_type: string;
          file_size?: number | null;
          caption?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          storage_path?: string;
          media_type?: string;
          mime_type?: string;
          file_size?: number | null;
          caption?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          email: string | null;
          stage_id: string | null;
          source: string | null;
          project_interest: string | null;
          linked_unit_id: string | null;
          acquired_date: string | null;
          custom_data: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          stage_id?: string | null;
          source?: string | null;
          project_interest?: string | null;
          linked_unit_id?: string | null;
          acquired_date?: string | null;
          custom_data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          stage_id?: string | null;
          source?: string | null;
          project_interest?: string | null;
          linked_unit_id?: string | null;
          acquired_date?: string | null;
          custom_data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      inventory: {
        Row: {
          id: string;
          project_id: string | null;
          unit_number: string;
          unit_type: string | null;
          area_sqft: number | null;
          price: number | null;
          status: string;
          acquired_date: string | null;
          custom_data: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          unit_number: string;
          unit_type?: string | null;
          area_sqft?: number | null;
          price?: number | null;
          status?: string;
          acquired_date?: string | null;
          custom_data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string | null;
          unit_number?: string;
          unit_type?: string | null;
          area_sqft?: number | null;
          price?: number | null;
          status?: string;
          acquired_date?: string | null;
          custom_data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lead_notes: {
        Row: {
          id: string;
          lead_id: string;
          content: string;
          note_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          content: string;
          note_type?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          content?: string;
          note_type?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      inventory_notes: {
        Row: {
          id: string;
          inventory_id: string;
          content: string;
          note_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          inventory_id: string;
          content: string;
          note_type?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          inventory_id?: string;
          content?: string;
          note_type?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          lead_id: string;
          title: string;
          due_date: string | null;
          is_done: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          title: string;
          due_date?: string | null;
          is_done?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          title?: string;
          due_date?: string | null;
          is_done?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      whatsapp_templates: {
        Row: {
          id: string;
          name: string;
          body: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          body: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          body?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
