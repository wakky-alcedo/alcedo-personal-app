package com.alcedo.personal.analytics

/** Android パッケージ名 → カテゴリ の共通マッピング */
object CategoryMapper {
    private val KNOWN = mapOf(
        "com.twitter.android" to "SNS", "com.twitter.android.lite" to "SNS",
        "com.instagram.android" to "SNS", "com.facebook.katana" to "SNS",
        "com.zhiliaoapp.musically" to "SNS", "com.snapchat.android" to "SNS",
        "com.reddit.frontpage" to "SNS",
        "jp.naver.line.android" to "コミュニケーション",
        "org.telegram.messenger" to "コミュニケーション",
        "com.discord" to "コミュニケーション", "com.slack" to "コミュニケーション",
        "com.google.android.gm" to "コミュニケーション",
        "com.google.android.youtube" to "娯楽",
        "com.netflix.mediaclient" to "娯楽",
        "com.amazon.avod.thirdpartyclient" to "娯楽",
        "com.spotify.music" to "娯楽", "jp.co.dwango.niconico" to "娯楽",
        "com.google.android.apps.chrome" to "ブラウザ",
        "org.mozilla.firefox" to "ブラウザ",
        "com.microsoft.edge" to "ブラウザ",
        "com.android.chrome" to "ブラウザ",
        "com.vivaldi.browser" to "ブラウザ", "com.brave.browser" to "ブラウザ",
        "com.google.android.apps.docs" to "開発",
        "com.termux" to "開発",
        "com.anki.flashcards" to "学習", "org.khanacademy.android" to "学習",
        "jp.studyplus.android.app" to "学習",
    )

    fun get(packageName: String): String = KNOWN[packageName] ?: when {
        packageName.contains("mail", true) ||
        packageName.contains("gmail") -> "コミュニケーション"
        packageName.contains("browser", true) ||
        packageName.contains("chrome") -> "ブラウザ"
        packageName.contains("youtube") ||
        packageName.contains("video") ||
        packageName.contains("music") ||
        packageName.contains("player") -> "娯楽"
        else -> "未分類"
    }
}
