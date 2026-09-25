import { useOutletContext } from 'react-router-dom';
import type { PongMenuScreenContext } from './PongMenuFlow';

export function usePongMenuContext() {
  return useOutletContext<PongMenuScreenContext>();
}
