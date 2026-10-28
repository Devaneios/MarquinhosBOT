import type { PatternSpec } from '../../types';

export const LETTERS = [
  {
    id: 'letter_a',
    family: 'letter',
    name: 'Letra A',
    mask: `
      .#.
      #.#
      ###
      #.#
      #.#
    `,
    variants: [
      `
        .##.
        #..#
        ####
        #..#
        #..#
      `,
      `
        .###.
        #...#
        #####
        #...#
        #...#
      `,
      `
        ..#..
        .#.#.
        #...#
        #####
        #...#
      `,
      `
        ..#..
        .#.#.
        #####
        #...#
        #...#
      `,
    ],
  },
  {
    id: 'letter_b',
    family: 'letter',
    name: 'Letra B',
    mask: `
      ##.
      #.#
      ##.
      #.#
      ##.
    `,
    variants: [
      `
        ###.
        #..#
        ###.
        #..#
        ###.
      `,
      `
        ####.
        #...#
        ####.
        #...#
        ####.
      `,
      `
        ####.
        #...#
        ###..
        #...#
        ####.
      `,
    ],
  },
  {
    id: 'letter_c',
    family: 'letter',
    name: 'Letra C',
    mask: `
      .##
      #..
      #..
      #..
      .##
    `,
    variants: [
      `
        .###
        #...
        #...
        #...
        .###
      `,
      `
        ####
        #...
        #...
        #...
        ####
      `,
      `
        .####
        #....
        #....
        #....
        .####
      `,
      `
        #####
        #....
        #....
        #....
        #####
      `,
    ],
  },
  {
    id: 'letter_d',
    family: 'letter',
    name: 'Letra D',
    mask: `
      ##.
      #.#
      #.#
      #.#
      ##.
    `,
    variants: [
      `
        ###.
        #..#
        #..#
        #..#
        ###.
      `,
      `
        ####.
        #...#
        #...#
        #...#
        ####.
      `,
    ],
  },
  {
    id: 'letter_e',
    family: 'letter',
    name: 'Letra E',
    mask: `
      ###
      #..
      ##.
      #..
      ###
    `,
    variants: [
      `
        ####
        #...
        ###.
        #...
        ####
      `,
      `
        #####
        #....
        ####.
        #....
        #####
      `,
      `
        #####
        #....
        #####
        #....
        #####
      `,
    ],
  },
  {
    id: 'letter_f',
    family: 'letter',
    name: 'Letra F',
    mask: `
      ###
      #..
      ##.
      #..
      #..
    `,
    variants: [
      `
        ####
        #...
        ###.
        #...
        #...
      `,
      `
        #####
        #....
        ####.
        #....
        #....
      `,
      `
        #####
        #....
        #####
        #....
        #....
      `,
    ],
  },
  {
    id: 'letter_g',
    family: 'letter',
    name: 'Letra G',
    mask: `
      .###.
      #....
      #.###
      #...#
      .###.
    `,
    variants: [
      `
        #####
        #....
        #..##
        #...#
        #####
      `,
      `
        .####
        #....
        #.###
        #...#
        .###.
      `,
    ],
  },
  {
    id: 'letter_h',
    family: 'letter',
    name: 'Letra H',
    mask: `
      #.#
      #.#
      ###
      #.#
      #.#
    `,
    variants: [
      `
        #..#
        #..#
        ####
        #..#
        #..#
      `,
      `
        #...#
        #...#
        #####
        #...#
        #...#
      `,
    ],
  },
  {
    id: 'letter_i',
    family: 'letter',
    name: 'Letra I',
    mask: `
      ###
      .#.
      .#.
      .#.
      ###
    `,
    variants: [
      `
        ####
        .##.
        .##.
        .##.
        ####
      `,
      `
        #####
        ..#..
        ..#..
        ..#..
        #####
      `,
    ],
  },
  {
    id: 'letter_j',
    family: 'letter',
    name: 'Letra J',
    mask: `
      ..#
      ..#
      ..#
      #.#
      .#.
    `,
    variants: [
      `
        ...#
        ...#
        ...#
        #..#
        .##.
      `,
      `
        ....#
        ....#
        ....#
        #...#
        .###.
      `,
      `
        #####
        ..#..
        ..#..
        #.#..
        .##..
      `,
    ],
  },
  {
    id: 'letter_k',
    family: 'letter',
    name: 'Letra K',
    mask: `
      #.#
      #.#
      ##.
      #.#
      #.#
    `,
    variants: [
      `
        #..#
        #.#.
        ##..
        #.#.
        #..#
      `,
      `
        #...#
        #..#.
        ###..
        #..#.
        #...#
      `,
    ],
  },
  {
    id: 'letter_l',
    family: 'letter',
    name: 'Letra L',
    mask: `
      #..
      #..
      #..
      #..
      ###
    `,
    variants: [
      `
        #...
        #...
        #...
        #...
        ####
      `,
      `
        #....
        #....
        #....
        #....
        #####
      `,
    ],
  },
  {
    id: 'letter_m',
    family: 'letter',
    name: 'Letra M',
    mask: `
      #...#
      ##.##
      #.#.#
      #...#
      #...#
    `,
    variants: [
      `
        ##.##
        #.#.#
        #...#
        #...#
        #...#
      `,
      `
        #...#
        ##.##
        #.#.#
        #.#.#
        #...#
      `,
    ],
  },
  {
    id: 'letter_n',
    family: 'letter',
    name: 'Letra N',
    mask: `
      #...#
      ##..#
      #.#.#
      #..##
      #...#
    `,
    variants: [
      `
        ##..#
        #.#.#
        #.#.#
        #..##
        #...#
      `,
    ],
  },
  {
    id: 'letter_o',
    family: 'letter',
    name: 'Letra O',
    mask: `
      .#.
      #.#
      #.#
      #.#
      .#.
    `,
    variants: [
      `
        .##.
        #..#
        #..#
        #..#
        .##.
      `,
      `
        .###.
        #...#
        #...#
        #...#
        .###.
      `,
    ],
  },
  {
    id: 'letter_p',
    family: 'letter',
    name: 'Letra P',
    mask: `
      ##.
      #.#
      ##.
      #..
      #..
    `,
    variants: [
      `
        ###.
        #..#
        ###.
        #...
        #...
      `,
      `
        ####.
        #...#
        ####.
        #....
        #....
      `,
    ],
  },
  {
    id: 'letter_q',
    family: 'letter',
    name: 'Letra Q',
    mask: `
      .###.
      #...#
      #.#.#
      #..#.
      .##.#
    `,
    variants: [
      `
        .###.
        #...#
        #...#
        #..#.
        .##.#
      `,
      `
        .###.
        #...#
        #.#.#
        #..##
        .####
      `,
    ],
  },
  {
    id: 'letter_r',
    family: 'letter',
    name: 'Letra R',
    mask: `
      ####.
      #...#
      ####.
      #..#.
      #...#
    `,
    variants: [
      `
        ####.
        #...#
        ####.
        #.#..
        #..#.
      `,
      `
        ####.
        #...#
        ####.
        #..#.
        #..##
      `,
    ],
  },
  {
    id: 'letter_s',
    family: 'letter',
    name: 'Letra S',
    mask: `
      .##
      #..
      .#.
      ..#
      ##.
    `,
    variants: [
      `
        .###
        #...
        .##.
        ...#
        ###.
      `,
      `
        .####
        #....
        .###.
        ....#
        ####.
      `,
    ],
  },
  {
    id: 'letter_t',
    family: 'letter',
    name: 'Letra T',
    mask: `
      ###
      .#.
      .#.
      .#.
      .#.
    `,
    variants: [
      `
        ####
        .##.
        .##.
        .##.
        .##.
      `,
      `
        #####
        ..#..
        ..#..
        ..#..
        ..#..
      `,
    ],
  },
  {
    id: 'letter_u',
    family: 'letter',
    name: 'Letra U',
    mask: `
      #.#
      #.#
      #.#
      #.#
      ###
    `,
    variants: [
      `
        #..#
        #..#
        #..#
        #..#
        ####
      `,
      `
        #...#
        #...#
        #...#
        #...#
        #####
      `,
      `
        #...#
        #...#
        #...#
        #...#
        .###.
      `,
    ],
  },
  {
    id: 'letter_v',
    family: 'letter',
    name: 'Letra V',
    mask: `
      #.#
      #.#
      #.#
      .#.
      .#.
    `,
    variants: [
      `
        #..#
        #..#
        #..#
        .##.
        .##.
      `,
      `
        #...#
        #...#
        #...#
        .#.#.
        ..#..
      `,
      `
        #...#
        #...#
        .#.#.
        .#.#.
        ..#..
      `,
    ],
  },
  {
    id: 'letter_w',
    family: 'letter',
    name: 'Letra W',
    mask: `
      #...#
      #...#
      #.#.#
      #.#.#
      .#.#.
    `,
    variants: [
      `
        #...#
        #...#
        #.#.#
        ##.##
        #...#
      `,
      `
        #...#
        #...#
        #...#
        #.#.#
        .#.#.
      `,
    ],
  },
  {
    id: 'letter_x',
    family: 'letter',
    name: 'Letra X',
    mask: `
      #.#
      #.#
      .#.
      #.#
      #.#
    `,
    variants: [
      `
        #..#
        #..#
        .##.
        #..#
        #..#
      `,
      `
        #..#
        .##.
        .##.
        .##.
        #..#
      `,
      `
        #...#
        .#.#.
        ..#..
        .#.#.
        #...#
      `,
    ],
  },
  {
    id: 'letter_y',
    family: 'letter',
    name: 'Letra Y',
    mask: `
      #.#
      #.#
      .#.
      .#.
      .#.
    `,
    variants: [
      `
        #..#
        #..#
        .##.
        .##.
        .##.
      `,
      `
        #...#
        #...#
        .#.#.
        ..#..
        ..#..
      `,
      `
        #...#
        .#.#.
        ..#..
        ..#..
        ..#..
      `,
    ],
  },
  {
    id: 'letter_z',
    family: 'letter',
    name: 'Letra Z',
    mask: `
      ###
      ..#
      .#.
      #..
      ###
    `,
    variants: [
      `
        ####
        ...#
        .##.
        #...
        ####
      `,
      `
        #####
        ....#
        ..#..
        #....
        #####
      `,
      `
        #####
        ...#.
        ..#..
        .#...
        #####
      `,
    ],
  },
] satisfies readonly PatternSpec[];
