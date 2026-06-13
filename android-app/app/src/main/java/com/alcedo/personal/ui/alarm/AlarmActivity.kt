package com.alcedo.personal.ui.alarm

import android.app.KeyguardManager
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.alcedo.personal.notifications.AlarmRingingService
import com.alcedo.personal.ui.theme.AlcedoTheme

/**
 * タスク期限アラームの全画面鳴動画面。ロック画面上にも表示し、「停止」で
 * [AlarmRingingService] を停止する。
 */
class AlarmActivity : ComponentActivity() {

    private val taskTitleState = mutableStateOf("タスク")
    private val dueTimeState = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setupWindowFlags()
        readIntentExtras(intent)

        setContent {
            AlcedoTheme {
                AlarmRingingScreen(
                    taskTitle = taskTitleState.value,
                    dueTime = dueTimeState.value,
                    onStop = {
                        AlarmRingingService.stop(this)
                        finish()
                    }
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        readIntentExtras(intent)
    }

    private fun setupWindowFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        @Suppress("DEPRECATION")
        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        )
        getSystemService(KeyguardManager::class.java)?.requestDismissKeyguard(this, null)
    }

    private fun readIntentExtras(intent: Intent) {
        taskTitleState.value = intent.getStringExtra(AlarmRingingService.EXTRA_TASK_TITLE) ?: "タスク"
        dueTimeState.value = intent.getStringExtra(AlarmRingingService.EXTRA_TASK_DUE_TIME)
    }
}

@Composable
fun AlarmRingingScreen(
    taskTitle: String,
    dueTime: String?,
    onStop: () -> Unit
) {
    Scaffold { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                Icons.Default.Notifications,
                contentDescription = null,
                modifier = Modifier.size(96.dp),
                tint = MaterialTheme.colorScheme.error
            )

            Spacer(Modifier.height(24.dp))
            Text(
                "タスクの期限です",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.height(8.dp))
            Text(
                taskTitle,
                style = MaterialTheme.typography.titleLarge,
                textAlign = TextAlign.Center
            )
            dueTime?.let {
                Spacer(Modifier.height(4.dp))
                Text(
                    "期限: $it",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(Modifier.height(48.dp))
            Button(
                onClick = onStop,
                modifier = Modifier.fillMaxWidth().height(64.dp),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
            ) {
                Text("停止", style = MaterialTheme.typography.headlineSmall)
            }
        }
    }
}
