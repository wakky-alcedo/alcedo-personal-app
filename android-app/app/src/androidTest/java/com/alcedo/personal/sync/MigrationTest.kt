package com.alcedo.personal.sync

import androidx.room.testing.MigrationTestHelper
import androidx.sqlite.db.framework.FrameworkSQLiteOpenHelperFactory
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Runs the real Room migrations against databases created from the exported schemas
 * (app/schemas) and lets Room validate the result. Uses its own DB file, never the app's.
 */
@RunWith(AndroidJUnit4::class)
class MigrationTest {

    private val testDb = "migration-test"

    @get:Rule
    val helper = MigrationTestHelper(
        InstrumentationRegistry.getInstrumentation(),
        AppDatabase::class.java,
        emptyList(),
        FrameworkSQLiteOpenHelperFactory()
    )

    @Test
    fun migrate6To7_marksExistingCheckInsUnsent() {
        helper.createDatabase(testDb, 6).use { db ->
            db.execSQL("INSERT INTO habits (id, name, notifyTime, isActive, createdAt, updatedAt, allowedMissDays) VALUES ('h1', 'read', NULL, 1, 'c', 'u', 0)")
            db.execSQL("INSERT INTO habit_logs (habitId, doneDate, createdAt) VALUES ('h1', '2026-11-07', 'c')")
            db.execSQL("INSERT INTO habit_logs (habitId, doneDate, createdAt) VALUES ('h1', '2026-11-08', 'c')")
        }

        helper.runMigrationsAndValidate(testDb, 7, true, AppDatabase.MIGRATION_6_7).use { db ->
            db.query("SELECT doneDate, syncStatus FROM habit_logs ORDER BY doneDate").use { c ->
                assertEquals(2, c.count)
                while (c.moveToNext()) assertEquals("UNSENT", c.getString(1))
            }
        }
    }
}
