package com.alcedo.personal.analytics

import android.content.pm.ApplicationInfo

/** Android OS の ApplicationInfo.category をAlcedoのカテゴリ名に変換する */
object CategoryMapper {
    fun fromOsCategory(osCategory: Int): String = when (osCategory) {
        ApplicationInfo.CATEGORY_GAME         -> "ゲーム"
        ApplicationInfo.CATEGORY_AUDIO        -> "音楽"
        ApplicationInfo.CATEGORY_VIDEO        -> "動画"
        ApplicationInfo.CATEGORY_SOCIAL       -> "SNS"
        ApplicationInfo.CATEGORY_NEWS         -> "ニュース"
        ApplicationInfo.CATEGORY_MAPS         -> "地図"
        ApplicationInfo.CATEGORY_PRODUCTIVITY -> "仕事"
        ApplicationInfo.CATEGORY_IMAGE        -> "写真"
        ApplicationInfo.CATEGORY_ACCESSIBILITY -> "ユーティリティ"
        else                                  -> "未分類"
    }
}
