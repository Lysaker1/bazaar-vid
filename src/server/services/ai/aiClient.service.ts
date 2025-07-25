// src/server/services/ai/aiClient.service.ts

import 'openai/shims/node';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { ModelConfig, ModelProvider } from '~/config/models.config';
import { SYSTEM_PROMPTS } from '~/config/prompts.config';

type SystemPromptConfig = typeof SYSTEM_PROMPTS[keyof typeof SYSTEM_PROMPTS];

// =============================================================================
// AI CLIENT FACTORY
// =============================================================================

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
      detail?: 'low' | 'high' | 'auto';
    };
  }>;
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface AIClientOptions {
  responseFormat?: { type: "json_object" };
  debug?: boolean;
}

export class AIClientService {
  private static openaiClient: OpenAI | null = null;
  private static anthropicClient: Anthropic | null = null;

  // Initialize clients lazily
  private static getOpenAIClient(): OpenAI {
    if (!this.openaiClient) {
      this.openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    return this.openaiClient;
  }

  private static getAnthropicClient(): Anthropic {
    if (!this.anthropicClient) {
      this.anthropicClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
    return this.anthropicClient;
  }

  // =============================================================================
  // MAIN API METHOD
  // =============================================================================

  public static async generateResponse(
    config: ModelConfig,
    messages: AIMessage[],
    systemPrompt?: SystemPromptConfig,
    options?: AIClientOptions
  ): Promise<AIResponse> {
    // Add system prompt if provided
    const fullMessages = systemPrompt 
      ? [systemPrompt, ...messages.filter(m => m.role !== 'system')]
      : messages;

    switch (config.provider) {
      case 'openai':
        return this.callOpenAI(config, fullMessages, options);
      
      case 'anthropic':
        return this.callAnthropic(config, fullMessages, options);
      
      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
  }

  // =============================================================================
  // OPENAI IMPLEMENTATION
  // =============================================================================

  private static async callOpenAI(config: ModelConfig, messages: AIMessage[], options?: AIClientOptions): Promise<AIResponse> {
    const client = this.getOpenAIClient();
    
    try {
      // Log request details in debug mode
      if (options?.debug) {
        const requestSize = JSON.stringify(messages).length;
        console.log(`🔍 [AI CLIENT DEBUG] OpenAI Request:`, {
          model: config.model,
          messageCount: messages.length,
          requestSizeKB: (requestSize / 1024).toFixed(2),
          maxTokens: config.maxTokens,
          hasResponseFormat: !!options.responseFormat
        });
      }
      
      // Handle O1 models (different API structure)
      const isO1Model = config.model.includes('o1');
      
      if (isO1Model) {
        // O1 models don't support temperature and have different message structure
        const response = await client.chat.completions.create({
          model: config.model,
          messages: messages.map(msg => ({
            role: msg.role === 'system' ? 'user' : msg.role,
            content: msg.content
          })) as any,
          max_completion_tokens: config.maxTokens,
        });

        if (options?.debug) {
          const responseContent = response.choices[0]?.message?.content || '';
          console.log(`🔍 [AI CLIENT DEBUG] OpenAI O1 Response:`, {
            contentLength: responseContent.length,
            contentLengthKB: (responseContent.length / 1024).toFixed(2),
            finishReason: response.choices[0]?.finish_reason,
            usage: response.usage
          });
        }

        return {
          content: response.choices[0]?.message?.content || '',
          usage: {
            promptTokens: response.usage?.prompt_tokens,
            completionTokens: response.usage?.completion_tokens,
            totalTokens: response.usage?.total_tokens,
          }
        };
      } else {
        // Standard GPT models
        const response = await client.chat.completions.create({
          model: config.model,
          messages: messages as any,
          temperature: config.temperature ?? 0.7,
          max_tokens: config.maxTokens,
          ...(options?.responseFormat && { response_format: options.responseFormat }),
        });

        // Log response details in debug mode
        if (options?.debug) {
          const responseContent = response.choices[0]?.message?.content || '';
          console.log(`🔍 [AI CLIENT DEBUG] OpenAI Response:`, {
            contentLength: responseContent.length,
            contentLengthKB: (responseContent.length / 1024).toFixed(2),
            finishReason: response.choices[0]?.finish_reason,
            usage: response.usage,
            truncated: response.choices[0]?.finish_reason === 'length'
          });
          
          // Check if response was cut off due to max_tokens
          if (response.choices[0]?.finish_reason === 'length') {
            console.error(`🚨 [AI CLIENT DEBUG] Response hit max_tokens limit (${config.maxTokens})`);
          }
        }

        return {
          content: response.choices[0]?.message?.content || '',
          usage: {
            promptTokens: response.usage?.prompt_tokens,
            completionTokens: response.usage?.completion_tokens,
            totalTokens: response.usage?.total_tokens,
          }
        };
      }
    } catch (error) {
      console.error('OpenAI API Error:', error);
      throw new Error(`OpenAI API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================================================
  // ANTHROPIC IMPLEMENTATION
  // =============================================================================

  private static async callAnthropic(config: ModelConfig, messages: AIMessage[], options?: AIClientOptions): Promise<AIResponse> {
    const client = this.getAnthropicClient();
    
    try {
      // Anthropic has different message structure - system message is separate
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');

      // Handle messages - Claude Sonnet 4 supports vision
      const processedMessages = conversationMessages.map(msg => {
        if (typeof msg.content === 'string') {
          return {
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          };
        } else if (Array.isArray(msg.content)) {
          // Convert OpenAI format to Claude format for vision content
          const claudeContent = msg.content.map(item => {
            if (item.type === 'text') {
              return { type: 'text' as const, text: item.text || '' };
            } else if (item.type === 'image_url' && item.image_url?.url) {
              return {
                type: 'image' as const,
                source: {
                  type: 'url' as const,
                  url: item.image_url.url
                }
              };
            }
            return null;
          }).filter(Boolean);
          
          return {
            role: msg.role as 'user' | 'assistant',
            content: claudeContent.length > 0 ? claudeContent : ''
          };
        }
        return {
          role: msg.role as 'user' | 'assistant',
          content: String(msg.content)
        };
      });

      const response = await client.messages.create({
        model: config.model,
        system: typeof systemMessage?.content === 'string' ? systemMessage.content : undefined,
        messages: processedMessages as any,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 4096,
      });

      const content = response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('');

      // Debug logging for response size
      if (options?.debug) {
        console.log(`🔍 [AI CLIENT DEBUG] Anthropic Response:`, {
          contentLength: content.length,
          contentLengthKB: (content.length / 1024).toFixed(2),
          contentLengthMB: (content.length / 1024 / 1024).toFixed(3),
          usage: response.usage,
          truncated: content.length === 16384 || content.endsWith('...') || !this.looksComplete(content),
          lastChars: content.slice(-100)
        });
        
        // Check for 16KB truncation
        if (content.length === 16384) {
          console.error(`🚨 [AI CLIENT DEBUG] Response truncated at exactly 16KB!`);
        }
      }

      return {
        content,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        }
      };
    } catch (error: any) {
      console.error('Anthropic API Error:', error);
      
      // Handle 529 overload errors with retry suggestion
      if (error?.status === 529 || error?.error?.type === 'overloaded_error') {
        throw new Error('AI service is currently overloaded. Please try again in a moment.');
      }
      
      // Check for image download timeout specifically
      if (error?.error?.message?.includes('timed out while trying to download the file')) {
        throw new Error('Image download timeout - The AI couldn\'t fetch the uploaded image. Please try again in a moment.');
      }
      
      // Check for other timeout errors
      if (error?.error?.message?.includes('timeout') || error?.message?.includes('timeout')) {
        throw new Error('Request timeout - The AI service is temporarily slow. Please try again.');
      }
      
      throw new Error(`Anthropic API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================================================
  // VISION API SUPPORT
  // =============================================================================

  /**
   * Generate response with vision support (images + text)
   * Now supports both OpenAI and Claude vision models
   */
  public static async generateVisionResponse(
    config: ModelConfig,
    content: Array<{
      type: 'text' | 'image_url';
      text?: string;
      image_url?: {
        url: string;
        detail?: 'low' | 'high' | 'auto';
      };
    }>,
    systemPrompt?: string,
    options?: AIClientOptions
  ): Promise<AIResponse> {
    switch (config.provider) {
      case 'openai':
        return this.callOpenAIVision(config, content, systemPrompt, options);
      case 'anthropic':
        return this.callAnthropicVision(config, content, systemPrompt, options);
      default:
        throw new Error(`Vision API not supported for provider: ${config.provider}`);
    }
  }

  /**
   * OpenAI Vision API implementation
   */
  private static async callOpenAIVision(
    config: ModelConfig,
    content: Array<{
      type: 'text' | 'image_url';
      text?: string;
      image_url?: {
        url: string;
        detail?: 'low' | 'high' | 'auto';
      };
    }>,
    systemPrompt?: string,
    options?: AIClientOptions
  ): Promise<AIResponse> {
    const client = this.getOpenAIClient();
    
    try {
      const messages: any[] = [];
      
      // Add system message if provided
      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt
        });
      }
      
      // Add user message with vision content
      messages.push({
        role: 'user',
        content: content
      });

      const response = await client.chat.completions.create({
        model: config.model,
        messages: messages,
        temperature: config.temperature ?? 0.4,
        max_tokens: config.maxTokens ?? 4000,
        ...(options?.responseFormat && { response_format: options.responseFormat }),
      });

      return {
        content: response.choices[0]?.message?.content || '',
        usage: {
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
          totalTokens: response.usage?.total_tokens,
        }
      };
    } catch (error) {
      console.error('OpenAI Vision API Error:', error);
      throw new Error(`OpenAI Vision API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Claude Vision API implementation (NEW)
   * Claude 3.5 Haiku and Sonnet support vision
   */
  private static async callAnthropicVision(
    config: ModelConfig,
    content: Array<{
      type: 'text' | 'image_url';
      text?: string;
      image_url?: {
        url: string;
        detail?: 'low' | 'high' | 'auto';
      };
    }>,
    systemPrompt?: string,
    options?: AIClientOptions
  ): Promise<AIResponse> {
    const client = this.getAnthropicClient();
    
    try {
      // Convert OpenAI vision format to Claude format
      const claudeContent = content.map(item => {
        if (item.type === 'text') {
          return {
            type: 'text' as const,
            text: item.text || ''
          };
        } else if (item.type === 'image_url' && item.image_url?.url) {
          return {
            type: 'image' as const,
            source: {
              type: 'url' as const,
              url: item.image_url.url
            }
          };
        }
        return null;
      }).filter(Boolean);

      const response = await client.messages.create({
        model: config.model,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: claudeContent as any
        }],
        temperature: config.temperature ?? 0.4,
        max_tokens: config.maxTokens ?? 4000,
      });

      const responseContent = response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('');

      // Debug logging for response size
      if (options?.debug) {
        console.log(`🔍 [AI CLIENT DEBUG] Anthropic Vision Response:`, {
          contentLength: responseContent.length,
          contentLengthKB: (responseContent.length / 1024).toFixed(2),
          contentLengthMB: (responseContent.length / 1024 / 1024).toFixed(3),
          usage: response.usage,
          truncated: responseContent.length === 16384 || responseContent.endsWith('...') || !this.looksComplete(responseContent),
          lastChars: responseContent.slice(-100)
        });
        
        // Check for 16KB truncation
        if (responseContent.length === 16384) {
          console.error(`🚨 [AI CLIENT DEBUG] Vision response truncated at exactly 16KB!`);
        }
      }

      return {
        content: responseContent,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        }
      };
    } catch (error) {
      console.error('Claude Vision API Error:', error);
      throw new Error(`Claude Vision API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Helper method for image-to-code generation
   */
  public static async generateCodeFromImages(
    config: ModelConfig,
    imageUrls: string[],
    prompt: string,
    systemPrompt?: string
  ): Promise<AIResponse> {
    const content = [
      { type: 'text' as const, text: prompt },
      ...imageUrls.map(url => ({
        type: 'image_url' as const,
        image_url: {
          url,
          detail: 'high' as const
        }
      }))
    ];

    return this.generateVisionResponse(config, content, systemPrompt);
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private static looksComplete(content: string): boolean {
    // Check if response appears complete
    const trimmed = content.trim();
    // For JSON responses, check if it ends with a closing brace
    if (trimmed.startsWith('{')) {
      return trimmed.endsWith('}');
    }
    // For other responses, check common truncation patterns
    return !trimmed.endsWith('...') && !trimmed.endsWith('\\');
  }

  // =============================================================================
  // CONVENIENCE METHODS
  // =============================================================================

  public static async generateCompletion(
    config: ModelConfig,
    userPrompt: string,
    systemPrompt?: SystemPromptConfig
  ): Promise<string> {
    const messages: AIMessage[] = [
      { role: 'user', content: userPrompt }
    ];

    const response = await this.generateResponse(config, messages, systemPrompt);
    return response.content;
  }

  public static async generateWithContext(
    config: ModelConfig,
    userPrompt: string,
    context: string,
    systemPrompt?: SystemPromptConfig
  ): Promise<string> {
    const messages: AIMessage[] = [
      { role: 'user', content: context },
      { role: 'user', content: userPrompt }
    ];

    const response = await this.generateResponse(config, messages, systemPrompt);
    return response.content;
  }

  // =============================================================================
  // DEVELOPMENT HELPERS
  // =============================================================================

  public static logModelUsage(config: ModelConfig, usage?: AIResponse['usage']) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🤖 AI Call: ${config.provider}/${config.model}`);
      if (usage) {
        console.log(`📊 Tokens: ${usage.totalTokens} (${usage.promptTokens} + ${usage.completionTokens})`);
      }
    }
  }
}

// =============================================================================
// LEGACY COMPATIBILITY HELPERS
// =============================================================================

// Helper to create OpenAI-compatible client for existing code
export function createLegacyOpenAIClient(config: ModelConfig): {
  chat: {
    completions: {
      create: (params: any) => Promise<any>;
    };
  };
} {
  return {
    chat: {
      completions: {
        create: async (params: any) => {
          const messages: AIMessage[] = params.messages;
          const systemMessage = messages.find(m => m.role === 'system');
          const userMessages = messages.filter(m => m.role !== 'system');

          const response = await AIClientService.generateResponse(
            config,
            userMessages,
            systemMessage as SystemPromptConfig
          );

          // Return OpenAI-compatible format
          return {
            choices: [{
              message: {
                content: response.content
              }
            }],
            usage: {
              prompt_tokens: response.usage?.promptTokens,
              completion_tokens: response.usage?.completionTokens,
              total_tokens: response.usage?.totalTokens,
            }
          };
        }
      }
    }
  };
}
