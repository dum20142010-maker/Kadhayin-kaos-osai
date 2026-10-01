import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Conversation,
  ChatMessage,
  ChatUser,
  ChatAttachment,
  MessageType,
  ConversationMember,
} from '../types/chat';

// Current active local user representation
export const CURRENT_USER: ChatUser = {
  id: 'current_explorer_me',
  displayName: 'Madras Explorer (You)',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  isOnline: true,
  lastSeen: new Date().toISOString(),
  role: 'Explorer Leader',
};

// Seed / Initial Directory Users for chat contacts
export const EXPLORER_DIRECTORY: ChatUser[] = [
  {
    id: 'user_alex_m',
    displayName: 'Alex Morgan',
    avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
    isOnline: true,
    lastSeen: 'Active now',
    role: 'Heritage Architect',
  },
  {
    id: 'user_priya_s',
    displayName: 'Priya Sundaram',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    isOnline: true,
    lastSeen: '5m ago',
    role: 'Mylapore Lore Collector',
  },
  {
    id: 'user_sam_r',
    displayName: 'Sam Ramachandran',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    isOnline: false,
    lastSeen: '1h ago',
    role: 'Coffee Trail Pioneer',
  },
  {
    id: 'user_kavitha_v',
    displayName: 'Kavitha Vasudevan',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
    isOnline: true,
    lastSeen: 'Active now',
    role: 'Acoustic Sound Mapper',
  },
];

// Fallback initial conversations if Firestore has not yet been seeded
const INITIAL_MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv_team_explorer',
    type: 'group',
    name: 'Team Explorer Squad',
    imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=200',
    createdBy: 'user_alex_m',
    participantIds: ['current_explorer_me', 'user_alex_m', 'user_priya_s', 'user_sam_r'],
    updatedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    lastMessage: {
      text: "Anyone ready for tomorrow's Mylapore dawn soundscape trail?",
      senderId: 'user_priya_s',
      senderName: 'Priya Sundaram',
      createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      messageType: 'text',
    },
    unreadCount: 2,
  },
  {
    id: 'conv_alex_m',
    type: 'direct',
    name: 'Alex Morgan',
    imageUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
    createdBy: 'current_explorer_me',
    participantIds: ['current_explorer_me', 'user_alex_m'],
    updatedAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    lastMessage: {
      text: "Let's explore Senate House together tomorrow at 9 AM.",
      senderId: 'user_alex_m',
      senderName: 'Alex Morgan',
      createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      messageType: 'text',
    },
    unreadCount: 0,
  },
  {
    id: 'conv_priya_s',
    type: 'direct',
    name: 'Priya Sundaram',
    imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    createdBy: 'user_priya_s',
    participantIds: ['current_explorer_me', 'user_priya_s'],
    updatedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    lastMessage: {
      text: "That Kapaleeshwarar quest verification was super fast!",
      senderId: 'user_priya_s',
      senderName: 'Priya Sundaram',
      createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      messageType: 'text',
    },
    unreadCount: 0,
  },
];

