package com.alcedo.personal

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.alcedo.personal.sync.SyncConfig
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers

class SettingsActivity : AppCompatActivity() {
    private lateinit var serverUrlInput: EditText
    private lateinit var apiKeyInput: EditText

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        serverUrlInput = findViewById(R.id.serverUrlInput)
        apiKeyInput = findViewById(R.id.apiKeyInput)

        lifecycleScope.launch {
            // read current values
            val url = withContext(Dispatchers.IO) { SyncConfig.getServerUrl(this@SettingsActivity) }
            val key = withContext(Dispatchers.IO) { SyncConfig.getApiKey(this@SettingsActivity) }
            serverUrlInput.setText(url)
            apiKeyInput.setText(key)
        }

        findViewById<Button>(R.id.saveSettingsButton).setOnClickListener {
            lifecycleScope.launch(Dispatchers.IO) {
                val url = serverUrlInput.text?.toString()?.trim() ?: ""
                val key = apiKeyInput.text?.toString()?.trim() ?: ""
                SyncConfig.save(this@SettingsActivity, url, key)
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@SettingsActivity, "保存しました", Toast.LENGTH_SHORT).show()
                    finish()
                }
            }
        }
    }
}
