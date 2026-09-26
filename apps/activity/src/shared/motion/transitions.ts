import { addTransitionType, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';

export type TransitionDirection = 'nav-forward' | 'nav-back';

export function transitionTo(
  direction: TransitionDirection,
  update: () => void,
): void {
  startTransition(() => {
    addTransitionType(direction);
    update();
  });
}

export function useNavigateHome(): () => void {
  const navigate = useNavigate();
  return () => transitionTo('nav-back', () => navigate('/'));
}

export function useNavigateForward(): (to: string) => void {
  const navigate = useNavigate();
  return (to) => transitionTo('nav-forward', () => navigate(to));
}

export function prefersReducedMotion(): boolean {
  return (
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  );
}