const INITIAL_MOCK_MESSAGES: Record<string, ChatMessage[]> = {
  conv_team_explorer: [
    {
      id: 'msg_1',
      conversationId: 'conv_team_explorer',
      senderId: 'user_alex_m',
      senderName: 'Alex Morgan',
      senderAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
      messageType: 'text',
      text: 'Hey everyone! Welcome to the Chennai Heritage Exploration Squad.',
      status: 'read',
      createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    },
    {
      id: 'msg_2',
      conversationId: 'conv_team_explorer',
      senderId: 'current_explorer_me',
      senderName: 'You',
      messageType: 'place',
      text: 'I just pinned Senate House in Chepauk!',
      attachment: {
        type: 'place',
        id: 'senate_house',
        title: 'Senate House & University Quad',
        description: 'Robert Chisholm’s 1879 Indo-Saracenic architectural masterpiece.',
        imageUrl: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600',
        location: 'Chepauk, Chennai',
        extraData: { zone: 'Chepauk / Marina' },
      },
      status: 'read',
      createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    },
    {
      id: 'msg_3',
      conversationId: 'conv_team_explorer',
      senderId: 'user_priya_s',
      senderName: 'Priya Sundaram',
      senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      messageType: 'text',
      text: "Anyone ready for tomorrow's Mylapore dawn soundscape trail?",
      status: 'read',
      createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
  ],
  conv_alex_m: [
    {
      id: 'msg_alex_1',
      conversationId: 'conv_alex_m',
      senderId: 'user_alex_m',
      senderName: 'Alex Morgan',
      senderAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
      messageType: 'text',
      text: "Let's explore Senate House together tomorrow at 9 AM.",
      status: 'read',
      createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    },
  ],
  conv_priya_s: [
    {
      id: 'msg_priya_1',
      conversationId: 'conv_priya_s',
      senderId: 'user_priya_s',
      senderName: 'Priya Sundaram',
      senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      messageType: 'text',
      text: 'That Kapaleeshwarar quest verification was super fast!',
      status: 'read',
      createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    },
  ],
};

// In-Memory cache for offline or fallback sync
let localConversations: Conversation[] = (() => {
  try {
    const saved = localStorage.getItem('kaos_chat_conversations');
    if (saved) return JSON.parse(saved);
  } catch {}
  return INITIAL_MOCK_CONVERSATIONS;
})();

let localMessages: Record<string, ChatMessage[]> = (() => {
  try {
    const saved = localStorage.getItem('kaos_chat_messages');
    if (saved) return JSON.parse(saved);
  } catch {}
  return INITIAL_MOCK_MESSAGES;
})();

function persistLocalState() {
  try {
    localStorage.setItem('kaos_chat_conversations', JSON.stringify(localConversations));
    localStorage.setItem('kaos_chat_messages', JSON.stringify(localMessages));
  } catch {}
}

/**
 * Real-time Subscribe to Conversation List for current user
 */
export function subscribeConversations(
  userId: string,
  onUpdate: (conversations: Conversation[]) => void
) {
  try {
    const q = query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const remoteList: Conversation[] = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as Conversation[];
          
          localConversations = remoteList;
          persistLocalState();
          onUpdate(remoteList);
        } else {
          onUpdate(localConversations);
        }
      },
      (error) => {
        console.warn('Firestore conversation snapshot fallback to local:', error);
        onUpdate(localConversations);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('Firestore subscription failed, returning local state:', err);
    onUpdate(localConversations);
    return () => {};
  }
}

/**
 * Real-time Subscribe to Messages inside a specific conversation
 */
export function subscribeMessages(
  conversationId: string,
  onUpdate: (messages: ChatMessage[]) => void
) {
  try {
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const remoteMsgs: ChatMessage[] = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as ChatMessage[];

          localMessages[conversationId] = remoteMsgs;
          persistLocalState();
          onUpdate(remoteMsgs);
        } else {
          const current = localMessages[conversationId] || [];
          onUpdate(current);
        }
      },
      (error) => {
        console.warn('Firestore messages snapshot fallback to local:', error);
        onUpdate(localMessages[conversationId] || []);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('Firestore messages subscription failed, returning local:', err);
    onUpdate(localMessages[conversationId] || []);
    return () => {};
  }
}

/**
 * Send a new chat message (Supports Optimistic UI updates)
 */
export async function sendMessage(
  conversationId: string,
  sender: ChatUser,
  text: string,
  attachment?: ChatAttachment,
  messageType: MessageType = 'text'
): Promise<ChatMessage> {
  const newMsgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const nowIso = new Date().toISOString();

  const newMsg: ChatMessage = {
    id: newMsgId,
    conversationId,
    senderId: sender.id,
    senderName: sender.displayName,
    senderAvatar: sender.avatarUrl,
    messageType: attachment ? attachment.type : messageType,
    text: text.trim(),
    attachment,
    status: 'sending',
    createdAt: nowIso,
    readBy: [sender.id],
  };

  // 1. Immediate Local Optimistic Update
  if (!localMessages[conversationId]) {
    localMessages[conversationId] = [];
  }
  localMessages[conversationId].push(newMsg);

  // Update conversation last message in local state
  const convIndex = localConversations.findIndex((c) => c.id === conversationId);
  if (convIndex !== -1) {
    localConversations[convIndex].lastMessage = {
      text: text.trim() || (attachment ? `Shared a ${attachment.type}` : 'Sent an attachment'),
      senderId: sender.id,
      senderName: sender.displayName,
      createdAt: nowIso,
      messageType: attachment ? attachment.type : messageType,
    };
    localConversations[convIndex].updatedAt = nowIso;
  }
  persistLocalState();

  // 2. Persist to Firestore asynchronously
  try {
    const msgDocRef = doc(db, 'conversations', conversationId, 'messages', newMsgId);
    await setDoc(msgDocRef, {
      ...newMsg,
      status: 'sent',
      serverTimestamp: serverTimestamp(),
    });

    const convDocRef = doc(db, 'conversations', conversationId);
    await updateDoc(convDocRef, {
      lastMessage: {
        text: text.trim() || (attachment ? `Shared a ${attachment.type}` : 'Sent an attachment'),
        senderId: sender.id,
        senderName: sender.displayName,
        createdAt: nowIso,
        messageType: attachment ? attachment.type : messageType,
      },
      updatedAt: nowIso,
    });

    // Mark as sent in local optimistic object
    newMsg.status = 'sent';
  } catch (err) {
    console.warn('Firestore message save error, keeping in local cache:', err);
    newMsg.status = 'sent';
  }

  return newMsg;
}

