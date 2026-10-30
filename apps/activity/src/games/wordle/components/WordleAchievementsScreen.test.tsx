import '@/i18n';
import type {
  WordleAchievementStatus,
  WordlePlayerStats,
} from '@marquinhos/contracts/wordle';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, mock } from 'bun:test';
import { WordleAchievementsScreen } from './WordleAchievementsScreen';

const sampleStats: WordlePlayerStats = {
  played: 20,
  wins: 17,
  winRate: 85,
  currentStreak: 4,
  bestStreak: 9,
  distribution: [2, 5, 6, 3, 1, 0, 0, 0],
};

const sampleAchievements: WordleAchievementStatus[] = [
  {
    id: 'wordle_first_win',
    family: 'wins',
    tier: 1,
    name: 'Primeira palavra',
    description: 'Acerte sua primeira palavra do dia no Terminhos.',
    icon: '🟩',
    rarity: 'common',
    rewardXp: 25,
    hidden: false,
    unlockedAt: '2026-10-24T04:00:00.000Z',
    progress: { current: 1, target: 1 },
    holdersPercent: 88,
  },
  {
    id: 'wordle_wins_10',
    family: 'wins',
    tier: 2,
    name: 'Dez palavras',
    description: 'Acerte a palavra diária em 10 dias.',
    icon: '📚',
    rarity: 'rare',
    rewardXp: 100,
    hidden: false,
    unlockedAt: null,
    progress: { current: 7, target: 10 },
    holdersPercent: 35.5,
  },
  {
    id: 'wordle_streak_7',
    family: 'streak',
    tier: 2,
    name: 'Semana perfeita',
    description: 'Mantenha uma sequência de 7 dias acertando o Terminhos.',
    icon: '🔥',
    rarity: 'epic',
    rewardXp: 150,
    hidden: false,
    unlockedAt: null,
    progress: { current: 4, target: 7 },
    holdersPercent: 12,
  },
  {
    id: 'wordle_night_owl',
    family: 'timing',
    tier: 4,
    name: '',
    description: '',
    icon: '❔',
    rarity: 'common',
    rewardXp: 50,
    hidden: true,
    unlockedAt: null,
    progress: null,
    holdersPercent: 4,
  },
];

