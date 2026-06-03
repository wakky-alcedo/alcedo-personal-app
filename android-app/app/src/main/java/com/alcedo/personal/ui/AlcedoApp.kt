package com.alcedo.personal.ui

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.alcedo.personal.ui.dashboard.DashboardScreen
import com.alcedo.personal.ui.settings.SettingsScreen

private data class NavItem(val route: String, val label: String, val icon: @Composable () -> Unit)

@Composable
fun AlcedoApp() {
    val navController = rememberNavController()

    val items = listOf(
        NavItem("dashboard", "ホーム") { Icon(Icons.Default.Home, contentDescription = "ホーム") },
        NavItem("settings",  "設定")  { Icon(Icons.Default.Settings, contentDescription = "設定") },
    )

    Scaffold(
        bottomBar = {
            NavigationBar {
                val navBackStack by navController.currentBackStackEntryAsState()
                val current = navBackStack?.destination
                items.forEach { item ->
                    NavigationBarItem(
                        selected = current?.hierarchy?.any { it.route == item.route } == true,
                        onClick = {
                            navController.navigate(item.route) {
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = item.icon,
                        label = { Text(item.label) }
                    )
                }
            }
        }
    ) { _ ->
        NavHost(navController = navController, startDestination = "dashboard") {
            composable("dashboard") { DashboardScreen() }
            composable("settings")  { SettingsScreen() }
        }
    }
}
