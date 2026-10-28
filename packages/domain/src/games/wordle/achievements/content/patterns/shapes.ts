import type { PatternSpec } from '../../types';

export const SHAPES = [
  {
    id: 'square_outline',
    family: 'shape',
    name: 'Quadrado vazado',
    mask: `
      ###
      #.#
      ###
    `,
    variants: [
      `
        ####
        #..#
        ####
      `,
      `
        ####
        #..#
        #..#
        ####
      `,
      `
        #####
        #...#
        #####
      `,
      `
        #####
        #...#
        #...#
        #####
      `,
      `
        #####
        #...#
        #...#
        #...#
        #####
      `,
    ],
  },
  {
    id: 'diamond_outline',
    family: 'shape',
    name: 'Losango',
    mask: `
      .#.
      #.#
      .#.
    `,
    variants: [
      `
        .##.
        #..#
        .##.
      `,
      `
        .##.
        #..#
        #..#
        .##.
      `,
      `
        ..#..
        .#.#.
        #...#
        .#.#.
        ..#..
      `,
    ],
  },
  {
    id: 'cross',
    family: 'shape',
    name: 'Cruz',
    mask: `
      .#.
      ###
      .#.
    `,
    variants: [
      `
        .##.
        ####
        .##.
      `,
      `
        ..#..
        #####
        ..#..
      `,
      `
        ..#..
        ..#..
        #####
        ..#..
        ..#..
      `,
    ],
  },
  {
    id: 'heart',
    family: 'shape',
    name: 'Coração',
    mask: `
      #.#
      ###
      ###
      .#.
    `,
    variants: [
      `
        #..#
        ####
        ####
        .##.
      `,
      `
        .#.#.
        #####
        #####
        .###.
        ..#..
      `,
      `
        ##.##
        #####
        #####
        .###.
        ..#..
      `,
    ],
  },
  {
    id: 'arrow_up',
    family: 'shape',
    name: 'Seta para cima',
    mask: `
      .#.
      ###
      .#.
      .#.
    `,
    variants: [
      `
        .##.
        ####
        .##.
        .##.
      `,
      `
        ..#..
        #####
        ..#..
        ..#..
      `,
      `
        ..#..
        .###.
        #####
        ..#..
        ..#..
      `,
    ],
  },
  {
    id: 'arrow_down',
    family: 'shape',
    name: 'Seta para baixo',
    mask: `
      .#.
      .#.
      ###
      .#.
    `,
    variants: [
      `
        .##.
        .##.
        ####
        .##.
      `,
      `
        ..#..
        ..#..
        #####
        ..#..
      `,
      `
        ..#..
        ..#..
        #####
        .###.
        ..#..
      `,
    ],
  },
  {
    id: 'arrow_left',
    family: 'shape',
    name: 'Seta para a esquerda',
    mask: `
      ..#
      .##
      ###
      .##
      ..#
    `,
    variants: [
      `
        ...#
        ..##
        ####
        ..##
        ...#
      `,
      `
        ....#
        ..###
        #####
        ..###
        ....#
      `,
      `
        ....#
        ...##
        #####
        ...##
        ....#
      `,
    ],
  },
  {
    id: 'arrow_right',
    family: 'shape',
    name: 'Seta para a direita',
    mask: `
      #..
      ##.
      ###
      ##.
      #..
    `,
    variants: [
      `
        #...
        ##..
        ####
        ##..
        #...
      `,
      `
        #....
        ###..
        #####
        ###..
        #....
      `,
      `
        #....
        ##...
        #####
        ##...
        #....
      `,
    ],
  },
  {
    id: 'staircase',
    family: 'shape',
    name: 'Escadinha',
    mask: `
      #..
      ##.
      ###
    `,
    variants: [
      `
        #...
        ##..
        ####
      `,
      `
        #...
        ##..
        ###.
        ####
      `,
      `
        #....
        ##...
        ###..
        ####.
        #####
      `,
      `
        #....
        ##...
        #####
      `,
    ],
  },
  {
    id: 'hourglass',
    family: 'shape',
    name: 'Ampulheta',
    mask: `
      ###
      .#.
      ###
    `,
    variants: [
      `
        ####
        .##.
        ####
      `,
      `
        ####
        .##.
        .##.
        ####
      `,
      `
        #####
        .###.
        #####
      `,
      `
        #####
        .###.
        ..#..
        .###.
        #####
      `,
      `
        #####
        ..#..
        #####
      `,
    ],
  },
] satisfies readonly PatternSpec[];
