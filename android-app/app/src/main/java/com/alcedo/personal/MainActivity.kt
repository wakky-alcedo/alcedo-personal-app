package com.alcedo.personal

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
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
}