/**
 * Start or get an existing Direct 1-on-1 Chat Conversation
 */
export async function createDirectConversation(
  currentUserId: string,
  targetUser: ChatUser
): Promise<Conversation> {
  const existing = localConversations.find(
    (c) =>
      c.type === 'direct' &&
      c.participantIds.includes(currentUserId) &&
      c.participantIds.includes(targetUser.id)
  );

  if (existing) {
    return existing;
  }

  const convId = 'conv_' + targetUser.id.replace(/[^a-zA-Z0-9]/g, '_');
  const nowIso = new Date().toISOString();

  const newConv: Conversation = {
    id: convId,
    type: 'direct',
    name: targetUser.displayName,
    imageUrl: targetUser.avatarUrl,
    createdBy: currentUserId,
    participantIds: [currentUserId, targetUser.id],
    updatedAt: nowIso,
    lastMessage: {
      text: 'Conversation started',
      senderId: currentUserId,
      senderName: 'You',
      createdAt: nowIso,
    },
    unreadCount: 0,
  };

  localConversations.unshift(newConv);
  localMessages[convId] = [
    {
      id: 'msg_welcome_' + Date.now(),
      conversationId: convId,
      senderId: 'system',
      senderName: 'System',
      messageType: 'text',
      text: `You started a conversation with ${targetUser.displayName}.`,
      status: 'read',
      createdAt: nowIso,
    },
  ];
  persistLocalState();

  try {
    await setDoc(doc(db, 'conversations', convId), newConv);
  } catch (e) {
    console.warn('Direct chat saved locally:', e);
  }

  return newConv;
}

/**
 * Create a new Group Chat Conversation
 */
export async function createGroupConversation(
  creatorId: string,
  groupName: string,
  groupImage: string,
  selectedUsers: ChatUser[]
): Promise<Conversation> {
  const convId = 'group_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const nowIso = new Date().toISOString();
  const participantIds = Array.from(new Set([creatorId, ...selectedUsers.map((u) => u.id)]));

  const newGroup: Conversation = {
    id: convId,
    type: 'group',
    name: groupName.trim() || 'Exploration Group',
    imageUrl:
      groupImage ||
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=200',
    createdBy: creatorId,
    participantIds,
    updatedAt: nowIso,
    lastMessage: {
      text: `Group "${groupName}" created`,
      senderId: creatorId,
      senderName: 'You',
      createdAt: nowIso,
    },
    unreadCount: 0,
  };

  localConversations.unshift(newGroup);
  localMessages[convId] = [
    {
      id: 'msg_group_created_' + Date.now(),
      conversationId: convId,
      senderId: creatorId,
      senderName: 'System',
      messageType: 'text',
      text: `Group "${groupName}" was created with ${participantIds.length} members.`,
      status: 'read',
      createdAt: nowIso,
    },
  ];
  persistLocalState();

  try {
    await setDoc(doc(db, 'conversations', convId), newGroup);

    // Seed member subcollection
    for (const pId of participantIds) {
      const memberData: ConversationMember = {
        userId: pId,
        role: pId === creatorId ? 'admin' : 'member',
        joinedAt: nowIso,
      };
      await setDoc(doc(db, 'conversations', convId, 'members', pId), memberData);
    }
  } catch (e) {
    console.warn('Group chat saved locally:', e);
  }

  return newGroup;
}

