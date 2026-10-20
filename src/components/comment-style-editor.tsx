import type { CommentStyleConfig } from "@/types/config";
import type { Comment } from "@/types/comment";
import { getMessageStyle, getNameStyle } from "@/lib/comment-style";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

interface CommentStyleEditorProps {
  style: CommentStyleConfig;
  onChange: (style: CommentStyleConfig) => void;
  sample: Comment;
  selfUid: number;
}

export function CommentStyleEditor({
  style,
  onChange,
  sample,
  selfUid,
}: CommentStyleEditorProps) {
  const patch = (next: Partial<CommentStyleConfig>) =>
    onChange({ ...style, ...next });

  return (
    <div className="w-[300px] space-y-3">
      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
        <div
          className="text-[12px] font-medium"
          style={getNameStyle(sample, style, selfUid)}>
          {sample.username}
        </div>
        <div
          className="mt-1 leading-relaxed"
          style={getMessageStyle(sample, style, selfUid)}>
          {sample.message}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-[10.5px] text-muted-foreground">
          <span>字号</span>
          <span>{style.fontSize}px</span>
        </div>
        <Slider
          value={[style.fontSize]}
          min={12}
          max={20}
          step={1}
          onValueChange={([fontSize]) => patch({ fontSize })}
        />
      </div>

      <div className="rounded-lg border border-border p-2.5">
        <div className="flex items-center gap-2">
          <span className="flex-1 text-[11px] text-foreground/90">文字阴影</span>
          <Switch
            checked={style.shadow.enabled}
            onCheckedChange={(enabled) =>
              patch({ shadow: { ...style.shadow, enabled } })
            }
          />
        </div>
        {style.shadow.enabled && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              颜色
              <input
                type="color"
                value={style.shadow.color}
                onChange={(event) =>
                  patch({
                    shadow: { ...style.shadow, color: event.target.value },
                  })
                }
                className="h-5 w-8 cursor-pointer rounded border border-border bg-transparent p-0"
              />
              <span className="ml-auto">模糊 {style.shadow.blur}px</span>
            </div>
            <Slider
              value={[style.shadow.blur]}
              min={0}
              max={12}
              step={1}
              onValueChange={([blur]) =>
                patch({ shadow: { ...style.shadow, blur } })
              }
            />
            <div className="grid grid-cols-2 gap-2 text-[9.5px] text-muted-foreground">
              <div>
                水平 {style.shadow.offsetX}px
                <Slider
                  value={[style.shadow.offsetX]}
                  min={-6}
                  max={6}
                  step={1}
                  onValueChange={([offsetX]) =>
                    patch({ shadow: { ...style.shadow, offsetX } })
                  }
                />
              </div>
              <div>
                垂直 {style.shadow.offsetY}px
                <Slider
                  value={[style.shadow.offsetY]}
                  min={-6}
                  max={6}
                  step={1}
                  onValueChange={([offsetY]) =>
                    patch({ shadow: { ...style.shadow, offsetY } })
                  }
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        {(
          [
            ["anchor", "主播"],
            ["admin", "房管"],
            ["guard", "舰长"],
            ["level", "等级"],
            ["normal", "普通会员"],
          ] as const
        ).map(([role, label]) => (
          <div
            key={role}
            className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
            <span className="w-12 text-[10.5px]">{label}</span>
            <label className="flex items-center gap-1 text-[9.5px] text-muted-foreground">
              人名
              <input
                type="color"
                value={style.roles[role].name}
                onChange={(event) =>
                  onChange({
                    ...style,
                    roles: {
                      ...style.roles,
                      [role]: {
                        ...style.roles[role],
                        name: event.target.value,
                      },
                    },
                  })
                }
                className="h-5 w-7 cursor-pointer rounded border border-border bg-transparent p-0"
              />
            </label>
            <label className="flex items-center gap-1 text-[9.5px] text-muted-foreground">
              内容
              <input
                type="color"
                value={style.roles[role].message}
                onChange={(event) =>
                  onChange({
                    ...style,
                    roles: {
                      ...style.roles,
                      [role]: {
                        ...style.roles[role],
                        message: event.target.value,
                      },
                    },
                  })
                }
                className="h-5 w-7 cursor-pointer rounded border border-border bg-transparent p-0"
              />
            </label>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        等级阈值
        <input
          type="number"
          min={1}
          max={60}
          value={style.levelThreshold}
          onChange={(event) =>
            patch({
              levelThreshold: Math.max(1, Number(event.target.value) || 1),
            })
          }
          className="h-6 w-12 rounded border border-border bg-background px-1 text-[10px]"
        />
        以上使用“等级”配色
      </div>
    </div>
  );
}
