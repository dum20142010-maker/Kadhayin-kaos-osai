package com.example.kaos.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.example.kaos.data.KaosRepository
import com.example.kaos.model.MasterSpot
import com.example.kaos.ui.theme.KaosPrimary

@Composable
fun ExploreScreen(
    onSpotSelected: (MasterSpot) -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf("All") }

    val categories = listOf("All", "Architecture", "Food Lore", "Heritage")

    val filteredSpots = KaosRepository.spots.filter { spot ->
        val matchesCategory = selectedCategory == "All" || spot.category.contains(selectedCategory, ignoreCase = true)
        val matchesSearch = spot.title.contains(searchQuery, ignoreCase = true) || spot.zone.contains(searchQuery, ignoreCase = true)
        matchesCategory && matchesSearch
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(16.dp)
    ) {
        Text(
            text = "Master Places Browser",
            style = MaterialTheme.colorScheme.headlineLarge
        )
        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Search Chennai heritage, coffee, architecture...") },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = KaosPrimary,
                unfocusedBorderColor = MaterialTheme.colorScheme.outline
            )
        )

        Spacer(modifier = Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            categories.forEach { category ->
                val isSelected = selectedCategory == category
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (isSelected) KaosPrimary else MaterialTheme.colorScheme.surfaceVariant)
                        .clickable { selectedCategory = category }
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = category,
                        color = if (isSelected) MaterialTheme.colorScheme.onBackground else androidx.compose.ui.graphics.Color.Gray,
                        style = MaterialTheme.colorScheme.labelMedium
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(filteredSpots) { spot ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onSpotSelected(spot) },
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = spot.zone.uppercase(),
                                style = MaterialTheme.colorScheme.labelMedium,
                                color = KaosPrimary
                            )
                            Text(
                                text = "+${spot.xp} XP",
                                style = MaterialTheme.colorScheme.labelMedium,
                                color = KaosPrimary
                            )
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = spot.title,
                            style = MaterialTheme.colorScheme.titleLarge
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = spot.description,
                            style = MaterialTheme.colorScheme.bodyMedium,
                            maxLines = 2
                        )
                    }
                }
            }
        }
    }
}