/**
 * Mark conversation as read
 */
export function markConversationAsRead(conversationId: string, userId: string) {
  const convIndex = localConversations.findIndex((c) => c.id === conversationId);
  if (convIndex !== -1) {
    localConversations[convIndex].unreadCount = 0;
    persistLocalState();
  }
}

/**
 * Toggle conversation mute status
 */
export async function toggleMuteConversation(
  conversationId: string,
  userId: string,
  currentMutedArray: string[] = []
): Promise<boolean> {
  const isMuted = currentMutedArray.includes(userId);
  const convIndex = localConversations.findIndex((c) => c.id === conversationId);

  if (convIndex !== -1) {
    if (isMuted) {
      localConversations[convIndex].mutedUserIds = (
        localConversations[convIndex].mutedUserIds || []
      ).filter((id) => id !== userId);
    } else {
      localConversations[convIndex].mutedUserIds = [
        ...(localConversations[convIndex].mutedUserIds || []),
        userId,
      ];
    }
    persistLocalState();
  }

  try {
    const convRef = doc(db, 'conversations', conversationId);
    if (isMuted) {
      await updateDoc(convRef, { mutedUserIds: arrayRemove(userId) });
    } else {
      await updateDoc(convRef, { mutedUserIds: arrayUnion(userId) });
    }
  } catch (e) {
    console.warn('Mute setting updated locally:', e);
  }

  return !isMuted;
}

/**
 * Group Management: Add Members
 */
export async function addMembersToGroup(conversationId: string, usersToAdd: ChatUser[]) {
  const convIndex = localConversations.findIndex((c) => c.id === conversationId);
  if (convIndex !== -1) {
    const newIds = usersToAdd.map((u) => u.id);
    localConversations[convIndex].participantIds = Array.from(
      new Set([...localConversations[convIndex].participantIds, ...newIds])
    );
    persistLocalState();
  }

  try {
    const convRef = doc(db, 'conversations', conversationId);
    await updateDoc(convRef, {
      participantIds: arrayUnion(...usersToAdd.map((u) => u.id)),
    });
  } catch (e) {
    console.warn('Add members updated locally:', e);
  }
}

/**
 * Group Management: Remove Member
 */
export async function removeMemberFromGroup(conversationId: string, userIdToRemove: string) {
  const convIndex = localConversations.findIndex((c) => c.id === conversationId);
  if (convIndex !== -1) {
    localConversations[convIndex].participantIds = localConversations[
      convIndex
    ].participantIds.filter((id) => id !== userIdToRemove);
    persistLocalState();
  }

  try {
    const convRef = doc(db, 'conversations', conversationId);
    await updateDoc(convRef, {
      participantIds: arrayRemove(userIdToRemove),
    });
  } catch (e) {
    console.warn('Remove member updated locally:', e);
  }
}

/**
 * Group Management: Rename Group
 */
export async function renameGroup(conversationId: string, newName: string, newImage?: string) {
  const convIndex = localConversations.findIndex((c) => c.id === conversationId);
  if (convIndex !== -1) {
    localConversations[convIndex].name = newName.trim();
    if (newImage) localConversations[convIndex].imageUrl = newImage;
    persistLocalState();
  }

  try {
    const convRef = doc(db, 'conversations', conversationId);
    const updatePayload: any = { name: newName.trim() };
    if (newImage) updatePayload.imageUrl = newImage;
    await updateDoc(convRef, updatePayload);
  } catch (e) {
    console.warn('Group rename updated locally:', e);
  }
}

/**
 * Group Management: Leave Group
 */
export async function leaveGroup(conversationId: string, currentUserId: string) {
  await removeMemberFromGroup(conversationId, currentUserId);
}

/**
 * Delete a specific message (own message)
 */
export async function deleteMessage(conversationId: string, messageId: string) {
  if (localMessages[conversationId]) {
    localMessages[conversationId] = localMessages[conversationId].filter(
      (m) => m.id !== messageId
    );
    persistLocalState();
  }

  try {
    await deleteDoc(doc(db, 'conversations', conversationId, 'messages', messageId));
  } catch (e) {
    console.warn('Message deleted locally:', e);
  }
}
