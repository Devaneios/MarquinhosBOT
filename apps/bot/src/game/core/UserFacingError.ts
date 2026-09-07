export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
    Object.setPrototypeOf(this, UserFacingError.prototype);
  }
}
