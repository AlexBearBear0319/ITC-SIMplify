"use client";

import { useState, useEffect } from "react";
import { Users, Clock } from "lucide-react";
import InteractiveMap from "@/components/features/InteractiveMap";
import { createClient } from "@/utils/supabase/client";
import type { Location } from "@/types/database.types";

export default function HomePage() {
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Fetch locations from Supabase
  useEffect(() => {
    async function fetchLocations() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("locations")
          .select("*")
          .order("name");

        if (error) throw error;
        
        setAllLocations(data || []);
      } catch (err) {
        console.error("Error fetching locations:", err);
        setError(err instanceof Error ? err.message : "Failed to load locations");
      } finally {
        setIsLoading(false);
      }
    }

    fetchLocations();
  }, []);

  // Filter locations based on selected status
  const filteredLocations = statusFilter
    ? allLocations.filter((loc) => loc.current_status === statusFilter)
    : allLocations;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto w-full">
      {/* Campus Map Section */}
      <section className="mb-6 md:mb-8 w-full">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-xl md:text-2xl font-bold text-gray-800 shrink-0">Campus Map</h2>
              
              {/* Status Filter Buttons */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setStatusFilter(null)}
                  className={`px-3 py-1.5 text-xs md:text-sm border rounded-lg transition-colors ${
                    statusFilter === null
                      ? "bg-gray-800 text-white border-gray-800"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setStatusFilter("Empty")}
                  className={`px-3 py-1.5 text-xs md:text-sm border rounded-lg transition-colors ${
                    statusFilter === "Empty"
                      ? "bg-mint text-green-800 border-mint-300"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  Empty
                </button>
                <button
                  onClick={() => setStatusFilter("Busy")}
                  className={`px-3 py-1.5 text-xs md:text-sm border rounded-lg transition-colors ${
                    statusFilter === "Busy"
                      ? "bg-cream text-yellow-800 border-cream-300"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  Busy
                </button>
                <button
                  onClick={() => setStatusFilter("Full")}
                  className={`px-3 py-1.5 text-xs md:text-sm border rounded-lg transition-colors ${
                    statusFilter === "Full"
                      ? "bg-rose text-red-800 border-rose-300"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  Full
                </button>
              </div>
            </div>

            {/* Map Container */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-64 md:h-96 lg:h-100">
              {isLoading ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
                    <p className="text-gray-600">Loading locations...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="w-full h-full flex items-center justify-center bg-red-50">
                  <div className="text-center p-6">
                    <p className="text-red-600 font-semibold mb-2">Error loading locations</p>
                    <p className="text-red-500 text-sm">{error}</p>
                    <button 
                      onClick={() => window.location.reload()}
                      className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : (
                <InteractiveMap locations={filteredLocations} />
              )}
            </div>

            {/* Map Navigation */}
            <div className="flex items-center justify-center gap-4 mt-4">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
              <span className="text-sm font-medium text-gray-600">L1</span>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>
          </section>

          {/* Campus Spots Section */}
          <section>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">Campus Spots</h2>
            
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
                    <div className="h-8 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-12 text-red-500">
                <p>Failed to load campus spots</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
                  {filteredLocations.map((spot) => (
                    <div
                      key={spot.id}
                      className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-gray-800 text-sm">{spot.name}</h3>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            spot.current_status === "Empty"
                              ? "bg-mint-100 text-green-700"
                              : spot.current_status === "Busy"
                                ? "bg-cream-200 text-yellow-700"
                                : "bg-rose-200 text-red-700"
                          }`}
                        >
                          ● {spot.current_status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-3">{spot.category}</p>
                      <button className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">
                        View
                      </button>
                    </div>
                  ))}
                </div>

                {filteredLocations.length === 0 && !isLoading && (
                  <div className="text-center py-12 text-gray-500">
                    <p>No locations found with this status.</p>
                  </div>
                )}
              </>
            )}

            {/* Navigation Arrows */}
            <div className="flex items-center justify-center gap-4">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>
          </section>

          {/* Action Section */}
          <section className="mt-6 md:mt-8">
            <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-4">
              Ready to tackle your work, <span className="italic">[name]</span>?
            </h3>
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
              <button className="flex-1 py-3 md:py-4 bg-cream-100 hover:bg-cream-200 text-yellow-800 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors border border-cream-300">
                <Users size={20} /> Find study buddy
              </button>
              <button className="flex-1 py-3 md:py-4 bg-mint-100 hover:bg-mint-200 text-green-800 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors border border-mint-300">
                <Clock size={20} /> Start study timer
              </button>
            </div>
          </section>
    </div>
  );
}
