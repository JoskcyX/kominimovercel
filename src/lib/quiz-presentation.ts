export function getPresentationProgress(questionIds: string[], answers: { question_id: string; participant_id: string }[], participantIds: string[]) {
  const active = new Set(participantIds);
  const counts = questionIds.map((id) => new Set(answers.filter((answer) => answer.question_id === id && active.has(answer.participant_id)).map((answer) => answer.participant_id)).size);
  const next = counts.findIndex((count) => active.size === 0 || count < active.size);
  const complete = active.size > 0 && questionIds.length > 0 && next === -1;
  const index = next === -1 ? Math.max(0, questionIds.length - 1) : next;
  return { index, answered: counts[index] ?? 0, total: active.size, complete };
}