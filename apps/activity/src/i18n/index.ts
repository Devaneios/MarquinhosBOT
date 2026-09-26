import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import common from './locales/pt-BR/common.json';
import games from './locales/pt-BR/games.json';
import battleship from './locales/pt-BR/games/battleship.json';
import bingoSpeed from './locales/pt-BR/games/bingo-speed.json';
import boggleWordRace from './locales/pt-BR/games/boggle-word-race.json';
import cards from './locales/pt-BR/games/cards.json';
import checkers from './locales/pt-BR/games/checkers.json';
import connectFour from './locales/pt-BR/games/connect-four.json';
import dominoesBlock from './locales/pt-BR/games/dominoes-block.json';
import hangman from './locales/pt-BR/games/hangman.json';
import minesweeperVersus from './locales/pt-BR/games/minesweeper-versus.json';
import pong from './locales/pt-BR/games/pong.json';
import rockPaperScissors from './locales/pt-BR/games/rock-paper-scissors.json';
import snakeGame from './locales/pt-BR/games/snake-game.json';
import ticTacToe from './locales/pt-BR/games/tic-tac-toe.json';
import towerUnstable from './locales/pt-BR/games/tower-unstable.json';
import triviaQuiz from './locales/pt-BR/games/trivia-quiz.json';
import wordChain from './locales/pt-BR/games/word-chain.json';
import wordSearchRace from './locales/pt-BR/games/word-search-race.json';
import wordleRace from './locales/pt-BR/games/wordle-race.json';
import wordle from './locales/pt-BR/games/wordle.json';
import rooms from './locales/pt-BR/rooms.json';

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
