package com.example.kaos.ui.components

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.example.kaos.ui.theme.KaosPrimary

@Composable
fun BottomBar(
    currentTab: String,
    onTabSelected: (String) -> Unit
) {
    NavigationBar(
        containerColor = MaterialTheme.colorScheme.surface,
        contentColor = MaterialTheme.colorScheme.onSurface
    ) {
        val items = listOf(
            Triple("home", "Discover", "🏠"),
            Triple("explore", "Explore", "🗺️"),
            Triple("map", "AR Lens", "📷"),
            Triple("adventures", "Quests", "🎯"),
            Triple("profile", "Passport", "🎖️")
        )

        items.forEach { (tabKey, label, iconSymbol) ->
            val selected = currentTab == tabKey
            NavigationBarItem(
                selected = selected,
                onClick = { onTabSelected(tabKey) },
                icon = { Text(text = iconSymbol, fontSize = androidx.compose.ui.unit.TextUnit.Unspecified) },
                label = { Text(text = label) },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = KaosPrimary,
                    selectedTextColor = KaosPrimary,
                    unselectedIconColor = Color.Gray,
                    unselectedTextColor = Color.Gray,
                    indicatorColor = MaterialTheme.colorScheme.surfaceVariant
                )
            )
        }
    }
}
