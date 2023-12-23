import { Schema, model } from 'mongoose';
import { TriviaPlayer } from '@marquinhos/types';

const TriviaPlayerSchema = new Schema<TriviaPlayer>({
  id: { required: true, type: String },
  points: { required: false, type: Number },
  globalPoints: { required: false, type: Number },
});

export const TriviaPlayerModel = model('triviaPlayer', TriviaPlayerSchema);
