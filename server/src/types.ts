// Mirror of docs/architecture.md §API contract. This file and the client's
// lib/types.ts must agree with that section; if they diverge, the doc wins —
// fix all three in the same commit (rule 6).

export interface UserProfile {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  bio: string;
  deleted: boolean; // profile fields are blank when true
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  created_at: string; // UTC "YYYY-MM-DD HH:MM:SS"
}

export interface ConversationSummary {
  id: number;
  peer: UserProfile; // the other participant
  last_message: Message | null; // null for a conversation with no messages yet
}
