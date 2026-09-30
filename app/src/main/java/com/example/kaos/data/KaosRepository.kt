package com.example.kaos.data

import com.example.kaos.model.MasterSpot
import com.example.kaos.model.PassportStamp
import com.example.kaos.model.SecretPerk
import com.example.kaos.model.TerritoryLeader

object KaosRepository {
    val spots = listOf(
        MasterSpot(
            id = 'senate-house'.toString(),
            title = 'Senate House Stained Glass & Brickwork',
            category = 'Architecture',
            categoryKey = 'architecture',
            zone = 'Chepauk',
            distance = '850m away',
            duration = '15 min walk',
            xp = 90,
            description = "Robert Chisholm's masterwork harmonising Byzantine stone vaults with Mughal sunshades. Catch the crimson rosette refraction.",
            fullStory = "Designed by Robert Chisholm and completed in 1879, Senate House stands as a monumental synthesis of Indo-Saracenic architecture. The great assembly hall features vaulted Byzantine ceilings, polychrome tiled floorings, and majestic stained-glass rose windows.",
            openHours = '09:30 – 16:30',
            imageUrl = 'https://images.unsplash.com/photo-1548013146-72479768bbaa?auto=format&fit=crop&w=800&q=80',
            vintageYear = '1888 Vintage Madras Survey Archive',
            architecturalStyle = 'Indo-Saracenic & Byzantine Vaults',
            audioGuideScript = "You are standing before the crown jewel of Madras Indo-Saracenic design. Notice how the four corner minarets mirror Mughal domes, while the soaring central hall utilizes Christian Byzantine brick-arch engineering.",
            soundscapeType = 'belfry',
            secretPerkTitle = 'Archive Vault Access'
        ),
        MasterSpot(
            id = 'coffee-roasters',
            title = 'The 1920s Filter Coffee Roasters',
            category = 'Food Lore',
            categoryKey = 'food',
            zone = 'Triplicane',
            distance = '1.2 km away',
            duration = '25 min walk',
            xp = 75,
            description = 'Third-generation roasters grinding slow chicory blends in antique iron drums. Ask for the 80:20 plantation roast.',
            fullStory = 'Nestled in the bustling alleys of Triplicane, this family-run roastery has been crackling with freshly roasted peaberry beans since 1924. The aroma of slow-ground chicory defines morning routines for generations.',
            openHours = '10:00 AM – 19:00 PM',
            imageUrl = 'https://images.unsplash.com/photo-1509785307050-d4066910ec1e?auto=format&fit=crop&w=800&q=80',
            vintageYear = '1932 Triplicane Market Ledger',
            architecturalStyle = 'Madras Heritage Timber Shopfront',
            audioGuideScript = "Breathe in the deep, caramelized chicory fragrance. In this 100-year-old shop, the roasting drum turns exactly 42 revolutions per minute over seasoned tamarind wood coals.",
            soundscapeType = 'filter-coffee',
            secretPerkTitle = 'Peaberry Secret Brew 20% Off'
        ),
        MasterSpot(
            id = 'armenian-church',
            title = 'Armenian Church Bell Tower',
            category = 'Heritage',
            categoryKey = 'heritage',
            zone = 'George Town',
            distance = '2.1 km away',
            duration = '28 min walk',
            xp = 110,
            description = 'Housing six monumental bells cast in Whitechapel and Amsterdam. A hushed courtyard blanketed in frangipani blossoms.',
            fullStory = 'Founded in 1712 and rebuilt in 1772, the Armenian Church of St. Mary is an oasis of profound silence. Its iconic belfry houses six colossal bells weighing up to 150 kilograms each.',
            openHours = 'Sundays 09:00 AM',
            imageUrl = 'https://images.unsplash.com/photo-1584824486509-112e4181ff6b?auto=format&fit=crop&w=800&q=80',
            vintageYear = '1794 Armenian Heritage Chronicle',
            architecturalStyle = 'Armenian Colonial Baroque',
            audioGuideScript = "Step across the white threshold into a sanctuary of stillness. The six giant bells above you were cast in London and Amsterdam between 1754 and 1837.",
            soundscapeType = 'temple-chimes',
            secretPerkTitle = 'Belfry Vault Key'
        ),
        MasterSpot(
            id = 'rayars-mess',
            title = "Rayar's Mess Secret Ghee Dosa",
            category = 'Food Lore',
            categoryKey = 'food',
            zone = 'Mylapore',
            distance = '1.2 km away',
            duration = '20 min walk',
            xp = 85,
            description = 'The 70-year ritual of wood-fired cast iron crisps served on fresh banana leaves with emerald coriander chutney.',
            fullStory = "Operating out of a modest residential doorway in Mylapore since the 1950s, Rayar's Mess serves only a limited batch of idlis and golden ghee dosas each morning.",
            openHours = '07:00 – 11:30',
            imageUrl = 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80',
            vintageYear = '1954 Mylapore Heritage Food Map',
            architecturalStyle = 'Traditional Thinnai Courtyard',
            audioGuideScript = "Listen to the rhythmic sizzle of fresh rice-and-urad batter hitting seasoned 80-year-old cast iron skillets.",
            soundscapeType = 'filter-coffee',
            secretPerkTitle = 'Double Podi Ghee Upgrade'
        ),
        MasterSpot(
            id = 'kapaleeshwarar',
            title = 'Kapaleeshwarar Teppakulam & Tank',
            category = 'Heritage',
            categoryKey = 'heritage',
            zone = 'Mylapore',
            distance = '1.6 km away',
            duration = '22 min walk',
            xp = 120,
            description = 'Ancient stone tank surrounded by traditional agraharam streets, reflecting 7th-century Dravidian gopuram sculptures.',
            fullStory = "The sacred temple tank of Kapaleeshwarar Temple is the focal point of Mylapore's spiritual life. Fed by underground springs, it hosts the vibrant float festival.",
            openHours = '05:30 – 21:30',
            imageUrl = 'https://images.unsplash.com/photo-1621570216025-d227b2b6ef55?auto=format&fit=crop&w=800&q=80',
            vintageYear = '1910 Madras Photographic Society',
            architecturalStyle = 'Classic Dravidian Granite Masonry',
            audioGuideScript = "The monumental granite steps descend into sacred waters aligned with ancient cosmological constellations.",
            soundscapeType = 'temple-chimes',
            secretPerkTitle = 'Sacred Prasadam Token'
        )
    )

