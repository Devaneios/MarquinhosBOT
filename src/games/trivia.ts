import {
  TriviaDifficulty,
  TriviaPlayer,
  ITriviaQuestion as TriviaQuestion,
} from '@marquinhos/types';
import { levenshteinDistance } from '@marquinhos/utils/levensteinDistance';
import { logger } from '@marquinhos/utils/logger';
import { TriviaPlayerModel } from '@schemas/triviaPlayer';
import { TriviaQuestionModel } from '@schemas/triviaQuestion';

export class TriviaGame {
  private currentQuestion: TriviaQuestion;
  private questionsAsked: TriviaQuestion[];

  players: TriviaPlayer[];
  category: string;
  difficulty: TriviaDifficulty;

  constructor(
    category: string,
    difficulty: TriviaDifficulty,
    playerID: string
  ) {
    this.startGame(category, difficulty, playerID);
  }

  public async playerAnswer(
    answer: string,
    playerID: string
  ): Promise<boolean> {
    if (!this.players.find((player) => player.id === playerID)) {
      this.players.push({ id: playerID, points: 0 });
    }
    const player = this.players.find((player) => player.id === playerID);
    console.log(this.currentQuestion);
    if (!this.currentQuestion) {
      return false;
    }

    if (this.currentQuestion.playersAnswered.includes(playerID)) {
      return false;
    }

    const isCorrect = answer === this.currentQuestion.answer;
    const similarity =
      levenshteinDistance(answer, this.currentQuestion.answer) > 3 ? 0 : 5;
    const partialPoints = isCorrect ? 10 : similarity;

    player.points += partialPoints;
    this.currentQuestion.playersAnswered.push(playerID);
    return true;
  }

  public async askQuestion(): Promise<TriviaQuestion> {
    const category = this.category;
    const difficulty = this.difficulty;
    const question = await TriviaQuestionModel.aggregate([
      { $match: { difficulty } },
      { $sample: { size: 1 } },
    ]);

    if (this.questionsAsked.includes(question[0])) {
      return await this.askQuestion();
    }

    this.questionsAsked.push(question[0]);
    this.currentQuestion = question[0] as TriviaQuestion;
    question[0].timesAsked++;
    question[0].lastTimeAsked = new Date();
    await TriviaQuestionModel.updateOne({ _id: question[0]._id }, question[0]);
    return this.currentQuestion;
  }

  public async endGame(): Promise<TriviaPlayer[]> {
    for (let index = 0; index < this.players.length; index++) {
      const player = this.players[index];
      const triviaPlayer = await TriviaPlayerModel.findOne({ id: player.id });
      if (!triviaPlayer) {
        await TriviaPlayerModel.create(player);
      } else {
        triviaPlayer.globalPoints += player.points;
        await triviaPlayer.save();
      }
    }
    return this.players;
  }

  private async startGame(
    category: string,
    difficulty: TriviaDifficulty,
    playerID: string
  ): Promise<void> {
    this.category = category;
    this.difficulty = difficulty;
    this.players = [{ id: playerID, points: 0 }];
    this.questionsAsked = [];
  }
}

export const addQuestion = async (
  question: TriviaQuestion
): Promise<boolean> => {
  try {
    await TriviaQuestionModel.create(question);
    return true;
  } catch (error) {
    logger.error(error);
    return false;
  }
};

export const removeQuestion = async (
  question: TriviaQuestion
): Promise<boolean> => {
  try {
    await TriviaQuestionModel.deleteOne(question);
    return true;
  } catch (error) {
    logger.error(error);
    return false;
  }
};

export const getQuestion = async (
  questionId: string
): Promise<TriviaQuestion> => {
  return await TriviaQuestionModel.findById(questionId);
};

export const getQuestions = async (
  category: string,
  page: number,
  pageSize: number
): Promise<TriviaQuestion[]> => {
  const skip = (page - 1) * pageSize;
  const questions = await TriviaQuestionModel.find({ category })
    .skip(skip)
    .limit(pageSize);
  return questions;
};
