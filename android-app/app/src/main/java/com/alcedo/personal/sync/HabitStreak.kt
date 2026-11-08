package com.alcedo.personal.sync

import java.time.LocalDate

/**
 * Mirrors pc-server's computeStreakDays (routes/habits.ts): walks backward from
 * today (or yesterday, if today isn't logged yet), counting completed days.
 * A run of missed days is skipped over as long as its length is within
 * allowedMissDays; a longer run breaks the streak.
 */
object HabitStreak {
    fun compute(doneDates: Set<String>, today: String, allowedMissDays: Int): Int {
        val earliest = LocalDate.parse(doneDates.minOrNull() ?: return 0)
        fun done(d: LocalDate) = d.toString() in doneDates  // LocalDate.toString() is ISO YYYY-MM-DD

        val todayDate = LocalDate.parse(today)
        var cursor = if (done(todayDate)) todayDate else todayDate.minusDays(1)
        var streak = 0

        while (!cursor.isBefore(earliest)) {
            if (done(cursor)) {
                streak++
                cursor = cursor.minusDays(1)
                continue
            }
            var gapLen = 0
            var probe = cursor
            while (!done(probe) && !probe.isBefore(earliest)) {
                gapLen++
                probe = probe.minusDays(1)
            }
            if (gapLen > allowedMissDays) break
            cursor = probe
        }
        return streak
    }
}