    val stamps = listOf(
        PassportStamp(
            id = 'stamp-senate',
            title = 'Senate House Guardian',
            zone = 'Chepauk',
            rarity = 'Rare',
            icon = '🏛️',
            xpValue = 150,
            description = 'Discovered Robert Chisholm’s Indo-Saracenic stained glass rosette.',
            unlocked = true
        ),
        PassportStamp(
            id = 'stamp-coffee',
            title = 'Triplicane Roastery Master',
            zone = 'Triplicane',
            rarity = 'Common',
            icon = '☕',
            xpValue = 100,
            description = 'Tasted the 1924 peaberry chicory brew.',
            unlocked = true
        ),
        PassportStamp(
            id = 'stamp-armenian',
            title = 'Belfry Seeker',
            zone = 'George Town',
            rarity = 'Legendary',
            icon = '🔔',
            xpValue = 250,
            description = 'Unlocks Whitechapel bell resonance frequency.',
            unlocked = false
        )
    )

    val perks = listOf(
        SecretPerk(
            id = 'perk-peaberry-tasting',
            placeName = 'The 1920s Filter Coffee Roasters',
            zone = 'Triplicane',
            perkTitle = 'Complimentary Second Brass Tumbler',
            secretCode = 'KAOS-PEABERRY-1924',
            secretMenuDish = 'Jaggery Filter Decoction & Butter Bun',
            perkValue = '₹120 Value',
            status = 'available',
            imageUrl = 'https://images.unsplash.com/photo-1509785307050-d4066910ec1e?auto=format&fit=crop&w=600&q=80'
        ),
        SecretPerk(
            id = 'perk-senate-archive',
            placeName = 'Senate House',
            zone = 'Chepauk',
            perkTitle = 'Curator Ledger VIP Tour',
            secretCode = 'CHISHOLM-ARCHIVE-88',
            secretMenuDish = 'Access to 1879 Architectural Blueprints',
            perkValue = 'Exclusive Experience',
            status = 'locked',
            imageUrl = 'https://images.unsplash.com/photo-1548013146-72479768bbaa?auto=format&fit=crop&w=600&q=80'
        )
    )

    val territoryLeaders = listOf(
        TerritoryLeader(1, 'Aravind K.', 4820, 14, '👑'),
        TerritoryLeader(2, 'Divya Ramesh', 3950, 11, '🥈'),
        TerritoryLeader(3, 'Karthik V.', 3410, 9, '🥉')
    )
}
