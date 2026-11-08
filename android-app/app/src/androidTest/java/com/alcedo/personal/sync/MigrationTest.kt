package com.alcedo.personal.sync

import androidx.room.testing.MigrationTestHelper
import androidx.sqlite.db.framework.FrameworkSQLiteOpenHelperFactory
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
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

    @Test
    fun migrate7To8_keepsBeliefsAndHabitsAsSynced() {
        helper.createDatabase(testDb, 7).use { db ->
            db.execSQL("INSERT INTO beliefs (id, text, isActive, createdAt, updatedAt) VALUES ('b1', 'kind', 1, 'c', 'u')")
            db.execSQL("INSERT INTO habits (id, name, notifyTime, isActive, createdAt, updatedAt, allowedMissDays) VALUES ('h1', 'read', NULL, 1, 'c', 'u', 2)")
        }

        helper.runMigrationsAndValidate(testDb, 8, true, AppDatabase.MIGRATION_7_8).use { db ->
            for (table in listOf("beliefs", "habits")) {
                db.query("SELECT syncStatus, deletedAt FROM $table").use { c ->
                    assertEquals(1, c.count)
                    c.moveToFirst()
                    assertEquals("SYNCED", c.getString(0))
                    assertTrue(c.isNull(1))
                }
            }
        }
    }

    /** The path an installed v6 app takes on update: both migrations in a row. */
    @Test
    fun migrate6To8() {
        helper.createDatabase(testDb, 6).use { db ->
            db.execSQL("INSERT INTO habits (id, name, notifyTime, isActive, createdAt, updatedAt, allowedMissDays) VALUES ('h1', 'read', NULL, 1, 'c', 'u', 0)")
            db.execSQL("INSERT INTO habit_logs (habitId, doneDate, createdAt) VALUES ('h1', '2026-11-08', 'c')")
        }
        helper.runMigrationsAndValidate(testDb, 8, true, AppDatabase.MIGRATION_6_7, AppDatabase.MIGRATION_7_8).close()
    }
}
