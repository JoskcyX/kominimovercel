export function getPresentationProgress(questionIds: string[], answers: { question_id: string; participant_id: string }[], participantIds: string[], currentIndex = 0) {
  const active = new Set(participantIds);
  const counts = questionIds.map((id) => new Set(answers.filter((answer) => answer.question_id === id && active.has(answer.participant_id)).map((answer) => answer.participant_id)).size);
  const index = Math.min(Math.max(0, currentIndex), Math.max(0, questionIds.length - 1));
  const complete = active.size > 0 && questionIds.length > 0 && counts.every((count) => count >= active.size);
  return { index, answered: counts[index] ?? 0, total: active.size, complete };
}