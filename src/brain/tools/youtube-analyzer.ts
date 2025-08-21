import { z } from 'zod';
import { GoogleVideoAnalyzer } from '~/server/services/ai/google-video-analyzer';
import { env } from '~/env';

export const youtubeAnalyzerSchema = z.object({
  youtubeUrl: z.string().url(),
  duration: z.number().default(10), // seconds
  additionalInstructions: z.string().optional(),
});

export type YouTubeAnalyzerInput = z.infer<typeof youtubeAnalyzerSchema>;

export interface YouTubeAnalyzerOutput {
  analysis: string;
  duration: number;
}

/**
 * Tool for analyzing YouTube videos with Gemini
 * To be called by Brain Orchestrator when it detects YouTube URLs
 */
export class YouTubeAnalyzerTool {
  private analyzer: GoogleVideoAnalyzer;

  constructor() {
    if (!env.GOOGLE_GEMINI_API_KEY) {
      throw new Error('Google Gemini API key not configured');
    }
    this.analyzer = new GoogleVideoAnalyzer(env.GOOGLE_GEMINI_API_KEY);
  }

  async execute(input: YouTubeAnalyzerInput): Promise<YouTubeAnalyzerOutput> {
    console.log('🎥 [YouTube Analyzer] Analyzing video:', input.youtubeUrl);
    console.log('🎥 [YouTube Analyzer] Duration:', input.duration, 'seconds');
    console.log('🎥 [YouTube Analyzer] Additional instructions:', input.additionalInstructions);

    try {
      // Use the simple description prompt - just describe what you see
      const { YOUTUBE_DESCRIPTION_PROMPT } = await import('~/config/prompts/active/youtube-description');
      
      // Add the specific duration request to the prompt
      const customPrompt = YOUTUBE_DESCRIPTION_PROMPT
        + `\n\nDESCRIBE THE FIRST ${input.duration} SECONDS OF THIS VIDEO.`
        + `\nFocus only on what happens in the first ${input.duration} seconds.`
        + (input.additionalInstructions ? `\n\n${input.additionalInstructions}` : '');

      console.log('🎥 [YouTube Analyzer] Calling GoogleVideoAnalyzer...');
      const analysis = await this.analyzer.analyzeYouTubeVideo(
        input.youtubeUrl,
        customPrompt
      );

      console.log('🎥 [YouTube Analyzer] Analysis received, length:', analysis.length);
      
      // Log full analysis in development for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log('🎥 [YouTube Analyzer] === FULL GEMINI ANALYSIS START ===');
        console.log(analysis);
        console.log('🎥 [YouTube Analyzer] === FULL GEMINI ANALYSIS END ===');
      } else {
        console.log('🎥 [YouTube Analyzer] First 500 chars:', analysis.substring(0, 500));
      }

      return {
        analysis,
        duration: input.duration,
      };
    } catch (error) {
      console.error('🎥 [YouTube Analyzer] ERROR:', error);
      throw new Error(`YouTube analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Helper function to extract YouTube URLs from text
export function extractYouTubeUrl(text: string): string | null {
  // Support various YouTube URL formats
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})(?:[&?][\w=]*)?/;
  const match = text.match(youtubeRegex);
  
  if (match) {
    const videoId = match[1];
    // Always return a full URL
    return `https://www.youtube.com/watch?v=${videoId}`;
  }
  
  return null;
}

// Helper function to extract duration from user message
export function extractDuration(text: string): number {
  // Look for various patterns
  const patterns = [
    /first\s+(\d+)\s+seconds?/i,           // "first 7 seconds"
    /(\d+)\s+seconds?\s+of/i,              // "7 seconds of"
    /analyze\s+(\d+)\s+seconds?/i,         // "analyze 10 seconds"
    /recreate\s+(\d+)\s+seconds?/i,        // "recreate 5 seconds"
    /make\s+.*?(\d+)\s+seconds?/i,         // "make the first 7 seconds"
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const seconds = parseInt(match[1], 10);
      // Reasonable limits
      if (seconds > 0 && seconds <= 60) {
        return seconds;
      }
    }
  }
  
  // Default to 10 seconds if not specified
  return 10;
}