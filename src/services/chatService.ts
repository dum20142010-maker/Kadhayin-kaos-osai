import { db, auth } from '../lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  doc, 
  deleteDoc, 
  updateDoc, 
  where,
  serverTimestamp,
  FieldValue
} from 'firebase/firestore';
import { 
  Conversation, 
  ChatMessage, 
  ChatUser, 
  ChatAttachment, 
  MessageType 
} from '../types/chat';

export type { Conversation, ChatMessage as Message, ChatUser };

export const subscribeConversations = (userId: string, callback: (conversations: Conversation[]) => void) => {
  const q = query(
    collection(db, 'conversations'),
    where('participantIds', 'array-contains', userId),
    orderBy('updatedAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const convs = snapshot.docs.map(doc => {
      const data = doc.data();
      let updatedAt = data.updatedAt;
      if (updatedAt && typeof updatedAt.toDate === 'function') {
        updatedAt = updatedAt.toDate().toISOString();
      }
      return { id: doc.id, ...data, updatedAt } as Conversation;
    });
    callback(convs);
  });
};

export const subscribeToMessages = (conversationId: string, callback: (messages: ChatMessage[]) => void) => {
  const q = query(collection(db, 'conversations', conversationId, 'messages'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const msgs = snapshot.docs.map(doc => {
      const data = doc.data();
      let createdAt = data.createdAt;
      if (createdAt && typeof createdAt.toDate === 'function') {
        createdAt = createdAt.toDate().toISOString();
      }
      return { id: doc.id, ...data, createdAt } as ChatMessage;
    });
    callback(msgs);
  });
};

export const sendMessage = async (
  conversationId: string, 
  sender: ChatUser, 
  text: string, 
  attachment?: ChatAttachment
) => {
  const messageData: Omit<ChatMessage, 'id'> = {
    conversationId,
    senderId: sender.id,
    senderName: sender.displayName,
    senderAvatar: sender.avatarUrl,
    messageType: attachment ? attachment.type : 'text',
    text,
    attachment,
    status: 'sent',
    createdAt: serverTimestamp() as any
  };

  const msgRef = await addDoc(collection(db, 'conversations', conversationId, 'messages'), messageData);
  
  // Update conversation last message
  await updateDoc(doc(db, 'conversations', conversationId), {
    lastMessage: {
      text,
      senderId: sender.id,
      senderName: sender.displayName,
      createdAt: new Date().toISOString(),
      messageType: messageData.messageType
    },
    updatedAt: serverTimestamp()
  });

  return msgRef;
};

export const deleteConversation = async (conversationId: string) => {
  return deleteDoc(doc(db, 'conversations', conversationId));
};

export const markConversationAsRead = async (conversationId: string) => {
  return updateDoc(doc(db, 'conversations', conversationId), { unreadCount: 0 });
};

export const archiveConversation = async (conversationId: string) => {
  return updateDoc(doc(db, 'conversations', conversationId), { archived: true });
};

export const createDirectConversation = async (userId: string, targetUser: ChatUser) => {
  return addDoc(collection(db, 'conversations'), {
    type: 'direct',
    participantIds: [userId, targetUser.id],
    name: targetUser.displayName,
    imageUrl: targetUser.avatarUrl,
    unreadCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: {
      text: 'Started a new conversation',
      senderId: userId,
      senderName: '',
      createdAt: new Date().toISOString()
    }
  });
};

export const CURRENT_USER: ChatUser = {
  id: 'usha_baskar_explorer',
  displayName: 'Usha Baskar',
  avatarUrl: 'https://i.pravatar.cc/150?u=usha_baskar_explorer'
};

export const EXPLORER_DIRECTORY: ChatUser[] = [
  { id: 'vikram_dev', displayName: 'Vikram Dev', avatarUrl: 'https://i.pravatar.cc/150?u=vikram_dev', role: 'Explorer' },
  { id: 'priya_raj', displayName: 'Priya Raj', avatarUrl: 'https://i.pravatar.cc/150?u=priya_raj', role: 'Researcher' }
];

