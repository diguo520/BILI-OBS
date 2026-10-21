export interface Comment {
  id: string;
  username: string;
  uid?: number;
  avatar?: string;
  message: string;
  timestamp: Date;
  type: "chat" | "superchat" | "gift" | "enter" | "guard";
  isAdmin?: boolean;
  guardLevel?: number;
  level?: number;
  badge?: string;
  giftName?: string;
  giftCount?: number;
  /** 礼物单价（元），用于「付费礼物才会读」 */
  giftPrice?: number;
  amount?: number;
}
