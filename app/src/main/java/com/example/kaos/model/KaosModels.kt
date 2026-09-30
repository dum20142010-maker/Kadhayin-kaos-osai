package com.example.kaos.model

data class MasterSpot(
    val id: String,
    val title: String,
    val category: String,
    val categoryKey: String,
    val zone: String,
    val distance: String,
    val duration: String,
    val xp: Int,
    val description: String,
    val fullStory: String,
    val openHours: String,
    val imageUrl: String,
    val vintageYear: String,
    val architecturalStyle: String,
    val audioGuideScript: String,
    val soundscapeType: String,
    val secretPerkTitle: String? = null
)

data class PassportStamp(
    val id: String,
    val title: String,
    val zone: String,
    val rarity: String,
    val icon: String,
    val xpValue: Int,
    val description: String,
    val unlocked: Boolean
)

data class SecretPerk(
    val id: String,
    val placeName: String,
    val zone: String,
    val perkTitle: String,
    val secretCode: String,
    val secretMenuDish: String,
    val perkValue: String,
    val status: String, // available, claimed, locked
    val imageUrl: String
)

data class TerritoryLeader(
    val rank: Int,
    val name: String,
    val xp: Int,
    val streak: Int,
    val avatar: String
)
