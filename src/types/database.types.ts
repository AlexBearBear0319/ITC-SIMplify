export interface Location {
  id: number;
  name: string;
  category: string; // 'Study', 'Food', 'Library'
  current_status: 'Empty' | 'Busy' | 'Full';
  coordinates_x: number; // For the map pin
  coordinates_y: number;
  image_url: string;
}