describe('WordleAchievementsScreen', () => {
  it('shows the current DEVANEIOS row prefix as capped progress', () => {
    const devaneios: WordleAchievementStatus = {
      ...sampleAchievements[0]!,
      id: 'wordle_v2_devaneios_rows',
      family: 'vocabulary',
      name: 'DEVANEIOS',
      description: 'Forme DEVANEIOS na mesma linha ao longo de vários dias.',
      icon: '🔤',
      rarity: 'legendary',
      rewardXp: 300,
      unlockedAt: null,
      progress: { current: 4, target: 9 },
    };
    render(
      <WordleAchievementsScreen achievements={[devaneios]} onBack={() => {}} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /DEVANEIOS/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('4 / 9')).toBeTruthy();
    const progress = within(dialog).getByRole('progressbar');
    expect(progress.getAttribute('aria-valuenow')).toBe('4');
    expect(progress.getAttribute('aria-valuemax')).toBe('9');
  });

  it('shows both drawing colors and highlights a saved yellow discovery', () => {
    const achievement: WordleAchievementStatus = {
      ...sampleAchievements[0]!,
      id: 'wordle_v2_tetromino_t',
      family: 'tetrominoes',
      name: 'Peça T',
      patternPreview: {
        patternId: 'tetromino_t',
        mask: ['###', '.#.'],
        colors: ['correct', 'present'],
        rotations: [0, 90, 180, 270],
      },
      matchEvidence: {
        patternId: 'tetromino_t',
        color: 'present',
        origin: [0, 0],
        rotation: 0,
        cells: [
          [0, 0],
          [0, 1],
          [0, 2],
          [1, 1],
        ],
        date: '2026-10-26',
        feedback: [
          ['present', 'present', 'present', 'absent', 'correct'],
          ['absent', 'present', 'absent', 'absent', 'correct'],
        ],
      },
    };
    render(
      <WordleAchievementsScreen
        achievements={[achievement]}
        onBack={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Peça T/ }));
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByRole('img', { name: /modelo.*verde/i }),
    ).toBeTruthy();
    expect(
      within(dialog).getByRole('img', { name: /modelo.*amarelo/i }),
    ).toBeTruthy();
    const evidence = within(dialog).getByRole('img', {
      name: /sua descoberta.*amarelo/i,
    });
    expect(evidence.querySelectorAll('[data-matched="true"]')).toHaveLength(4);
    expect(evidence.querySelectorAll('[data-color="correct"]')).toHaveLength(2);
  });

  it('renders six-column pattern previews and saved evidence', () => {
    const achievement: WordleAchievementStatus = {
      ...sampleAchievements[0]!,
      id: 'wordle_v2_pattern_triangle_6',
      name: 'Triângulo de base 6',
      patternPreview: {
        patternId: 'triangle_6',
        mask: ['..##..', '.####.', '######'],
        colors: ['correct', 'present'],
        rotations: [0],
      },
      matchEvidence: {
        patternId: 'triangle_6',
        color: 'correct',
        origin: [0, 0],
        rotation: 0,
        cells: [
          [0, 2],
          [0, 3],
          [1, 1],
          [1, 2],
          [1, 3],
          [1, 4],
          [2, 0],
          [2, 1],
          [2, 2],
          [2, 3],
          [2, 4],
          [2, 5],
        ],
        date: '2026-10-28',
        feedback: [
          ['absent', 'absent', 'correct', 'correct', 'absent', 'absent'],
          ['absent', 'correct', 'correct', 'correct', 'correct', 'absent'],
          Array(6).fill('correct'),
        ],
      },
    };
    render(
      <WordleAchievementsScreen
        achievements={[achievement]}
        onBack={() => {}}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Triângulo de base 6/ }),
    );
    const dialog = screen.getByRole('dialog');
    const previews = within(dialog).getAllByRole('img', { name: /modelo/i });
    expect(previews).toHaveLength(2);
    expect(
      previews.every((preview) =>
        preview.getAttribute('style')?.includes('repeat(6, 1.25rem'),
      ),
    ).toBe(true);
    const evidence = within(dialog).getByRole('img', {
      name: /sua descoberta.*verde/i,
    });
    expect(evidence.getAttribute('style')).toContain('repeat(6, 1.5rem');
  });

  it('renders an empty state when no achievements exist', () => {
    render(<WordleAchievementsScreen achievements={[]} onBack={() => {}} />);

    expect(screen.getByRole('heading', { name: /conquistas/i })).toBeTruthy();
    expect(
      screen.getByText(/nenhuma conquista disponível no momento/i),
    ).toBeTruthy();
  });

  it('renders stats header, distribution bars, families, tier ladders, progress bars, holders %, and secret masking', () => {
    const { container } = render(
      <WordleAchievementsScreen
        achievements={sampleAchievements}
        stats={sampleStats}
        onBack={() => {}}
      />,
    );

    expect(screen.getByText('1 de 4 desbloqueadas')).toBeTruthy();
    expect(
      within(container.querySelector('[data-stat="played"]')!).getByText('20'),
    ).toBeTruthy();
    expect(
      within(container.querySelector('[data-stat="wins"]')!).getByText('17'),
    ).toBeTruthy();
    expect(
      within(container.querySelector('[data-stat="winRate"]')!).getByText(
        '85%',
      ),
    ).toBeTruthy();
    expect(
      within(container.querySelector('[data-stat="currentStreak"]')!).getByText(
        '4',
      ),
    ).toBeTruthy();
    expect(
      within(container.querySelector('[data-stat="bestStreak"]')!).getByText(
        '9',
      ),
    ).toBeTruthy();
    expect(
      container.querySelectorAll('[data-distribution-bucket]'),
    ).toHaveLength(8);
    expect(
      container.querySelector('[data-distribution-bucket="0"]'),
    ).toBeTruthy();

    expect(container.querySelector('section[data-family="wins"]')).toBeTruthy();
    expect(
      container.querySelector('section[data-family="streak"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('section[data-family="timing"]'),
    ).toBeTruthy();

    expect(screen.getByText('Primeira palavra')).toBeTruthy();
    expect(screen.getByText('Dez palavras')).toBeTruthy();
    expect(screen.getByText('7 / 10')).toBeTruthy();
    expect(screen.getByText('88% do servidor')).toBeTruthy();
    expect(screen.getByText('35.5% do servidor')).toBeTruthy();

    expect(screen.getByText('Conquista secreta')).toBeTruthy();
    expect(
      screen.getByText(
        /continue jogando o terminhos para descobrir como desbloquear/i,
      ),
    ).toBeTruthy();
    expect(screen.getByText('Secreta')).toBeTruthy();
  });

  it('filters achievements by todas, desbloqueadas, and bloqueadas', () => {
    render(
      <WordleAchievementsScreen
        achievements={sampleAchievements}
        stats={sampleStats}
        onBack={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Desbloqueadas' }));
    expect(screen.getByText('Primeira palavra')).toBeTruthy();
    expect(screen.queryByText('Dez palavras')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Bloqueadas' }));
    expect(screen.queryByText('Primeira palavra')).toBeNull();
    expect(screen.getByText('Dez palavras')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Todas' }));
    expect(screen.getByText('Primeira palavra')).toBeTruthy();
    expect(screen.getByText('Dez palavras')).toBeTruthy();
  });

  it('opens and closes the achievement detail sheet on click and Escape', () => {
    render(
      <WordleAchievementsScreen
        achievements={sampleAchievements}
        stats={sampleStats}
        onBack={() => {}}
      />,
    );

    fireEvent.click(screen.getByText('Dez palavras'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText('Detalhes da conquista')).toBeTruthy();
    expect(within(dialog).getByText('7 / 10')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByText('Primeira palavra'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: /fechar detalhes da conquista/i }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('invokes onBack when the back button is clicked', () => {
    const onBack = mock(() => {});
    render(
      <WordleAchievementsScreen
        achievements={sampleAchievements}
        onBack={onBack}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
