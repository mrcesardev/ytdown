import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

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
