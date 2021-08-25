import fs from 'fs';
import get from 'lodash.get';
import has from 'lodash.has';
import set from 'lodash.set';
import path from 'path';
import yaml from 'yaml';

import { NoInferType, Path, PathValue } from '../types/config';
import { isProd, isUndefined } from '../utils';

const YAML_CONFIG_FILENAME = isProd() ? 'config.prod.yaml' : 'config.dev.yaml';

const openConfigFile = (): Record<string, unknown> => {
  try {
    const configFile = path.join(__dirname, '..', '..', YAML_CONFIG_FILENAME);
    fs.accessSync(configFile, fs.constants.R_OK);
    const configData = fs.readFileSync(configFile, 'utf8');
    return yaml.parse(configData);
  } catch (error) {
    return {};
  }
};

const readProcessEnv = (): Record<string, unknown> => {
  try {
    const config = process.env.WORKER_CONFIGS;
    if (config) {
      const data = Buffer.from(config, 'base64').toString();
      return yaml.parse(data);
    }
  } catch (error) {
    return {};
  }
};

const configBuilder = (): Record<string, unknown> => {
  const file = openConfigFile();
  const env = readProcessEnv();
  return { ...file, ...env };
};

interface ConfigGetOptions {
  /**
   * If present, "get" method will try to automatically
   * infer a type of property based on the type argument
   * specified at the "ConfigService" class-level (example: ConfigService<Configuration>).
   */
  infer: true;
}

class ConfigService<K = Record<string, unknown>> {
  constructor(private readonly internalConfig: Record<string, unknown> = {}) {}

  private set isCacheEnabled(value: boolean) {
    this._isCacheEnabled = value;
  }

  private get isCacheEnabled(): boolean {
    return this._isCacheEnabled;
  }

  private readonly cache: Partial<K> = {} as any;
  private _isCacheEnabled = false;

  /**
   * Get a configuration value (either custom configuration or process environment variable)
   * based on property path (you can use dot notation to traverse nested object, e.g. "database.host").
   * @param propertyPath
   */
  get<T = any>(propertyPath: keyof K): T | undefined;
  /**
   * Get a configuration value (either custom configuration or process environment variable)
   * based on property path (you can use dot notation to traverse nested object, e.g. "database.host").
   * @param propertyPath
   * @param options
   */
  get<T = K, P extends Path<T> = any, R = PathValue<T, P>>(
    propertyPath: P,
    options: ConfigGetOptions,
  ): R | undefined;
  /**
   * Get a configuration value (either custom configuration or process environment variable)
   * based on property path (you can use dot notation to traverse nested object, e.g. "database.host").
   * It returns a default value if the key does not exist.
   * @param propertyPath
   * @param defaultValue
   */
  get<T = any>(propertyPath: keyof K, defaultValue: NoInferType<T>): T;
  /**
   * Get a configuration value (either custom configuration or process environment variable)
   * based on property path (you can use dot notation to traverse nested object, e.g. "database.host").
   * It returns a default value if the key does not exist.
   * @param propertyPath
   * @param defaultValue
   * @param options
   */
  get<T = K, P extends Path<T> = any, R = PathValue<T, P>>(
    propertyPath: P,
    defaultValue: NoInferType<R>,
    options: ConfigGetOptions,
  ): R;
  /**
   * Get a configuration value (either custom configuration or process environment variable)
   * based on property path (you can use dot notation to traverse nested object, e.g. "database.host").
   * It returns a default value if the key does not exist.
   * @param propertyPath
   * @param defaultValueOrOptions
   */
  get<T = unknown>(
    propertyPath: keyof K,
    defaultValueOrOptions?: T | ConfigGetOptions,
    options?: ConfigGetOptions,
  ): T | undefined {
    const defaultValue =
      this.isGetOptionsObject(defaultValueOrOptions) && !options
        ? undefined
        : defaultValueOrOptions;

    const processEnvValue = this.getFromProcessEnv<T>(
      propertyPath,
      defaultValue,
    );
    if (!isUndefined(processEnvValue)) {
      return processEnvValue;
    }

    const internalValue = this.getFromInternalConfig<T>(propertyPath);
    if (!isUndefined(internalValue)) {
      return internalValue;
    }

    return defaultValue as T;
  }

  private getFromCache<T = unknown>(
    propertyPath: keyof K,
    defaultValue?: T,
  ): T | undefined {
    const cachedValue = get(this.cache, propertyPath);
    return isUndefined(cachedValue)
      ? defaultValue
      : (cachedValue as unknown as T);
  }

  private getFromProcessEnv<T = unknown>(
    propertyPath: keyof K,
    defaultValue: any,
  ): T | undefined {
    if (
      this.isCacheEnabled &&
      has(this.cache as Record<string, unknown>, propertyPath)
    ) {
      const cachedValue = this.getFromCache(propertyPath, defaultValue);
      return !isUndefined(cachedValue) ? cachedValue : defaultValue;
    }
    const processValue = get(process.env, propertyPath);
    this.setInCacheIfDefined(propertyPath, processValue);

    return processValue as unknown as T;
  }

  private getFromInternalConfig<T = unknown>(
    propertyPath: keyof K,
  ): T | undefined {
    const internalValue = get(this.internalConfig, propertyPath);
    return internalValue;
  }

  private setInCacheIfDefined(propertyPath: keyof K, value: unknown): void {
    if (typeof value === 'undefined') {
      return;
    }
    set(this.cache as Record<any, any>, propertyPath, value);
  }

  private isGetOptionsObject(
    options: Record<string, any> | undefined,
  ): options is ConfigGetOptions {
    return options && options?.infer && Object.keys(options).length === 1;
  }
}

export const config = new ConfigService(configBuilder());
