// Get the appropriate API URL based on environment
const API_URL = import.meta.env.MODE === 'production' 
  ? import.meta.env.VITE_API_URL 
  : import.meta.env.VITE_API_DEV_URL

// Track session initialization to prevent duplicate calls
let sessionInitializationPromise: Promise<string> | null = null;

// Generic JSON-RPC 2.0 interface definitions
interface JsonRpcRequest<T = unknown> {
  id: string;
  jsonrpc: string;
  method: string;
  params: T;
}

interface JsonRpcResponse<T = unknown> {
  id: string;
  jsonrpc: string;
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

// Session management interfaces
interface InitSessionParams {
  userId: string;
  venueId: string;
}

interface InitSessionResult {
  sessionId: string;
}

// Message interfaces
interface SendMessageParams {
  sessionId: string;
  message: string;
}

interface SendMessageResult {
  answer?: string;
  response?: string;
  messageId?: string;
}

// Feedback interfaces
interface ProvideFeedbackParams {
  sessionId: string;
  messageId: string;
  rating: number;
  comment?: string;
}

interface ProvideFeedbackResult {
  success: boolean;
}

// Exported service interfaces
export interface SendChatMessageParams {
  message: string;
  venueId: string;
  sessionId?: string;
}

export interface ChatSession {
  sessionId: string;
  userId: string;
  venueId: string;
}

// Store the current session in memory (could be moved to localStorage for persistence)
let currentSession: ChatSession | null = null;

/**
 * Initialize a new chat session
 * @param userId The user ID
 * @param venueId The venue ID
 * @returns Promise with the session ID
 */
export async function initializeChatSession(userId: string, venueId: string): Promise<string> {
  // If we already have a session for this venue, return it immediately
  if (currentSession && currentSession.venueId === venueId) {
    console.log('Using existing session:', currentSession.sessionId);
    return currentSession.sessionId;
  }
  
  // If there's already a session initialization in progress, return that promise
  if (sessionInitializationPromise) {
    console.log('Session initialization already in progress, reusing promise');
    return sessionInitializationPromise;
  }
  
  // Create a new initialization promise
  try {
    sessionInitializationPromise = (async () => {
      console.log('Starting new session initialization for venue:', venueId);
      const request: JsonRpcRequest<InitSessionParams> = {
        id: Date.now().toString(),
        jsonrpc: "2.0",
        method: "chatbot.initializeSession",
        params: {
          userId,
          venueId
        }
      };

      const response = await fetch(`${API_URL}/api/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json() as JsonRpcResponse<InitSessionResult>;

      if (data.error) {
        throw new Error(data.error.message);
      }

      if (!data.result?.sessionId) {
        throw new Error('No session ID returned');
      }

      // Store the session
      currentSession = {
        sessionId: data.result.sessionId,
        userId,
        venueId
      };

      console.log('Session initialized successfully:', data.result.sessionId);
      return data.result.sessionId;
    })();
    
    // Handle completion of the promise
    sessionInitializationPromise
      .catch(error => {
        console.error('Session initialization failed:', error);
      })
      .finally(() => {
        // Clear the promise when done (success or failure)
        sessionInitializationPromise = null;
      });
    
    return await sessionInitializationPromise;
  } catch (error) {
    sessionInitializationPromise = null;
    console.error('Chat session initialization error:', error);
    throw error;
  }
}

/**
 * Get the current chat session or initialize a new one if needed
 * @param userId The user ID
 * @param venueId The venue ID
 * @returns Promise with the session ID
 */
export async function getOrCreateChatSession(userId: string, venueId: string): Promise<string> {
  if (currentSession && currentSession.venueId === venueId) {
    return currentSession.sessionId;
  }
  
  return initializeChatSession(userId, venueId);
}

/**
 * Sends a chat message to the MCP API
 * @param params Object containing the message, venueId, and optional sessionId
 * @returns Promise with the chat response string
 */
export async function sendChatMessage({ message, venueId, sessionId }: SendChatMessageParams): Promise<string> {
  try {
    // Ensure we have a session ID
    const currentSessionId = sessionId || (currentSession?.sessionId) || 
      // If no session exists, create one with a default user ID
      await initializeChatSession(`user-${Date.now()}`, venueId);
    
    // Create the JSONRPC request object for sending a message
    const request: JsonRpcRequest<SendMessageParams> = {
      id: Date.now().toString(),
      jsonrpc: "2.0",
      method: "chatbot.sendMessage",
      params: {
        sessionId: currentSessionId,
        message
      }
    };

    const response = await fetch(`${API_URL}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json() as JsonRpcResponse<SendMessageResult>;
    
    // Log the response for debugging
    console.log('Chat response received:', data);

    if (data.error) {
      throw new Error(data.error.message);
    }
    
    // Check for different possible response fields
    const responseText = data.result?.answer || data.result?.response || '';
    
    if (!responseText) {
      console.warn('No response text found in result:', data.result);
      return 'No se encontró una respuesta.';
    }
    
    return responseText;
  } catch (error) {
    console.error('Chat service error:', error);
    return 'Lo siento, ocurrió un error al procesar tu consulta.';
  }
}

/**
 * Provide feedback for a chat message
 * @param sessionId The session ID
 * @param messageId The message ID to provide feedback for
 * @param rating The rating (1-5)
 * @param comment Optional comment
 * @returns Promise with success status
 */
export async function provideChatFeedback(
  sessionId: string,
  messageId: string,
  rating: number,
  comment?: string
): Promise<boolean> {
  try {
    const request: JsonRpcRequest<ProvideFeedbackParams> = {
      id: Date.now().toString(),
      jsonrpc: "2.0",
      method: "chatbot.provideFeedback",
      params: {
        sessionId,
        messageId,
        rating,
        comment
      }
    };

    const response = await fetch(`${API_URL}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json() as JsonRpcResponse<ProvideFeedbackResult>;

    if (data.error) {
      throw new Error(data.error.message);
    }

    return data.result?.success || false;
  } catch (error) {
    console.error('Chat feedback error:', error);
    throw error;
  }
}
