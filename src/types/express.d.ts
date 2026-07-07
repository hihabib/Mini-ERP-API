// Global Express namespace augmentation — adds req.user to every request.
// Express's Request interface extends Express.Request, so changes here propagate.
declare namespace Express {
  interface Request {
    user?: {
      userId: string;
      roleId: string;
    };
  }
}
