package com.alcedo.personal.ui.util

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * 時刻ユーティリティ
 * - 保存: UTC
 * - 表示: ローカル時刻
 * - 「今日」の閾値: ローカル時計の午前6時（6時未満は前日扱い）
 */
object TimeUtils {

    /** 6時閾値で補正した「実効的な今日」 */
    fun effectiveLocalDate(): LocalDate {
        val now = LocalDateTime.now()
        return if (now.hour < 6) now.toLocalDate().minusDays(1) else now.toLocalDate()
    }

    /** 実効的な今日を YYYY-MM-DD 文字列で返す */
    fun effectiveLocalDateStr(): String =
        effectiveLocalDate().format(DateTimeFormatter.ISO_LOCAL_DATE)

    /** N日前の実効日付 */
    fun effectiveDaysAgo(n: Int): String =
        effectiveLocalDate().minusDays(n.toLong()).format(DateTimeFormatter.ISO_LOCAL_DATE)

    /** UTC ISO 文字列 → ローカル日付文字列（YYYY-MM-DD） */
    fun String.toLocalDateStr(): String = try {
        Instant.parse(this)
            .atZone(ZoneId.systemDefault())
            .toLocalDate()
            .format(DateTimeFormatter.ISO_LOCAL_DATE)
    } catch (e: Exception) { take(10) }

    /** ローカル日付文字列の day の 06:00 ローカル → UTC ISO 文字列（フィルタ境界用） */
    fun localDayStartUTC(localDate: String): String =
        java.time.LocalDateTime.parse("${localDate}T06:00:00")
            .atZone(ZoneId.systemDefault())
            .toInstant().toString()

    fun localDayEndUTC(localDate: String): String =
        java.time.LocalDateTime.parse("${localDate}T06:00:00")
            .atZone(ZoneId.systemDefault())
            .toInstant()
            .let { Instant.ofEpochSecond(it.epochSecond + 86400) }
            .toString()
}
