export type TabType = 'home' | 'explore' | 'map' | 'ar-quest' | 'adventures' | 'groups' | 'journal' | 'me-profile';

export interface Discovery {
  id: string;
  title: string;
  category: string;
  categoryKey: 'heritage' | 'food' | 'architecture' | 'secret';
  zone: string;
  distance: string;
  duration: string;
  provenance: string;
  imageUrl: string;
  description: string;
  fullStory: string;
  openHours: string;
  xp: number;
  curator?: string;
  imagePrompt?: string;
  coordinates?: { lat?: number; lng?: number; top?: string | number; left?: string | number };
  secretPerkId?: string;
  vintageYear?: string;
  vintageImageUrl?: string;
  architecturalStyle?: string;
  audioGuideScript?: string;
  soundscapeType?: 'temple-chimes' | 'filter-coffee' | 'marina-waves' | 'monsoon-rain' | 'belfry';
}

export interface NeighbourhoodZone {
  name: string;
  spotsCount: number;
  tagline: string;
  icon: string;
  mayorName?: string;
  mayorAvatar?: string;
  influenceXp?: number;
}

export type Neighbourhood = NeighbourhoodZone;

export interface Quest {
  id: string;
  title: string;
  zone: string;
  xp?: number;
  completed: boolean;
  totalStops?: number;
  completedStops?: number;
  nextStop?: string;
  rewardXp?: number;
  estimatedTime?: string;
  difficulty?: 'Easy' | 'Moderate' | 'Master';
}

export interface PassportStamp {
  id: string;
  title: string;
  zone: string;
  rarity: 'Common' | 'Rare' | 'Legendary' | 'Mythic';
  stampedDate: string;
  icon: string;
  color: string;
  xpValue: number;
  description: string;
  discoveryId: string;
  unlocked: boolean;
}

export interface MysteryDrop {
  id: string;
  title: string;
  zone: string;
  clue: string;
  expiresInMinutes: number;
  remainingClaims: number;
  totalClaims: number;
  secretReward: string;
  rarity: 'Legendary' | 'Mythic';
  xpReward: number;
  unlocked: boolean;
}

export interface SecretPerk {
  id: string;
  placeName: string;
  zone: string;
  perkTitle: string;
  secretCode: string;
  secretMenuDish: string;
  perkValue: string;
  requiredStreak: number;
  status: 'available' | 'claimed' | 'locked';
  qrData: string;
  imageUrl: string;
  badge: string;
}

export interface SquadMember {
  id: string;
  name: string;
  avatar: string;
  role: string;
  distanceAway: string;
  status: 'online' | 'walking' | 'idle';
  xpContributed: number;
}

export interface Squad {
  id: string;
  name: string;
  motto: string;
  members: SquadMember[];
  activeRaidTitle: string;
  raidProgressPct: number;
  squadStreak: number;
  xpMultiplier: string;
}

export interface ActivityFeedItem {
  id: string;
  explorerName: string;
  explorerAvatar: string;
  actionType: 'checkin' | 'scanned_gem' | 'claimed_perk' | 'finished_quest' | 'streak_record';
  locationName: string;
  zone: string;
  timestamp: string;
  likesCount: number;
  hasLiked: boolean;
  photoUrl?: string;
  note?: string;
  stats: {
    steps: number;
    distanceKm: number;
    xpGained: number;
  };
}

export interface DistrictTerritory {
  zone: string;
  mayorDisplayName: string;
  mayorAvatar: string;
  dominanceScore: number;
  totalExplorers: number;
  weeklyChallenge: string;
  topLeaderboard: {
    rank: number;
    name: string;
    xp: number;
    streak: number;
    avatar: string;
  }[];
}

export interface DirectMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isMe: boolean;
  reactionEmoji?: string;
  mediaUrl?: string;
  isAudioNote?: boolean;
}

