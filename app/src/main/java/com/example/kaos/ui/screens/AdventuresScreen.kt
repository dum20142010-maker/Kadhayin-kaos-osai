package com.example.kaos.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.kaos.data.KaosRepository
import com.example.kaos.ui.theme.KaosPrimary

@Composable
fun AdventuresScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Quests & District Territories",
            style = MaterialTheme.colorScheme.headlineLarge
        )

        // Territory Leaderboard Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            shape = RoundedCornerShape(20.dp)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text(
                    text = "MYLAPORE TERRITORY LEADERBOARD",
                    style = MaterialTheme.colorScheme.labelMedium,
                    color = KaosPrimary
                )
                Spacer(modifier = Modifier.height(12.dp))
                KaosRepository.territoryLeaders.forEach { leader ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 6.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(text = "${leader.rank}. ${leader.avatar} ${leader.name}", style = MaterialTheme.colorScheme.bodyLarge)
                        Text(text = "${leader.xp} XP", color = KaosPrimary, style = MaterialTheme.colorScheme.titleLarge)
                    }
                }
            }
        }

        Text(
            text = "ACTIVE EXPEDITIONS",
            style = MaterialTheme.colorScheme.titleLarge,
            modifier = Modifier.padding(top = 8.dp)
        )

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(text = "GEORGE TOWN ARCHITECTURAL RAID", color = KaosPrimary, style = MaterialTheme.colorScheme.labelMedium)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(text = "Armenian Church & High Court Mission", style = MaterialTheme.colorScheme.titleLarge)
                        Spacer(modifier = Modifier.height(8.dp))
                        LinearProgressIndicator(
                            progress = { 0.65f },
                            modifier = Modifier.fillMaxWidth(),
                            color = KaosPrimary,
                            trackColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(text = "65% Completed • 3 Stops Remaining", style = MaterialTheme.colorScheme.bodyMedium)
                    }
                }
            }
        }
    }
}
