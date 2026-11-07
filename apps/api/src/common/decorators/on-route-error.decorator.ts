import { Reflector } from '@nestjs/core';

export const OnRouteError = Reflector.createDecorator<{
  event: string;
  message: string;
}>();
