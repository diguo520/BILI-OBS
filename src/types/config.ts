import { DEFAULT_TTS_CONFIG, type TtsConfig } from "@/types/tts";

export interface AppCookie {
  name: string;
  value: string;
}

export interface ParentArea {
  id: string;
  name: string;
  list: Area[];
}

export interface Area {
  id: string;
  parent_id: string;
  old_area_id: string;
  name: string;
  act_id: string;
  pk_status: string;
  hot_status: string;
  lock_status: string;
  pic: string;
  complex_area_name: string;
  pinyin: string;
  parent_name: string;
  area_type: string;
}

export interface Stream {
  type: string;
  address: string;
  key: string;
}

export type CommentRole = "anchor" | "admin" | "guard" | "level" | "normal";

export interface CommentRoleColors {
  name: string;
  message: string;
}

export interface CommentStyleConfig {
  fontSize: number;
  levelThreshold: number;
  shadow: {
    enabled: boolean;
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
  roles: Record<CommentRole, CommentRoleColors>;
}

export const DEFAULT_COMMENT_STYLE: CommentStyleConfig = {
  fontSize: 14,
  levelThreshold: 20,
  shadow: {
    enabled: false,
    color: "#000000",
    blur: 2,
    offsetX: 1,
    offsetY: 1,
  },
  roles: {
    anchor: { name: "#ff6b9d", message: "#ffffff" },
    admin: { name: "#ffc061", message: "#ffffff" },
    guard: { name: "#7da2ff", message: "#ffffff" },
    level: { name: "#b49cff", message: "#ffffff" },
    normal: { name: "#fb7299", message: "#ffffff" },
  },
};

export interface AppConfig {
  cookies: AppCookie[];
  areaList: ParentArea[];
  theme: "light" | "dark";
  uid: number;
  avatar: string | null;
  username: string | null;
  roomId: number;
  csrf: string | null;
  roomTitle: string;
  roomAnnouncement: string;
  roomCover: string;
  categoryId: string;
  areaId: string;
  img_url: string;
  sub_url: string;
  roomToken: string;
  isOpenLive: boolean;
  liveStartedAt: number | null;
  streams: Stream[];
  commentStyle: CommentStyleConfig;
  tts: TtsConfig;
}

export const DEFAULT_CONFIG: AppConfig = {
  cookies: [],
  areaList: [],
  theme: "light",
  uid: 0,
  avatar: null,
  username: null,
  roomId: 0,
  csrf: null,
  roomTitle: "",
  roomAnnouncement: "",
  roomCover: "",
  categoryId: "",
  areaId: "",
  img_url: "",
  sub_url: "",
  roomToken: "",
  isOpenLive: false,
  liveStartedAt: null,
  streams: [],
  commentStyle: DEFAULT_COMMENT_STYLE,
  tts: DEFAULT_TTS_CONFIG,
};
