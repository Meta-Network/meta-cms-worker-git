import {
  Inject,
  Injectable,
  LoggerService as NestLoggerService,
} from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class LoggerService implements NestLoggerService {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: NestLoggerService,
  ) {}

  protected context?: string;

  setContext(ctx: string): void {
    this.context = ctx;
  }

  /**
   * Write an 'error' level log.
   */
  error(message: string, stack?: string, context?: string): void;
  error(message: string, ...optionalParams: unknown[]): void;
  error(arg1: unknown, ...arg2: unknown[]): void {
    arg2 = this.context ? arg2.concat(this.context) : arg2;
    this.logger.error(arg1, ...arg2);
  }
  /**
   * Write a 'log' level log.
   */
  log(message: string, context?: string): void;
  log(message: string, ...optionalParams: unknown[]): void;
  log(arg1: unknown, ...arg2: unknown[]): void {
    arg2 = this.context ? arg2.concat(this.context) : arg2;
    this.logger.log(arg1, ...arg2);
  }
  /**
   * Write a 'warn' level log.
   */
  warn(message: string, context?: string): void;
  warn(message: string, ...optionalParams: unknown[]): void;
  warn(arg1: unknown, ...arg2: unknown[]): void {
    arg2 = this.context ? arg2.concat(this.context) : arg2;
    this.logger.warn(arg1, ...arg2);
  }
  /**
   * Write a 'debug' level log.
   */
  debug(message: string, context?: string): void;
  debug(message: string, ...optionalParams: unknown[]): void;
  debug(arg1: unknown, ...arg2: unknown[]): void {
    arg2 = this.context ? arg2.concat(this.context) : arg2;
    this.logger.debug(arg1, ...arg2);
  }
  /**
   * Write a 'verbose' level log.
   */
  verbose(message: string, context?: string): void;
  verbose(message: string, ...optionalParams: unknown[]): void;
  verbose(arg1: unknown, ...arg2: unknown[]): void {
    arg2 = this.context ? arg2.concat(this.context) : arg2;
    this.logger.verbose(arg1, ...arg2);
  }
}
