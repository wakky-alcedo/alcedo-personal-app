package com.alcedo.personal.sync

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

class SyncStatusConverters {
    @TypeConverter
    fun fromSyncStatus(value: SyncStatus): String = value.name

    @TypeConverter
    fun toSyncStatus(value: String): SyncStatus = SyncStatus.valueOf(value)
}

@Database(
    entities = [TaskEntity::class, BeliefEntity::class, HabitEntity::class, HabitLogEntity::class, MemoEntity::class],
    version = 6,
    exportSchema = false
)
@TypeConverters(SyncStatusConverters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun taskDao(): TaskDao
    abstract fun beliefDao(): BeliefDao
    abstract fun habitDao(): HabitDao
    abstract fun memoDao(): MemoDao

    companion object {
        val MIGRATION_5_6 = object : Migration(5, 6) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE habits ADD COLUMN allowedMissDays INTEGER NOT NULL DEFAULT 0")
            }
        }

        val MIGRATION_4_5 = object : Migration(4, 5) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE tasks ADD COLUMN dueTime TEXT")
            }
        }

        val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `memos` (
                        `id` TEXT NOT NULL,
                        `body` TEXT NOT NULL,
                        `sourceUrl` TEXT,
                        `sourceTitle` TEXT,
                        `version` INTEGER NOT NULL,
                        `syncStatus` TEXT NOT NULL DEFAULT 'UNSENT',
                        `createdAt` TEXT NOT NULL,
                        `updatedAt` TEXT NOT NULL,
                        `deletedAt` TEXT,
                        PRIMARY KEY(`id`)
                    )
                """.trimIndent())
            }
        }

        val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE tasks ADD COLUMN subtasks TEXT NOT NULL DEFAULT '[]'")
            }
        }

        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS beliefs (
                        id TEXT NOT NULL PRIMARY KEY,
                        text TEXT NOT NULL,
                        isActive INTEGER NOT NULL,
                        createdAt TEXT NOT NULL,
                        updatedAt TEXT NOT NULL
                    )
                """.trimIndent())
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS habits (
                        id TEXT NOT NULL PRIMARY KEY,
                        name TEXT NOT NULL,
                        notifyTime TEXT,
                        isActive INTEGER NOT NULL,
                        createdAt TEXT NOT NULL,
                        updatedAt TEXT NOT NULL
                    )
                """.trimIndent())
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS habit_logs (
                        habitId TEXT NOT NULL,
                        doneDate TEXT NOT NULL,
                        createdAt TEXT NOT NULL,
                        PRIMARY KEY (habitId, doneDate)
                    )
                """.trimIndent())
            }
        }
    }
}
