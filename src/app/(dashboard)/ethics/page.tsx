import {
  EthicsCheckin,
  QuestionManager,
  ReflectionHistory,
  getActiveQuestions,
  getReflection,
  getReflectionHistory,
} from "@/features/ethics";
import { getWeekStart } from "@/features/weekly";

export default async function EthicsPage() {
  const weekStart = getWeekStart(new Date());

  const [questionsResult, reflectionResult, historyResult] = await Promise.all([
    getActiveQuestions(),
    getReflection(weekStart),
    getReflectionHistory(),
  ]);

  const questions = questionsResult.ok ? questionsResult.value : [];
  const initialAnswers =
    reflectionResult.ok && reflectionResult.value ? reflectionResult.value.answers : [];
  const reflections = historyResult.ok ? historyResult.value : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ethics</h1>
        <p className="mt-1 text-sm text-text-secondary">
          A weekly reflection on how you worked, in your own words.
        </p>
      </div>

      <EthicsCheckin weekStart={weekStart} questions={questions} initialAnswers={initialAnswers} />
      <QuestionManager questions={questions} />
      <ReflectionHistory reflections={reflections} />
    </div>
  );
}
