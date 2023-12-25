import { ITriviaQuestion } from '@marquinhos/types';
import { Schema, model } from 'mongoose';

const TriviaQuestionSchema = new Schema<ITriviaQuestion>({
  question: { required: true, type: String },
  answer: { required: true, type: String },
  lastTimeAsked: { required: false, type: Date },
  timesAsked: { required: true, type: Number },
  hints: { required: false, type: [String] },
  category: { required: true, type: String },
  difficulty: { required: true, type: String },
  createdAt: { required: true, type: Date },
  updatedAt: { required: true, type: Date },
});

export const TriviaQuestionModel = model(
  'triviaQuestion',
  TriviaQuestionSchema
);
