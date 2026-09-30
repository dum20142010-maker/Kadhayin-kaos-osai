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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.kaos.data.KaosRepository
import com.example.kaos.model.MasterSpot
import com.example.kaos.ui.theme.KaosPrimary

@Composable
fun HomeScreen(
    onSpotSelected: (MasterSpot) -> Unit
) {
    var selectedMood by remember { mutableStateOf("Balanced") }
    val moods = listOf("Balanced", "Heritage", "Coastal", "Coffee", "Cyber")

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Header Banner & Explorer Badge
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(20.dp)
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "KAOS OS.AI",
                                style = MaterialTheme.colorScheme.labelMedium,
                                color = KaosPrimary
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Chennai Explorer Lvl 4",
                                style = MaterialTheme.colorScheme.headlineMedium
                            )
                        }
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(KaosPrimary.copy(alpha = 0.2f))
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text(
                                text = "🔥 5 Streak",
                                color = KaosPrimary,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Mood Radar Selector
                    Text(
                        text = "VIBE RADAR",
                        style = MaterialTheme.colorScheme.labelMedium,
                        color = Color.Gray
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        moods.forEach { mood ->
                            val isSelected = selectedMood == mood
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (isSelected) KaosPrimary else MaterialTheme.colorScheme.surfaceVariant)
                                    .clickable { selectedMood = mood }
                                    .padding(vertical = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = mood,
                                    color = if (isSelected) Color.White else Color.Gray,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                }
            }
        }

        // Daily Challenge Card
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                ),
                shape = RoundedCornerShape(20.dp)
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(text = "🎯", fontSize = 24.sp)
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = "Daily Discovery Challenge",
                                style = MaterialTheme.colorScheme.titleLarge,
                                color = KaosPrimary
                            )
                            Text(
                                text = "Visit Senate House & capture the crimson rosette.",
                                style = MaterialTheme.colorScheme.bodyMedium
                            )
                        }
                    }
                }
            }
        }

        // Curated Discoveries Section
        item {
            Text(
                text = "CURATED SPOTS & LORE",
                style = MaterialTheme.colorScheme.titleLarge,
                modifier = Modifier.padding(top = 8.dp)
            )
        }

        items(KaosRepository.spots) { spot ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onSpotSelected(spot) },
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(180.dp)
                    ) {
                        AsyncImage(
                            model = spot.imageUrl,
                            contentDescription = spot.title,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )
                        Box(
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .padding(12.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color.Black.copy(alpha = 0.7f))
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = "+${spot.xp} XP",
                                color = KaosPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                        }
                    }

                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = spot.zone.uppercase(),
                            style = MaterialTheme.colorScheme.labelMedium,
                            color = KaosPrimary
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = spot.title,
                            style = MaterialTheme.colorScheme.titleLarge
                        )
                        Spacer(modifier = Modifier.height(6.dp))
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
