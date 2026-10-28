import type { PatternSpec } from '../../types';

export const TETROMINOES = [
  {
    id: 'tetromino_i',
    family: 'tetromino',
    name: 'Tetraminó I',
    mask: `
      ####
    `,
  },
  {
    id: 'tetromino_o',
    family: 'tetromino',
    name: 'Tetraminó O',
    mask: `
      ##
      ##
    `,
  },
  {
    id: 'tetromino_t',
    family: 'tetromino',
    name: 'Tetraminó T',
    mask: `
      ###
      .#.
    `,
  },
  {
    id: 'tetromino_j',
    family: 'tetromino',
    name: 'Tetraminó J',
    mask: `
      #..
      ###
    `,
  },
  {
    id: 'tetromino_l',
    family: 'tetromino',
    name: 'Tetraminó L',
    mask: `
      ..#
      ###
    `,
  },
  {
    id: 'tetromino_s',
    family: 'tetromino',
    name: 'Tetraminó S',
    mask: `
      .##
      ##.
    `,
  },
  {
    id: 'tetromino_z',
    family: 'tetromino',
    name: 'Tetraminó Z',
    mask: `
      ##.
      .##
    `,
  },
] satisfies readonly PatternSpec[];
