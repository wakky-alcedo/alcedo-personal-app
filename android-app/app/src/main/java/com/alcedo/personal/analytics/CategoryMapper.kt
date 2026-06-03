package com.alcedo.personal.analytics

import android.content.pm.ApplicationInfo

/** Android OS の ApplicationInfo.category をAlcedoのカテゴリ名に変換する */
object CategoryMapper {
    fun fromOsCategory(osCategory: Int): String = when (osCategory) {
        ApplicationInfo.CATEGORY_GAME         -> "娯楽"
        ApplicationInfo.CATEGORY_AUDIO        -> "娯楽"
        ApplicationInfo.CATEGORY_VIDEO        -> "娯楽"
        ApplicationInfo.CATEGORY_SOCIAL       -> "SNS"
        ApplicationInfo.CATEGORY_NEWS         -> "その他"
        ApplicationInfo.CATEGORY_MAPS         -> "その他"
        ApplicationInfo.CATEGORY_PRODUCTIVITY -> "仕事"
        ApplicationInfo.CATEGORY_IMAGE        -> "その他"
        ApplicationInfo.CATEGORY_ACCESSIBILITY -> "その他"
        else                                  -> "未分類"   // CATEGORY_UNDEFINED = -1
    }
}
