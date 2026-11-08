package com.alcedo.personal.sync

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Same cases and expectations as pc-server/src/routes/habits.test.ts (computeStreakDays),
 * so a divergence between the Android and server streaks fails here.
 */
class HabitStreakTest {

    @Test
    fun `allowedMissDays=0 - a single missed day breaks the streak`() {
        val logs = setOf("2026-08-05", "2026-08-04", "2026-08-02", "2026-08-01")
        assertEquals(2, HabitStreak.compute(logs, "2026-08-05", 0))
    }

    @Test
    fun `tolerates a gap within the allowed run length`() {
        val logs = setOf("2026-08-05", "2026-08-04", "2026-08-02", "2026-08-01")
        assertEquals(4, HabitStreak.compute(logs, "2026-08-05", 1))
    }

    @Test
    fun `breaks the streak when a gap exceeds allowedMissDays`() {
        val logs = setOf("2026-08-05", "2026-08-04", "2026-08-01")
        assertEquals(2, HabitStreak.compute(logs, "2026-08-05", 1))
    }

    @Test
    fun `absorbs two independent gaps that are each within the allowance`() {
        val logs = setOf("2026-08-05", "2026-08-04", "2026-08-01", "2026-07-31", "2026-07-28")
        assertEquals(5, HabitStreak.compute(logs, "2026-08-05", 2))
    }

    @Test
    fun `streak count only reflects logged days regardless of allowedMissDays`() {
        val logs = setOf("2026-08-04")
        assertEquals(1, HabitStreak.compute(logs, "2026-08-05", 0))
        assertEquals(1, HabitStreak.compute(logs, "2026-08-05", 3))
    }

    @Test
    fun `does not consume the miss budget for today when today is not yet checked in`() {
        val logs = setOf("2026-08-04", "2026-08-03")
        assertEquals(2, HabitStreak.compute(logs, "2026-08-05", 0))
    }

    @Test
    fun `terminates at the earliest logged date even with a large allowance`() {
        assertEquals(1, HabitStreak.compute(setOf("2026-08-05"), "2026-08-05", 5))
    }

    @Test
    fun `empty log set yields a streak of 0`() {
        assertEquals(0, HabitStreak.compute(emptySet(), "2026-08-05", 3))
    }
}
