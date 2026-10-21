/** Notification previews stay in authenticated responses/memory, never diagnostics or the durable feed. */
export function previewText(value, limit = 160) {
  if (typeof value !== 'string') return '';
  const plain = value.slice(0, 8192).replace(/```[\s\S]*?(?:```|$)/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, '链接')
    .replace(/<[^>]*>/g, '').replace(/(^|\n)\s{0,3}(?:#{1,6}\s+|>\s*|[-*+]\s+)/g, ' ')
    .replace(/[*_`~]/g, '').replace(/[\p{Cc}\p{Cf}\s]+/gu, ' ').trim();
  const chars = [...plain]; return chars.length > limit ? chars.slice(0, limit - 1).join('') + '…' : plain;
}
export function sessionTitle(ctx, session) {
  try { const summary = ctx.sessionController?.listState?.summaryFor(session); return previewText(summary?.title ?? summary?.projections?.values?.title, 80); }
  catch { return ''; }
}
export function finalPreview(session, turn) {
  try {
    // Read a bounded live suffix, only the requested turn and its final step. Never use tool results/reasoning.
    const end = session.seq;
    const rows = session.snapshotEvents(Math.max(session.firstLiveSeq ?? 0, end - 512), end);
    const events = rows.filter(e => e.data?.turn === turn);
    const step = Math.max(-1, ...events.map(e => typeof e.data?.step === 'number' ? e.data.step : -1));
    const answer = events.findLast(e => e.type === 'assistant/message' && e.data?.step === step &&
      Array.isArray(e.data.message?.content) && !e.data.message.content.some(b => b.type === 'tool-call'));
    const content = answer?.data.message.content ?? [];
    return previewText(content.filter(b => b.type === 'text').map(b => b.text).join('\n'));
  } catch { return ''; }
}
export function questionPreview(request) {
  const questions = Array.isArray(request?.questions) ? request.questions : [];
  const first = previewText(questions[0]?.question, 100);
  return first && questions.length > 1 ? `${first}（另有 ${questions.length - 1} 个问题）` : first;
}
export function permissionPreview(request) {
  // Stable operation descriptions, not arbitrary commands, arguments, paths or credentials.
  const tool = request?.toolName;
  if (['write', 'edit', 'apply_patch', 'write_file', 'edit_file', 'multi_edit'].includes(tool)) return '允许 AI 写入或修改文件？';
  if (['bash', 'shell', 'terminal', 'exec_command'].includes(tool)) return '允许 AI 执行终端命令？';
  if (['read', 'read_file', 'glob', 'grep', 'list_directory'].includes(tool)) return '允许 AI 读取文件或目录？';
  return 'AI 请求操作权限';
}
