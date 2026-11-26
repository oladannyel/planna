/**
 * Database types for the plAnna Supabase schema.
 *
 * Hand-authored to mirror `supabase/migrations/*`. Once a live Supabase project
 * exists, regenerate with:
 *   supabase gen types typescript --project-id <id> --schema public > src/types/database.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type TaskStatusEnum = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriorityEnum = "low" | "medium" | "high" | "urgent";
export type TaskSourceEnum = "manual" | "ai_parsed" | "request_link" | "email";
export type RequestStateEnum = "pending" | "accepted" | "rejected";
export type NotificationKindEnum = "request_received";
export type EmailStateEnum = "pending" | "sent" | "failed";
export type EmailConnectionStateEnum = "active" | "revoked" | "error";

export interface Database {
  public: {
    Tables: {
      /**
       * Fixed-window hit counters for the unauthenticated request-link path.
       * Reached only through `claim_request_slot` / `prune_request_throttle`,
       * never queried directly — it is typed here so the schema and these
       * types do not disagree.
       */
      request_throttle: {
        Row: {
          bucket: string;
          window_start: string;
          hits: number;
        };
        Insert: {
          bucket: string;
          window_start: string;
          hits?: number;
        };
        Update: {
          bucket?: string;
          window_start?: string;
          hits?: number;
        };
        Relationships: [];
      };
      workspaces: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          slug: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          slug: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          slug?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          workspace_id: string;
          title: string;
          description: string | null;
          status: TaskStatusEnum;
          priority: TaskPriorityEnum;
          tags: string[];
          due_date: string | null;
          due_at: string | null;
          estimated_minutes: number | null;
          source: TaskSourceEnum;
          requested_by: string | null;
          carried_over: boolean;
          carry_count: number;
          status_history: Json;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          title: string;
          description?: string | null;
          status?: TaskStatusEnum;
          priority?: TaskPriorityEnum;
          tags?: string[];
          due_date?: string | null;
          due_at?: string | null;
          estimated_minutes?: number | null;
          source?: TaskSourceEnum;
          requested_by?: string | null;
          carried_over?: boolean;
          carry_count?: number;
          status_history?: Json;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          title?: string;
          description?: string | null;
          status?: TaskStatusEnum;
          priority?: TaskPriorityEnum;
          tags?: string[];
          due_date?: string | null;
          due_at?: string | null;
          estimated_minutes?: number | null;
          source?: TaskSourceEnum;
          requested_by?: string | null;
          carried_over?: boolean;
          carry_count?: number;
          status_history?: Json;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      daily_logs: {
        Row: {
          id: string;
          workspace_id: string;
          log_date: string;
          completed_count: number;
          created_count: number;
          carried_count: number;
          on_time_count: number;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          log_date: string;
          completed_count?: number;
          created_count?: number;
          carried_count?: number;
          on_time_count?: number;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          log_date?: string;
          completed_count?: number;
          created_count?: number;
          carried_count?: number;
          on_time_count?: number;
        };
        Relationships: [];
      };
      weekly_reports: {
        Row: {
          id: string;
          workspace_id: string;
          week_start: string;
          narrative: string | null;
          stats: Json;
          ethics_answers: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          week_start: string;
          narrative?: string | null;
          stats?: Json;
          ethics_answers?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          week_start?: string;
          narrative?: string | null;
          stats?: Json;
          ethics_answers?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      monthly_summaries: {
        Row: {
          id: string;
          workspace_id: string;
          year: number;
          month: number;
          narrative: string;
          stats: Json;
          top_categories: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          year: number;
          month: number;
          narrative: string;
          stats?: Json;
          top_categories?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          year?: number;
          month?: number;
          narrative?: string;
          stats?: Json;
          top_categories?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      ethics_questions: {
        Row: {
          id: string;
          workspace_id: string;
          question: string;
          sort_order: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          question: string;
          sort_order?: number;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          question?: string;
          sort_order?: number;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      requests: {
        Row: {
          id: string;
          workspace_id: string;
          requester_name: string;
          requester_email: string | null;
          title: string;
          description: string;
          urgency: TaskPriorityEnum;
          desired_deadline: string | null;
          state: RequestStateEnum;
          decided_at: string | null;
          decline_reason: string | null;
          task_id: string | null;
          token: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          requester_name: string;
          requester_email?: string | null;
          title: string;
          description: string;
          urgency?: TaskPriorityEnum;
          desired_deadline?: string | null;
          state?: RequestStateEnum;
          decided_at?: string | null;
          decline_reason?: string | null;
          task_id?: string | null;
          token: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          requester_name?: string;
          requester_email?: string | null;
          title?: string;
          description?: string;
          urgency?: TaskPriorityEnum;
          desired_deadline?: string | null;
          state?: RequestStateEnum;
          decided_at?: string | null;
          decline_reason?: string | null;
          task_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          workspace_id: string;
          kind: NotificationKindEnum;
          title: string;
          body: string | null;
          request_id: string | null;
          task_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          kind: NotificationKindEnum;
          title: string;
          body?: string | null;
          request_id?: string | null;
          task_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          read_at?: string | null;
        };
        Relationships: [];
      };
      /** Queued outbound mail. Service role only — see migration 0008. */
      email_outbox: {
        Row: {
          id: string;
          workspace_id: string | null;
          request_id: string | null;
          to_email: string;
          subject: string;
          body_text: string;
          body_html: string | null;
          state: EmailStateEnum;
          attempts: number;
          last_error: string | null;
          created_at: string;
          sent_at: string | null;
        };
        Insert: {
          id?: string;
          workspace_id?: string | null;
          request_id?: string | null;
          to_email: string;
          subject: string;
          body_text: string;
          body_html?: string | null;
          state?: EmailStateEnum;
          attempts?: number;
          last_error?: string | null;
          created_at?: string;
          sent_at?: string | null;
        };
        Update: {
          state?: EmailStateEnum;
          attempts?: number;
          last_error?: string | null;
          sent_at?: string | null;
        };
        Relationships: [];
      };
      /** One connected mailbox per workspace. `refresh_token` is sealed. */
      email_connections: {
        Row: {
          workspace_id: string;
          provider: string;
          email_address: string;
          refresh_token: string;
          query: string;
          state: EmailConnectionStateEnum;
          last_error: string | null;
          last_polled_at: string | null;
          last_task_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          provider?: string;
          email_address: string;
          refresh_token: string;
          query?: string;
          state?: EmailConnectionStateEnum;
          last_error?: string | null;
          last_polled_at?: string | null;
          last_task_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email_address?: string;
          refresh_token?: string;
          query?: string;
          state?: EmailConnectionStateEnum;
          last_error?: string | null;
          last_polled_at?: string | null;
          last_task_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_ingest_log: {
        Row: {
          workspace_id: string;
          message_id: string;
          task_id: string | null;
          ingested_at: string;
        };
        Insert: {
          workspace_id: string;
          message_id: string;
          task_id?: string | null;
          ingested_at?: string;
        };
        Update: {
          task_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      append_status_history: {
        Args: { task_id: string; entry: Json };
        Returns: Json;
      };
      claim_request_slot: {
        Args: { p_bucket: string; p_limit: number; p_window_seconds?: number };
        Returns: boolean;
      };
      prune_request_throttle: {
        Args: { p_older_than_seconds?: number };
        Returns: number;
      };
    };
    Enums: {
      task_status: TaskStatusEnum;
      task_priority: TaskPriorityEnum;
      task_source: TaskSourceEnum;
      request_state: RequestStateEnum;
      notification_kind: NotificationKindEnum;
      email_state: EmailStateEnum;
      email_connection_state: EmailConnectionStateEnum;
    };
    CompositeTypes: Record<never, never>;
  };
}
