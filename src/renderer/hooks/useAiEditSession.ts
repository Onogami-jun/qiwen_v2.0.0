import { useCallback, useRef, useState } from 'react';
import { callAiEditModel } from '../services/aiEditClient';

/**
 * 四个 AI 编辑面板（文档/PPT/白板/思维导图）共用的会话状态机。
 *
 * 交互模型是固定的、Casey 明确要求过不能变的那一条：
 * 描述修改 → AI 生成 → 先看 diff 预览 → 用户确认应用/放弃，绝不自动落地。
 * 这条流程本身（loading/error/pendingDiff/history 状态 + generate/apply/discard/stop
 * 四个动作）四个面板逐字重复，真正不同的只有"prompt 怎么拼"和"AI 返回的内容怎么
 * 解析成 diff、怎么落地"——这两件事通过 buildPrompt / parseResponse / onApply 三个
 * 参数交给各面板自己实现，其余流程控制都在这一份里。
 */

export interface AiEditHistoryEntry {
  instruction: string;
  status: 'applied' | 'discarded';
}

export interface UseAiEditSessionOptions<TPending> {
  /** 根据用户输入的指令，拼出发给模型的完整 prompt（当前内容上下文由各面板自己塞进去） */
  buildPrompt: (instruction: string) => string;
  /** 把模型返回的原始文本解析成这个面板自己的"待确认改动"结构，diff 计算也在这一步做 */
  parseResponse: (raw: string) => TPending;
  /** 用户点"应用修改"时真正落地这次改动。返回 false 表示落地失败（目前只有文档面板会用到这一档，
   *  因为它落地依赖"当前是否有打开的编辑器"，可能失败；其余三个面板写回的是内存里的状态，不会失败） */
  onApply: (pending: TPending) => boolean | void;
  /** 生成前的前置校验，比如"文档/画面内容为空"。返回非空字符串就当错误处理，不发请求 */
  validate?: () => string | null;
}

export function useAiEditSession<TPending>(options: UseAiEditSessionOptions<TPending>) {
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<{ instruction: string; data: TPending } | null>(null);
  const [history, setHistory] = useState<AiEditHistoryEntry[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async () => {
    const text = instruction.trim();
    if (!text || loading) return;

    const validationError = options.validate?.();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    setPending(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const raw = await callAiEditModel(options.buildPrompt(text), ctrl.signal);
      if (ctrl.signal.aborted) return;
      const data = options.parseResponse(raw);
      setPending({ instruction: text, data });
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e?.message || 'AI 生成修改失败，请重试');
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instruction, loading, options]);

  const apply = useCallback((): boolean => {
    if (!pending) return false;
    const result = options.onApply(pending.data);
    const ok = result !== false;
    setHistory(h => [...h, { instruction: pending.instruction, status: ok ? 'applied' : 'discarded' }]);
    setPending(null);
    setInstruction('');
    return ok;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, options]);

  const discard = useCallback(() => {
    if (!pending) return;
    setHistory(h => [...h, { instruction: pending.instruction, status: 'discarded' }]);
    setPending(null);
  }, [pending]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, []);

  return {
    instruction,
    setInstruction,
    loading,
    error,
    setError,
    pendingData: pending?.data ?? null,
    pendingInstruction: pending?.instruction ?? null,
    hasPendingDiff: pending !== null,
    history,
    generate,
    apply,
    discard,
    stop,
  };
}
