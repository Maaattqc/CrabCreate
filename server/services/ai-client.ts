import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import config from '../config';
import type { AIClient } from '../types';

export function getClient(model: string): AIClient {
  if (model === 'gpt') {
    return { type: 'openai', client: new OpenAI({ apiKey: config.openaiApiKey }) };
  }
  return { type: 'anthropic', client: new Anthropic({ apiKey: config.anthropicApiKey }) };
}
