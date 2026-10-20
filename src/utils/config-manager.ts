import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import {
  type AppConfig,
  DEFAULT_COMMENT_STYLE,
  DEFAULT_CONFIG,
} from "@/types/config";

const CONFIG_FILENAME = "app-config.json";
let dataDirPromise: Promise<string> | null = null;

async function getDataDir(): Promise<string> {
  if (!dataDirPromise) {
    dataDirPromise = invoke<string>("get_data_dir").then(async (dir) => {
      try {
        await mkdir(dir, { recursive: true });
      } catch (error) {
        console.error("创建数据目录失败", error);
      }
      return dir;
    });
  }
  return dataDirPromise;
}

async function getConfigPath(): Promise<string> {
  return join(await getDataDir(), CONFIG_FILENAME);
}

export class ConfigManager {
  public static async load(): Promise<AppConfig> {
    try {
      const path = await getConfigPath();
      if (!(await exists(path))) {
        await this.save(DEFAULT_CONFIG);
        return DEFAULT_CONFIG;
      }

      const content = await readTextFile(path);
      const parsed = JSON.parse(content);
      const style = parsed.commentStyle ?? {};
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        commentStyle: {
          ...DEFAULT_COMMENT_STYLE,
          ...style,
          shadow: { ...DEFAULT_COMMENT_STYLE.shadow, ...style.shadow },
          roles: {
            anchor: { ...DEFAULT_COMMENT_STYLE.roles.anchor, ...style.roles?.anchor },
            admin: { ...DEFAULT_COMMENT_STYLE.roles.admin, ...style.roles?.admin },
            guard: { ...DEFAULT_COMMENT_STYLE.roles.guard, ...style.roles?.guard },
            level: { ...DEFAULT_COMMENT_STYLE.roles.level, ...style.roles?.level },
            normal: { ...DEFAULT_COMMENT_STYLE.roles.normal, ...style.roles?.normal },
          },
        },
      };
    } catch (error) {
      console.error("加载配置失败，使用默认值:", error);
      return DEFAULT_CONFIG;
    }
  }

  public static async save(config: AppConfig): Promise<void> {
    try {
      const path = await getConfigPath();
      await writeTextFile(path, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error("保存配置失败:", error);
      throw error;
    }
  }
}
