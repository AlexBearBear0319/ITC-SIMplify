export interface Location {
  id: number;
  name: string;
  category: string; // 'Study', 'Food', 'Library'
  current_status: 'Empty' | 'Busy' | 'Full';
  coordinates_x: number;
  coordinates_y: number;
  images: string[] | null;
  location_text: string | null;   // e.g. "Building A, 2nd Floor"
  opening_time: string | null;    // e.g. "8:00 AM – 10:00 PM"
  total_seats: number | null;
  power_outlets: number | null;
  description: string | null;
}

export interface Review {
  id: number;
  location_id: number;
  user_id: string;
  comment: string;
  created_at: string;
  profiles?: { username: string; avatar_url: string | null };
}

export interface ActiveSession {
  id: number;
  user_id: string;
  location_id: number;
  seats_needed: number;
  activity: 'study' | 'eating';
  module: string | null;
  duration_minutes: number;
  started_at: string;
  ends_at: string;
}