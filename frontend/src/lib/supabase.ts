import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://kbfrolcsqnfazjjakfps.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtiZnJvbGNzcW5mYXpqamFrZnBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4Nzc3NDgsImV4cCI6MjEwNjQ1Mzc0OH0.nyCjhGuXsDPyVAomAx0kKG3-nVoOxbKeZ72_M5jrIJE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface MediaDownload {
  id: string;
  user_id: string | null;
  title: string | null;
  thumbnail: string | null;
  original_url: string;
  format: 'mp3' | 'mp4';
  quality: 'standard' | 'high';
  is_playlist?: boolean;
  file_path: string | null;
  filename: string | null;
  file_size: number | null;
  download_url: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}
