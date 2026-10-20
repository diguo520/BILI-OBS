import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { X, RefreshCw, XCircle } from "@hugeicons/core-free-icons";
import { useEffect, useRef, useState } from "react";
import {
  addBlockedWords,
  deleteBlockedWords,
  getBlockedWords,
} from "@/api/live";
import { toast } from "sonner";
import { LoadingButton } from "@/components/loading-button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";

type Status = "loading" | "error" | "empty" | "success";

export function LiveRoomManagerBlockedWords() {
  const [state, setState] = useState<Status>("loading");
  const hasFetchedRef = useRef(false);
  const [maxLimit, setMaxLimit] = useState(0);
  const [blockedWords, setBlockedWords] = useState<string[]>([]);
  const [blockedWordInput, setBlockedWordInput] = useState("");

  const fetchKeywords = async () => {
    try {
      setState("loading");
      const { keyword_list, max_limit } = await getBlockedWords();
      const words = keyword_list.map((k) => k.keyword);
      setBlockedWords(words);
      setMaxLimit(max_limit);
      if (words.length > 0) {
        setState("success");
      } else {
        setState("empty");
      }
    } catch (e) {
      setState("error");
      toast.error((e as Error).message);
    }
  };
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchKeywords();
  }, []);

  const handleAddBlockedWord = async () => {
    const raw = blockedWordInput.trim();
    if (!raw) return;

    const word = raw.toLowerCase();
    if (blockedWords.includes(word)) return;

    try {
      await addBlockedWords(word);

      setBlockedWords((prev) => [...prev, word]);
      setBlockedWordInput("");

      if (state === "empty") {
        setState("success");
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleRemoveBlockedWord = async (word: string) => {
    try {
      await deleteBlockedWords(word);
      setBlockedWords(blockedWords.filter((w) => w !== word));
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const content = () => {
    switch (state) {
      case "loading":
        return (
          <div className="flex h-full items-center justify-center p-8">
            <Spinner />
            <Label>加载中...</Label>
          </div>
        );
      case "error":
        return (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <HugeiconsIcon
              icon={XCircle}
              className="h-6 w-6 text-destructive"
            />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">加载失败</p>
              <p className="text-xs text-muted-foreground">
                网络异常或服务器错误
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={fetchKeywords}>
              <HugeiconsIcon icon={RefreshCw} className="h-4 w-4" />
              刷新
            </Button>
          </div>
        );
      case "empty":
        return (
          <div className="flex h-30 items-center justify-center text-sm text-muted-foreground">
            屏蔽词列表为空
          </div>
        );
      case "success":
        return (
          <div className="flex flex-wrap gap-2">
            {blockedWords.map((word) => (
              <Badge
                key={word}
                variant="secondary"
                className="gap-1 rounded-md py-1 pr-1 pl-2.5 text-[11px]">
                {word}
                <button
                  onClick={() => handleRemoveBlockedWord(word)}
                  className="ml-1 rounded p-0.5 hover:bg-muted-foreground/20">
                  <HugeiconsIcon className="h-4 w-4" icon={X} />
                </button>
              </Badge>
            ))}
          </div>
        );
    }
  };
  return (
    <>
      <div className="shrink-0 space-y-2">
        <Label className="text-[11px] text-muted-foreground">
          屏蔽词
          <span className="text-[10px] text-muted-foreground/80">
            包含屏蔽词的弹幕不会出现在列表中，单个词不超过 15 个字符
          </span>
        </Label>

        <div className="flex gap-2">
          <Input
            placeholder="请输入要屏蔽的内容"
            value={blockedWordInput}
            onChange={(e) => setBlockedWordInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddBlockedWord()}
            className="h-9 rounded-lg text-[12px]"
          />
          <LoadingButton
            onClickAsync={handleAddBlockedWord}
            className="h-9 rounded-lg"
            disabled={!blockedWordInput.trim()}>
            添加屏蔽词
          </LoadingButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">屏蔽列表</Label>
          <Badge variant="secondary">
            {blockedWords.length} / {maxLimit}
          </Badge>
        </div>
        <div className="min-h-[200px] flex-1 overflow-y-auto rounded-lg border border-border p-3">
          {content()}
        </div>
      </div>
    </>
  );
}
