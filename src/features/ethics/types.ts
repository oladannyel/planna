export interface EthicsQuestion {
  id: string;
  question: string;
  sortOrder: number;
  active: boolean;
}

export interface ReflectionAnswer {
  questionId: string;
  question: string;
  answer: string;
}

export interface Reflection {
  weekStart: string;
  answers: ReflectionAnswer[];
}
