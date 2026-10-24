import '@/i18n';
import type { WordleAchievementStatus } from '@marquinhos/contracts/wordle';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, mock } from 'bun:test';
import { WordleAchievementsScreen } from './WordleAchievementsScreen';

const sampleAchievements: WordleAchievementStatus[] = [
  {
    id: 'wordle_first_win',
    name: 'Primeira palavra',
    description: 'Acerte sua primeira palavra do dia no Terminhos.',
    icon: '🟩',
    rarity: 'common',
    rewardXp: 25,
    unlockedAt: '2026-10-24T04:00:00.000Z',
  },
  {
    id: 'wordle_streak_7',
    name: 'Semana perfeita',
    description: 'Mantenha uma sequência de 7 dias acertando o Terminhos.',
    icon: '🔥',
    rarity: 'epic',
    rewardXp: 150,
    unlockedAt: null,
  },
];

describe('WordleAchievementsScreen', () => {
  it('renders an empty state when no achievements exist', () => {
    render(<WordleAchievementsScreen achievements={[]} onBack={() => {}} />);

    expect(screen.getByRole('heading', { name: /conquistas/i })).toBeTruthy();
    expect(
      screen.getByText(/nenhuma conquista disponível no momento/i),
    ).toBeTruthy();
  });

  it('renders unlocked and locked achievements with progress and XP rewards', () => {
    render(
      <WordleAchievementsScreen
        achievements={sampleAchievements}
        onBack={() => {}}
      />,
    );

    expect(screen.getByText('1 de 2 desbloqueadas')).toBeTruthy();
    expect(screen.getByText('Primeira palavra')).toBeTruthy();
    expect(screen.getByText('Semana perfeita')).toBeTruthy();
    expect(screen.getByText('+25 XP')).toBeTruthy();
    expect(screen.getByText('+150 XP')).toBeTruthy();
    expect(screen.getByText('Comum')).toBeTruthy();
    expect(screen.getByText('Épica')).toBeTruthy();
    expect(screen.getByText('Desbloqueada')).toBeTruthy();
    expect(screen.getByText('Bloqueada')).toBeTruthy();
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
