import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Stub — expects req.user = { email, name } set by your JWT strategy.
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});