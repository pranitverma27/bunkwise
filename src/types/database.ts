export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string; // matches auth.users.id
          full_name: string | null;
          avatar_url: string | null;
          college_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          college_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          college_name?: string | null;
          created_at?: string;
        };
      };
      timetables: {
        Row: {
          id: string;
          user_id: string;
          raw_data: any; // The JSONB structure from Claude parse
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          raw_data: any;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          raw_data?: any;
          is_active?: boolean;
          created_at?: string;
        };
      };
      attendance_logs: {
        Row: {
          id: string;
          user_id: string;
          subject_name: string;
          date: string;
          status: 'present' | 'absent' | 'cancelled';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subject_name: string;
          date: string;
          status: 'present' | 'absent' | 'cancelled';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subject_name?: string;
          date?: string;
          status?: 'present' | 'absent' | 'cancelled';
          created_at?: string;
        };
      };
    };
  };
};
