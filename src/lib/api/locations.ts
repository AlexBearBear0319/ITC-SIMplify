import { createClient } from "@/utils/supabase/server";
import { Location } from '@/types/database.types';

export async function getLocations() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .order("name");

  if (error) throw new Error(error.message);
  return data as Location[];
}
