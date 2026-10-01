package com.example.kaos.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kaos.ui.theme.KaosPrimary

@Composable
fun MapScreen() {
    var activeSoundscape by remember { mutableStateOf("Temple Chimes & Bells") }
    var arLensActive by remember { mutableStateOf(true) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "AR Live Lens & Acoustic Radar",
            style = MaterialTheme.colorScheme.headlineLarge
        )

        // AR Viewport Simulation Card
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            shape = RoundedCornerShape(20.dp)
        ) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                // Simulated Camera Feed Background
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.DarkGray.copy(alpha = 0.4f)),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = "📷", fontSize = 48.sp)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "AR Spatial Viewport Active",
                            style = MaterialTheme.colorScheme.titleLarge,
                            color = KaosPrimary
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Pointing towards Senate House • 850m",
                            style = MaterialTheme.colorScheme.bodyMedium
                        )
                    }
                }

                // HUD Overlay elements
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(16.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color.Black.copy(alpha = 0.7f))
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text(text = "GPS: 13.0642° N, 80.2811° E", color = KaosPrimary, fontSize = 11.sp)
                }
            }
        }

        // Acoustic Soundscape Controller
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "IMMERSIVE ACOUSTIC SOUNDSCAPE",
                    style = MaterialTheme.colorScheme.labelMedium,
                    color = KaosPrimary
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = activeSoundscape,
                    style = MaterialTheme.colorScheme.titleLarge
                )
                Spacer(modifier = Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = { activeSoundscape = "Temple Chimes & Bells" },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = if (activeSoundscape.contains("Temple")) KaosPrimary else MaterialTheme.colorScheme.surfaceVariant)
                    ) {
                        Text("Chimes", fontSize = 11.sp)
                    }
                    Button(
                        onClick = { activeSoundscape = "1920s Filter Coffee Roaster" },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = if (activeSoundscape.contains("Coffee")) KaosPrimary else MaterialTheme.colorScheme.surfaceVariant)
                    ) {
                        Text("Coffee", fontSize = 11.sp)
                    }
                    Button(
                        onClick = { activeSoundscape = "Marina Bay Waves" },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = if (activeSoundscape.contains("Marina")) KaosPrimary else MaterialTheme.colorScheme.surfaceVariant)
                    ) {
                        Text("Waves", fontSize = 11.sp)
                    }
                }
            }
        }
    }
}
