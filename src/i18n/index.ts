import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import battleship from './locales/pt-BR/battleship.json';
import bingoSpeed from './locales/pt-BR/bingo-speed.json';
import boggleWordRace from './locales/pt-BR/boggle-word-race.json';
import cards from './locales/pt-BR/cards.json';
import checkers from './locales/pt-BR/checkers.json';
import common from './locales/pt-BR/common.json';
import connectFour from './locales/pt-BR/connect-four.json';
import dominoesBlock from './locales/pt-BR/dominoes-block.json';
import games from './locales/pt-BR/games.json';
import hangman from './locales/pt-BR/hangman.json';
import minesweeperVersus from './locales/pt-BR/minesweeper-versus.json';
import pong from './locales/pt-BR/pong.json';
import rockPaperScissors from './locales/pt-BR/rock-paper-scissors.json';
import rooms from './locales/pt-BR/rooms.json';
import snakeGame from './locales/pt-BR/snake-game.json';
import ticTacToe from './locales/pt-BR/tic-tac-toe.json';
import towerUnstable from './locales/pt-BR/tower-unstable.json';
import triviaQuiz from './locales/pt-BR/trivia-quiz.json';
import wordChain from './locales/pt-BR/word-chain.json';
import wordSearchRace from './locales/pt-BR/word-search-race.json';
import wordleRace from './locales/pt-BR/wordle-race.json';
import wordle from './locales/pt-BR/wordle.json';

void i18next.use(initReactI18next).init({
  lng: 'pt-BR',
  fallbackLng: 'pt-BR',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
  resources: {
    'pt-BR': {
      common,
      games,
      battleship,
      'bingo-speed': bingoSpeed,
      'boggle-word-race': boggleWordRace,
      cards,
      checkers,
      'connect-four': connectFour,
      'dominoes-block': dominoesBlock,
      hangman,
      'minesweeper-versus': minesweeperVersus,
      pong,
      'rock-paper-scissors': rockPaperScissors,
      rooms,
      'snake-game': snakeGame,
      'tic-tac-toe': ticTacToe,
      'tower-unstable': towerUnstable,
      'trivia-quiz': triviaQuiz,
      'word-chain': wordChain,
      wordle,
      'wordle-race': wordleRace,
      'word-search-race': wordSearchRace,
    },
  },
});

export default i18next;
