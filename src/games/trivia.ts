import { TriviaQuestionModel } from '@schemas/triviaQuestion';
import {
  TriviaDifficulty,
  TriviaPlayer,
  ITriviaQuestion as TriviaQuestion,
} from '@marquinhos/types';
import { logger } from '@marquinhos/utils/logger';
import { levenshteinDistance } from '@marquinhos/utils/levensteinDistance';
import { TriviaPlayerModel } from '@schemas/triviaPlayer';

export class TriviaGame {
  private currentQuestion: TriviaQuestion;
  private questionsAsked: TriviaQuestion[];

  players: TriviaPlayer[];
  category: string;
  difficulty: TriviaDifficulty;

  constructor(category: string, difficulty: TriviaDifficulty) {
    this.players = [];
    this.questionsAsked = [];
    this.category = category;
    this.difficulty = difficulty;
  }

  public async addQuestion(question: TriviaQuestion): Promise<boolean> {
    try {
      await TriviaQuestionModel.create(question);
      return true;
    } catch (error) {
      logger.error(error);
      return false;
    }
  }

  public async removeQuestion(question: TriviaQuestion): Promise<boolean> {
    try {
      await TriviaQuestionModel.deleteOne(question);
      return true;
    } catch (error) {
      logger.error(error);
      return false;
    }
  }

  public async getQuestion(questionId: string): Promise<TriviaQuestion> {
    return await TriviaQuestionModel.findById(questionId);
  }

  public async getQuestions(
    category: string,
    page: number,
    pageSize: number
  ): Promise<TriviaQuestion[]> {
    const skip = (page - 1) * pageSize;
    const questions = await TriviaQuestionModel.find({ category })
      .skip(skip)
      .limit(pageSize);
    return questions;
  }

  public async playerAnswer(answer: string, playerID: string): Promise<void> {
    if (!this.players.find((player) => player.id === playerID)) {
      this.players.push({ id: playerID, points: 0 });
    }
    const player = this.players.find((player) => player.id === playerID);

    if (this.currentQuestion.playersAnswered.includes(playerID)) {
      return;
    }

    const isCorrect = answer === this.currentQuestion.correctAnswer;
    const similarity =
      levenshteinDistance(answer, this.currentQuestion.correctAnswer) > 5
        ? 0
        : 5;
    const partialPoints = isCorrect ? 10 : similarity;

    player.points += partialPoints;
    this.currentQuestion.playersAnswered.push(playerID);
  }

  public async askQuestion(): Promise<TriviaQuestion> {
    const category = this.category;
    const difficulty = this.difficulty;
    const question = await TriviaQuestionModel.aggregate([
      { $match: { category, difficulty } },
      { $sample: { size: 1 } },
    ]);

    if (this.questionsAsked.includes(question[0])) {
      return await this.askQuestion();
    }

    this.questionsAsked.push(question[0]);
    this.currentQuestion = question[0] as TriviaQuestion;
    question[0].timesAsked++;
    question[0].lastTimeAsked = new Date();
    await question[0].save();
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
}
