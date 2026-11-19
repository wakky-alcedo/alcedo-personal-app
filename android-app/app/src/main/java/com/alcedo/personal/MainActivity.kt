package com.alcedo.personal

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.alcedo.personal.analytics.UsageStatsSyncWorker
import com.alcedo.personal.ui.AlcedoApp
import com.alcedo.personal.ui.theme.AlcedoTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            AlcedoTheme {
                AlcedoApp()
            }
        }
    }

    /** アプリを開くたびに作業ログを送る(定期同期は最短でも 15 分間隔のため) */
    override fun onStart() {
        super.onStart()
        UsageStatsSyncWorker.runNow(this)
    }
}
