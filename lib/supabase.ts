import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          wallet_address: string | null;
          avatar_url: string | null;
          username: string | null;
          plan: string;
          is_admin: boolean;
          created_at: string;
        };
      };
      projects: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          name: string;
          type: string;
          description: string | null;
          language: string;
          created_at: string;
          updated_at: string;
        };
      };
      files: {
        Row: {
          id: string;
          project_id: string;
          parent_id: string | null;
          name: string;
          path: string;
          type: string;
          content: string | null;
          language: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      chat_sessions: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          title: string;
          model: string;
          created_at: string;
          updated_at: string;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          session_id: string;
          role: string;
          content: string;
          tokens_used: number | null;
          created_at: string;
        };
      };
      deployed_contracts: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          name: string;
          address: string;
          chain_id: number;
          tx_hash: string;
          deployer: string;
          status: string;
          verified: boolean;
          abi: unknown;
          bytecode: string;
          source_code: string;
          created_at: string;
        };
      };
      system_settings: {
        Row: {
          key: string;
          value: string;
          description: string | null;
          is_public: boolean;
          updated_at: string;
        };
      };
    };
  };
};