export interface ChatThread {
  id: string;
  type: 'direct' | 'group' | 'ai_bot';
  name: string;
  username: string;
  avatar: string;
  isOnline: boolean;
  lastSeen?: string;
  showActivityStatus?: boolean;
  verifiedBadge?: boolean;
  unreadCount: number;
  lastMessageText: string;
  lastMessageTime: string;
  messages: DirectMessage[];
}

export interface FriendUser {
  id: string;
  name: string;
  username: string;
  avatar: string;
  bio: string;
  streak: number;
  isFollowing: boolean;
  hasRequested: boolean;
  mutualFriendsCount: number;
  isOnline: boolean;
  availabilityStatus?: 'Available Now' | 'Away';
  lastSeen?: string;
  showActivityStatus?: boolean;
  privacySetting?: 'everyone' | 'friends_only' | 'nobody';
  locationZone?: string;
}

export interface FriendRequest {
  id: string;
  fromUser: FriendUser;
  timestamp: string;
  status: 'pending' | 'accepted' | 'declined';
}

export interface PostComment {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar?: string;
  text: string;
  timestamp: string;
  isMyComment?: boolean;
}

export interface UserPost {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar?: string;
  imageUrl: string;
  caption: string;
  location?: string;
  timestamp: string;
  likesCount: number;
  hasLiked: boolean;
  comments: PostComment[];
  isMyPost: boolean;
}

export interface AccountSettings {
  isPrivateAccount: boolean;
  allowCommentsFrom: 'everyone' | 'following' | 'off';
  notifications: {
    likes: boolean;
    comments: boolean;
    directMessages: boolean;
    friendRequests: boolean;
    expeditionAlerts: boolean;
  };
  blockedAccounts: string[];
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  username?: string;
  handle?: string;
  bio?: string;
  websiteLink?: string;
  avatarUrl?: string;
  xp: number;
  streak: number;
  level?: string | number;
  levelTitle?: string;
  currentXp?: number;
  maxXp?: number;
  streakDays?: number;
  totalXpEarned?: number;
  mappedCount?: number;
  questsCompleted?: number;
  badgesEarned?: number;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isVip?: boolean;
  vipTermsAccepted?: boolean;
  vipTermsVersion?: string;
  vipActivatedAt?: string;
  blackMemberId?: string;
  stampsCount?: number;
  perksClaimedCount?: number;
  showActivityStatus?: boolean;
  availabilityStatus?: 'Available Now' | 'Away';
  settings?: AccountSettings;
}

export interface SearchHistoryItem {
  id: string;
  userId: string;
  query: string;
  category?: 'location' | 'topic' | 'keyword';
  timestamp: string;
}

export interface MasterPlace {
  id: string;
  number: number;
  name: string;
  locator: string;
  cluster: string;
  clusterKey: string;
  zone: string;
  category: 'Heritage' | 'Architecture' | 'Food Lore' | 'Hidden Lore' | 'Nature & Coast' | 'Culture & Arts' | 'Sacred Sites';
  categoryKey: 'heritage' | 'architecture' | 'food' | 'secret' | 'nature' | 'arts' | 'temple';
  lat: number;
  lng: number;
  xp: number;
  lore: string;
  fullStory?: string;
  architecturalStyle?: string;
  vintageYear?: string;
  imageUrl: string;
  audioSnippet?: string;
  curatorTag?: string;
  secretPerk?: string;
}

export interface PlanStop {
  stopNumber: number;
  placeNumber: number;
  placeName: string;
  zone: string;
  lat: number;
  lng: number;
  timeAllocation: string;
  mission: string;
  loreHook: string;
  xpReward: number;
}

export interface CustomExpeditionPlan {
  id: string;
  title: string;
  tagline: string;
  cluster: string;
  totalDuration: string;
  totalDistance: string;
  totalXp: number;
  pace: string;
  theme: string;
  overview: string;
  stops: PlanStop[];
  insiderTip: string;
  createdAt: string;
}

