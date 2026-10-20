export interface Comment {
  id: string;
  username: string;
  uid?: number;
  avatar?: string;
  message: string;
  timestamp: Date;
  type: "chat" | "superchat" | "gift" | "enter";
  isAdmin?: boolean;
  guardLevel?: number;
  level?: number;
  badge?: string;
  giftName?: string;
  giftCount?: number;
  amount?: number;
}
