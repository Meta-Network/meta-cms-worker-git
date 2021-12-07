import { ConfigService } from '@metaio/worker-common';
import { config as dotEnvConfig } from 'dotenv-flow';
dotEnvConfig();

export const config = new ConfigService();
