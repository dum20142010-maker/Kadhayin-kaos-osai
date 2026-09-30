package com.example.kaos.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.kaos.data.KaosRepository
import com.example.kaos.ui.theme.KaosPrimary

@Composable
fun ProfileScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Profile Header Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            shape = RoundedCornerShape(20.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(text = "🛡️", fontSize = 48.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = "Usha Baskar", style = MaterialTheme.colorScheme.headlineMedium)
                Text(text = "@ushabaskar • Explorer Lvl 4", color = KaosPrimary, style = MaterialTheme.colorScheme.bodyMedium)
                Spacer(modifier = Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceAround
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = "1,420", style = MaterialTheme.colorScheme.titleLarge, color = KaosPrimary)
                        Text(text = "Total XP", style = MaterialTheme.colorScheme.labelMedium)
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = "5", style = MaterialTheme.colorScheme.titleLarge, color = KaosPrimary)
                        Text(text = "Stamps", style = MaterialTheme.colorScheme.labelMedium)
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = "2", style = MaterialTheme.colorScheme.titleLarge, color = KaosPrimary)
                        Text(text = "Perks Claimed", style = MaterialTheme.colorScheme.labelMedium)
                    }
                }
            }
        }

        Text(
            text = "PASSPORT STAMPS COLLECTION",
            style = MaterialTheme.colorScheme.titleLarge
        )

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(KaosRepository.stamps) { stamp ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(text = stamp.icon, fontSize = 36.sp)
                        Spacer(modifier = Modifier.width(16.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(text = stamp.title, style = MaterialTheme.colorScheme.titleLarge)
                                Text(text = "+${stamp.xpValue} XP", color = KaosPrimary, style = MaterialTheme.colorScheme.labelMedium)
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(text = stamp.description, style = MaterialTheme.colorScheme.bodyMedium)
                        }
                    }
                }
            }
        }
    }
}
