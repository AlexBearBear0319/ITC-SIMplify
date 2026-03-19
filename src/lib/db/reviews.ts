// ============================================================
// DATABASE QUERIES: REVIEWS (Location Ratings & Feedback)
// ============================================================
// Functions for students to rate and review study spots.
//
// The reviews table stores:
//   - A 1–5 star rating
//   - An optional written comment
//   - The student who left the review and when
//
// These reviews can be used to:
//   - Show an average star rating on the location card/page
//   - Let students read what others say about a spot
//   - Award points to students for leaving a helpful review
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DbResult, Review } from '@/lib/types/database'

// ─── GET REVIEWS FOR A LOCATION ───────────────────────────────────────────────

/**
 * Fetches all reviews for a specific study spot, newest first.
 * Use this to display the review list on the location detail page.
 *
 * @param locationId - The location to get reviews for
 */
export async function getReviewsForLocation(
  supabase: SupabaseClient,
  locationId: number,
): Promise<DbResult<Review[]>> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })  // Newest reviews first

  if (error) {
    console.error(`[getReviewsForLocation] locationId=${locationId}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: data as Review[], error: null }
}

// ─── GET AVERAGE RATING ───────────────────────────────────────────────────────

/**
 * Calculates the average star rating for a location.
 * Returns a number between 1 and 5, or null if there are no reviews.
 * Use this to display the star rating badge on location cards.
 *
 * @param locationId - The location to calculate the average for
 */
export async function getAverageRating(
  supabase: SupabaseClient,
  locationId: number,
): Promise<DbResult<number | null>> {
  const { data, error } = await getReviewsForLocation(supabase, locationId)

  if (error) return { data: null, error }

  if (!data || data.length === 0) {
    // No reviews yet — return null (not an error)
    return { data: null, error: null }
  }

  // Calculate the average by summing all ratings and dividing by count
  const sum = data.reduce((total, review) => total + (review.rating ?? 0), 0)
  const average = sum / data.length

  // Round to 1 decimal place (e.g., 4.3)
  return { data: Math.round(average * 10) / 10, error: null }
}

// ─── CHECK IF USER ALREADY REVIEWED ──────────────────────────────────────────

/**
 * Checks whether a student has already reviewed a specific location.
 * Use this before showing the "Leave a Review" button — if they've already
 * reviewed, show an "Edit Review" option instead.
 *
 * @param userId     - The student's profile ID
 * @param locationId - The location to check
 */
export async function getUserReviewForLocation(
  supabase: SupabaseClient,
  userId: string,
  locationId: number,
): Promise<DbResult<Review | null>> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('user_id', userId)
    .eq('location_id', locationId)
    .maybeSingle()  // Returns null (not an error) if no review found

  if (error) {
    console.error('[getUserReviewForLocation]', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as Review | null, error: null }
}

// ─── ADD REVIEW ───────────────────────────────────────────────────────────────

/**
 * Submits a new review from a student for a study spot.
 * The student can only review each location once (enforced by the UI —
 * add a unique constraint in Supabase if you want database-level enforcement).
 *
 * After calling this, also call awardPoints(supabase, userId, 'leave_review')
 * from '@/lib/db/points' to give the student their review points.
 *
 * @param locationId - The location being reviewed
 * @param userId     - The student leaving the review
 * @param rating     - Star rating from 1 to 5
 * @param comment    - Optional written feedback
 */
export async function addReview(
  supabase: SupabaseClient,
  locationId: number,
  userId: string,
  rating: number,
  comment?: string,
): Promise<DbResult<Review>> {
  // Validate rating range on the client side too (database also enforces 1–5)
  if (rating < 1 || rating > 5) {
    return { data: null, error: 'Rating must be between 1 and 5.' }
  }

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      location_id: locationId,
      user_id: userId,
      rating,
      comment: comment ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('[addReview]', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as Review, error: null }
}

// ─── UPDATE REVIEW ────────────────────────────────────────────────────────────

/**
 * Updates an existing review (e.g., student wants to change their rating).
 *
 * @param reviewId - The ID of the review to update
 * @param rating   - The new star rating (1–5)
 * @param comment  - The new written comment (optional)
 */
export async function updateReview(
  supabase: SupabaseClient,
  reviewId: number,
  rating: number,
  comment?: string,
): Promise<DbResult<Review>> {
  if (rating < 1 || rating > 5) {
    return { data: null, error: 'Rating must be between 1 and 5.' }
  }

  const { data, error } = await supabase
    .from('reviews')
    .update({ rating, comment: comment ?? null })
    .eq('id', reviewId)
    .select()
    .single()

  if (error) {
    console.error(`[updateReview] reviewId=${reviewId}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: data as Review, error: null }
}
