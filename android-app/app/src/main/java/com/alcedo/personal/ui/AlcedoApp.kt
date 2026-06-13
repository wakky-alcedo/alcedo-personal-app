package com.alcedo.personal.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.alcedo.personal.analytics.AnalyticsScreen
import com.alcedo.personal.ui.dashboard.DashboardScreen
import com.alcedo.personal.ui.memos.MemosScreen
import com.alcedo.personal.ui.tasks.TasksScreen
import com.alcedo.personal.ui.settings.BeliefsManagementScreen
import com.alcedo.personal.ui.settings.HabitsManagementScreen
import com.alcedo.personal.ui.settings.SettingsScreen
import com.alcedo.personal.ui.tasks.TaskDetailScreen

private data class NavItem(val route: String, val label: String, val icon: @Composable () -> Unit)

@Composable
fun AlcedoApp() {
    val navController = rememberNavController()

    val rootItems = listOf(
        NavItem("dashboard", "ホーム")  { Icon(Icons.Default.Home,          null) },
        NavItem("tasks",     "タスク")  { Icon(Icons.Default.CheckCircle,   null) },
        NavItem("memos",     "メモ")    { Icon(Icons.Default.Edit,          null) },
        NavItem("analytics", "分析")    { Icon(Icons.Default.DateRange,     null) },
        NavItem("settings",  "設定")    { Icon(Icons.Default.Settings,      null) },
    )

    Scaffold(
        bottomBar = {
            val navBackStack by navController.currentBackStackEntryAsState()
            val current = navBackStack?.destination
            val showBar = rootItems.any { current?.hierarchy?.any { d -> d.route == it.route } == true }
            if (showBar) {
                NavigationBar {
                    rootItems.forEach { item ->
                        NavigationBarItem(
                            selected = current?.hierarchy?.any { it.route == item.route } == true,
                            onClick = {
                                navController.navigate(item.route) {
                                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true; restoreState = true
                                }
                            },
                            icon = item.icon,
                            label = { Text(item.label) }
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController,
            startDestination = "dashboard",
            modifier = Modifier.padding(bottom = innerPadding.calculateBottomPadding())
        ) {
            composable("dashboard") {
                DashboardScreen(onNavigateToTask = { taskId -> navController.navigate("tasks/$taskId") })
            }
            composable("tasks") {
                TasksScreen(onNavigateToDetail = { taskId -> navController.navigate("tasks/$taskId") })
            }
            composable("memos") { MemosScreen() }
            composable("analytics") { AnalyticsScreen() }
            composable(
                "tasks/{taskId}",
                arguments = listOf(navArgument("taskId") { type = NavType.StringType })
            ) {
                TaskDetailScreen(onBack = { navController.popBackStack() })
            }
            composable("settings") {
                SettingsScreen(
                    onNavigateToBeliefs = { navController.navigate("settings/beliefs") },
                    onNavigateToHabits  = { navController.navigate("settings/habits") }
                )
            }
            composable("settings/beliefs") {
                BeliefsManagementScreen(onBack = { navController.popBackStack() })
            }
            composable("settings/habits") {
                HabitsManagementScreen(onBack = { navController.popBackStack() })
            }
        }
    }
}
