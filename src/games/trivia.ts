import {
  TriviaDifficulty,
  TriviaPlayer,
  ITriviaQuestion as TriviaQuestion,
  TriviaQuestionResponse,
} from '@marquinhos/types';
import { levenshteinDistance } from '@marquinhos/utils/levensteinDistance';
import { logger } from '@marquinhos/utils/logger';
import { TriviaPlayerModel } from '@schemas/triviaPlayer';
import { TriviaQuestionModel } from '@schemas/triviaQuestion';
import { Message } from 'discord.js';

export class TriviaGame {
  private questionsAsked: TriviaQuestion[];
  private questionsAnsweredByPlayers: Map<string, string[]>;
  private pointsAvailable: number;

  currentQuestion: TriviaQuestion;
  players: TriviaPlayer[];
  category: string;
  difficulty: TriviaDifficulty;
  currentQuestionEmbed: Message;
  intervalBetweenQuestions: boolean;

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
  ): Promise<TriviaQuestionResponse> {
    let player = this.players.find((player) => player.id === playerID);
    if (!player) {
      player = { id: playerID, points: 0 };
      this.players.push(player);
    }
    if (this.intervalBetweenQuestions) {
      return 'timeOut';
    }

    if (!this.currentQuestion) {
      return 'questionNotFound';
    }

    if (
      this.questionsAnsweredByPlayers
        .get(this.currentQuestion._id)
        ?.includes(playerID)
    ) {
      return 'alreadyAnswered';
    }

    const isCorrect = answer === this.currentQuestion.answer;
    const similarity = levenshteinDistance(answer, this.currentQuestion.answer);
    let partialPoints = 0;
    if (isCorrect) {
      partialPoints = this.pointsAvailable;
    } else if (similarity <= 2) {
      partialPoints = Math.floor(this.pointsAvailable / 2);
    }

    player.points += partialPoints;
    if (!this.questionsAnsweredByPlayers.has(this.currentQuestion._id)) {
      this.questionsAnsweredByPlayers.set(this.currentQuestion._id, [playerID]);
    } else {
      this.questionsAnsweredByPlayers
        .get(this.currentQuestion._id)
        ?.push(playerID);
    }
    this.pointsAvailable = Math.max(this.pointsAvailable - 1, 5);
    return 'answered';
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
    this.pointsAvailable = 10;
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
        triviaPlayer.globalPoints = triviaPlayer.globalPoints ?? 0;
        triviaPlayer.globalPoints += player.points;
        await triviaPlayer.save();
      }
    }
    return this.players.sort((a, b) => b.points - a.points);
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
    this.questionsAnsweredByPlayers = new Map();
    this.intervalBetweenQuestions = false;
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
    await TriviaQuestionModel.deleteOne({ _id: question._id });
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
