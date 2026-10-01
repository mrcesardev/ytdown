import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bxnfquyxfsrtpcsfbayi.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4bmZxdXl4ZnNydHBjc2ZiYXlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NjY5MjYsImV4cCI6MjEwNjQ0MjkyNn0.WZKbKDq_B2pWEjDVNnMyRXdR6TnFfYmrrm7QkPC7jzg';

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