export interface GeneratedQuest {
  id: string;
  placeId: string;
  placeNumber: number;
  placeName: string;
  zone: string;
  cluster: string;
  title: string;
  riddleClue: string;
  objective: string;
  challengeType: 'photo_lens' | 'riddle_solve' | 'audio_listen' | 'check_in';
  requiredFilter?: string;
  xpReward: number;
  difficulty: 'Easy' | 'Moderate' | 'Master';
  badgeReward: string;
  isCompleted?: boolean;
}

export interface AiPlaceExplainer {
  bio: string;
  history: string;
  heritage_explainer: string;
  quest: string;
  vintageTrivia: string[];
  questTitle: string;
  questDifficulty: 'Easy' | 'Moderate' | 'Master';
  questObjective: string;
  questRiddleClue: string;
  questXpReward: number;
}

export interface AcousticLoreArtifact {
  id: string;
  name: string;
  subtitle: string;
  category: 'temple' | 'coastal' | 'food' | 'colonial' | 'monsoon';
  soundscapeId: 'temple-chimes' | 'marina-waves' | 'filter-coffee' | 'belfry' | 'monsoon-rain';
  soundscapeName: string;
  lore: string;
  historicalEra: string;
  frequencyNote: string;
  color: string;
  accentHex: string;
  modelType: 'bell' | 'conch' | 'davarah' | 'belfry_bell' | 'urn';
  defaultScale: number;
  significance: string;
  rarity?: 'Common' | 'Rare' | 'Sacred' | 'Legendary' | 'Mythic';
  unlockedByDefault?: boolean;
  unlockQuestObjective?: string;
  craftsmanshipDetails?: string;
  weightKg?: number;
}

export interface UserUnlockedArtifact {
  artifactId: string;
  unlockedAt: string;
  timesPlaced: number;
  lastAnchoredCoords?: { lat: number; lng: number };
}

export interface ArPathfindingState {
  enabled: boolean;
  targetSpot: { id: string; name: string; lat: number; lng: number; neighborhood?: string } | null;
  bearingDegrees: number;
  cardinalDirection: string;
  distanceMeters: number;
  compassHeadingDeg: number;
}

export interface Anchored3dArtifact {
  id: string;
  artifactId: string;
  artifactName: string;
  lat: number;
  lng: number;
  altitude?: number;
  accuracy?: number;
  placeName?: string;
  zone?: string;
  scale: number;
  rotationY: number;
  posX: number;
  posY: number;
  posZ: number;
  surfaceY?: number;
  surfacePitch?: number;
  surfaceRoll?: number;
  isRestingOnGround?: boolean;
  placedByUserId: string;
  placedByUserName: string;
  anchoredAt: string;
  screenshotUrl?: string;
  notes?: string;
  resonancesCount?: number;
  soundscapeId?: string;
  frequencyNote?: string;
}

export interface GroundSurfacePlane {
  detected: boolean;
  planeY: number;
  normal: { x: number; y: number; z: number };
  pitchDeg: number;
  rollDeg: number;
  confidence: number;
  distanceMeters: number;
  trackingState: 'calibrating' | 'tracking' | 'locked';
}

export interface SessionPlacedArtifact {
  id: string;
  artifactId: string;
  artifactName: string;
  category: string;
  color: string;
  posX: number;
  posY: number;
  posZ: number;
  scale: number;
  rotationY: number;
  timestamp: number;
  frequencyNote?: string;
  soundscapeId?: string;
}

export interface VisualHapticEvent {
  id: number;
  type: 'tap-to-place' | 'pinch-scale-init' | 'pinch-tick' | 'undo';
  x: number;
  y: number;
  touch1?: { x: number; y: number };
  touch2?: { x: number; y: number };
  label?: string;
  color?: string;
}


export interface SavedLocationPin {
  id: string;
  lat: number;
  lng: number;
  note: string;
  timestamp: string;
}
