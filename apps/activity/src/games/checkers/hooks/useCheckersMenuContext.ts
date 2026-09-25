import { useOutletContext } from 'react-router-dom';
import type { CheckersMenuOutletContext } from './CheckersMenuFlow';

export function useCheckersMenuContext() {
  return useOutletContext<CheckersMenuOutletContext>();
}
