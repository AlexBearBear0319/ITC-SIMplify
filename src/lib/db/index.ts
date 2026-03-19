// ============================================================
// DATABASE — CENTRAL EXPORT FILE
// ============================================================
// Import all your database functions from this one file.
// This way teammates don't need to remember which file each
// function lives in — just import from '@/lib/db'.
//
// EXAMPLES:
//   import { getAllLocations, getLocationById } from '@/lib/db'
//   import { checkIn, checkOut } from '@/lib/db'
//   import { getProfile, getLeaderboard } from '@/lib/db'
//   import { awardPoints, redeemItem, POINT_ACTIONS } from '@/lib/db'
// ============================================================

// Study spots / locations
export * from './locations'

// Student check-in / check-out sessions
export * from './sessions'

// Student profiles and accounts
export * from './profiles'

// School events that block locations
export * from './events'

// Study groups (study buddy feature)
export * from './study-groups'

// Points, missions, and rewards store
export * from './points'

// Location reviews and ratings
export * from './reviews'
