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

// Helper functions for localStorage persistence
const getSessionStorageKey = (venueId: string) => `avoqado_chat_session_${venueId}`;

// Save session to localStorage
const saveSessionToStorage = (session: ChatSession): void => {
  if (!session || !session.venueId) return;
  localStorage.setItem(getSessionStorageKey(session.venueId), JSON.stringify(session));
  console.log('Chat session saved to localStorage:', session.sessionId);
};

// Retrieve session from localStorage
const getSessionFromStorage = (venueId: string): ChatSession | null => {
  if (!venueId) return null;
  try {
    const stored = localStorage.getItem(getSessionStorageKey(venueId));
    if (!stored) return null;
    const session = JSON.parse(stored) as ChatSession;
    console.log('Chat session retrieved from localStorage:', session.sessionId);
    return session;
  } catch (e) {
    console.error('Error parsing stored chat session:', e);
    return null;
  }
};

// Store the current session in memory and localStorage
let currentSession: ChatSession | null = null;

/**
 * Reset the current chat session
 * Use this when switching venues or when you need to start a fresh session
 * @param venueId Optional venueId to specifically clear that venue's session
 */
export function resetChatSession(venueId?: string): void {
  if (venueId) {
    // Clear specific venue session
    localStorage.removeItem(getSessionStorageKey(venueId));
    // Only reset current session if it's for this venue
    if (currentSession?.venueId === venueId) {
      currentSession = null;
    }
  } else if (currentSession?.venueId) {
    // Clear current session
    localStorage.removeItem(getSessionStorageKey(currentSession.venueId));
    currentSession = null;
  }
  
  sessionInitializationPromise = null;
  console.log('Chat session reset');
}

/**
 * Clears the chat history and session for a specific venue
 * Use this to explicitly let the user reset their conversation
 * @param venueId The venue ID to clear the chat history for
 * @returns Promise that resolves when the history is cleared
 */
export async function clearChatHistory(venueId: string): Promise<boolean> {
  try {
    // Clear local storage and session
    resetChatSession(venueId);
    
    // Could also send a request to the backend to clear any server-side history
    // For example:
    // await fetch(`${API_URL}/api/mcp`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     id: Date.now().toString(),
    //     jsonrpc: "2.0",
    //     method: "chatbot.clearHistory",
    //     params: { venueId }
    //   }),
    // });
    
    return true;
  } catch (error) {
    console.error('Failed to clear chat history:', error);
    return false;
  }
}

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
  
  // Check if we have a saved session in localStorage
  const savedSession = getSessionFromStorage(venueId);
  if (savedSession?.sessionId) {
    currentSession = savedSession;
    console.log('Using session from localStorage:', savedSession.sessionId);
    return savedSession.sessionId;
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
      
      // Save to localStorage for persistence
      saveSessionToStorage(currentSession);

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
/**
 * Checks if a session is valid by sending a simple ping request to the server
 * @param sessionId The session ID to check
 * @returns Promise that resolves to true if valid, false if not
 */
async function isSessionValid(sessionId: string): Promise<boolean> {
  try {
    // Simple ping request to check if session exists
    const pingRequest: JsonRpcRequest<{sessionId: string}> = {
      id: Date.now().toString(),
      jsonrpc: "2.0",
      method: "chatbot.pingSession", // Adjust method name based on your API
      params: {
        sessionId
      }
    };

    const response = await fetch(`${API_URL}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pingRequest),
    });

    if (!response.ok) return false;
    
    const data = await response.json();
    
    // If we get an error about session not found or invalid session
    if (data.error && (
      data.error.message?.toLowerCase().includes('session') || 
      data.error.message?.toLowerCase().includes('not found') ||
      data.error.code === 404 ||
      data.error.code === 400
    )) {
      console.warn('Session invalid or expired:', sessionId);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error checking session validity:', error);
    return false;
  }
}

export async function sendChatMessage({ message, venueId, sessionId }: SendChatMessageParams): Promise<string> {
  try {
    // Ensure we have a session ID
    let currentSessionId = sessionId || currentSession?.sessionId;
    
    // If we have a session ID, verify it's still valid after server restarts
    if (currentSessionId) {
      // This is a lightweight way to check if the session is still valid on the server
      const isValid = await isSessionValid(currentSessionId);
      
      if (!isValid) {
        console.log('Stored session is invalid, creating a new one');
        // Clear stored session
        resetChatSession(venueId);
        currentSessionId = null;
      }
    }
    
    // If no valid session exists, create one
    if (!currentSessionId) {
      currentSessionId = await initializeChatSession(`user-${Date.now()}`, venueId);
    }
    
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
      // Check if error is related to session not found
      if (data.error.message?.toLowerCase().includes('session') || 
          data.error.code === 404) {
        console.warn('Session error detected, trying with a new session');
        
        // Clear stored session and try again with a new session
        resetChatSession(venueId);
        
        // Recursive call with no session ID to force creation of a new one
        return sendChatMessage({ message, venueId });
      }
      
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
