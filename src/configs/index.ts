import { ConfigService } from '@metaio/worker-common';
import dotenvFlow from 'dotenv-flow';
dotenvFlow.config();

export const config = new ConfigService();
