import { readFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { join } from 'path';

const YAML_CONFIG_FILENAME =
  process.env.NODE_ENV === 'production'
    ? 'config.production.yaml'
    : 'config.development.yaml';

export const configBuilder = () => {
  return yaml.load(
    readFileSync(join(__dirname, '..', '..', YAML_CONFIG_FILENAME), 'utf8'),
  ) as Record<string, any>;
};
