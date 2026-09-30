package com.example.kaos.MainActivity

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kaos.model.MasterSpot
import com.example.kaos.ui.components.BottomBar
import com.example.kaos.ui.screens.*
import com.example.kaos.ui.theme.KAOSTheme
import com.example.kaos.ui.theme.KaosPrimary
import kotlinx.coroutines.delay

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            KAOSTheme {
                var showSplash by remember { mutableStateOf(true) }

                LaunchedEffect(Unit) {
                    delay(2000)
                    showSplash = false
                }

                Box(modifier = Modifier.fillMaxSize()) {
                    MainAppScaffold()

                    AnimatedVisibility(
                        visible = showSplash,
                        enter = fadeIn(),
                        exit = fadeOut()
                    ) {
                        SplashScreen()
                    }
                }
            }
        }
    }
}

@Composable
fun SplashScreen() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(24.dp)
        ) {
            Text(
                text = "Every place has a story.",
                style = MaterialTheme.colorScheme.titleLarge,
                color = KaosPrimary
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "KAOS",
                style = MaterialTheme.colorScheme.headlineLarge,
                fontSize = 56.sp,
                fontWeight = FontWeight.Bold,
                color = KaosPrimary
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Discover heritage, urban secrets & lore",
                style = MaterialTheme.colorScheme.bodyMedium
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainAppScaffold() {
    var currentTab by remember { mutableStateOf("home") }
    var selectedSpot by remember { mutableStateOf<MasterSpot?>(null) }

    Scaffold(
        bottomBar = {
            BottomBar(
                currentTab = currentTab,
                onTabSelected = { currentTab = it }
            )
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when (currentTab) {
                "home" -> HomeScreen(onSpotSelected = { selectedSpot = it })
                "explore" -> ExploreScreen(onSpotSelected = { selectedSpot = it })
                "map" -> MapScreen()
                "adventures" -> AdventuresScreen()
                "profile" -> ProfileScreen()
            }

            selectedSpot?.let { spot ->
                SpotDetailModal(
                    spot = spot,
                    onDismiss = { selectedSpot = null }
                )
            }
        }
    }
}

@Composable
fun SpotDetailModal(
    spot: MasterSpot,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Column {
                Text(text = spot.zone.uppercase(), color = KaosPrimary, fontSize = 11.sp)
                Spacer(modifier = Modifier.height(4.dp))
                Text(text = spot.title)
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(text = spot.fullStory, style = MaterialTheme.colorScheme.bodyMedium)
                Spacer(modifier = Modifier.height(4.dp))
                Text(text = "Audio Guide:", fontWeight = FontWeight.Bold, color = KaosPrimary)
                Text(text = spot.audioGuideScript, style = MaterialTheme.colorScheme.bodyMedium)
            }
        },
        confirmButton = {
            Button(
                onClick = onDismiss,
                colors = ButtonDefaults.buttonColors(containerColor = KaosPrimary)
            ) {
                Text("Close")
            }
        },
        containerColor = MaterialTheme.colorScheme.surface
    )
}
