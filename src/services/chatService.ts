interface ChatResponse {
  result?: {
    answer: string;
  };
  error?: {
    message: string;
  };
}

interface ChatRequest {
  id: string;
  jsonrpc: string;
  method: string;
  params: {
    question: string;
  };
}

export async function sendChatMessage(question: string): Promise<string> {
  try {
    const request: ChatRequest = {
      id: Date.now().toString(),
      jsonrpc: "2.0",
      method: "llm.queryDatabase",
      params: {
        question
      }
    };

    const response = await fetch('http://localhost:5000/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json() as ChatResponse;
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    return data.result?.answer || 'No se encontró una respuesta.';
  } catch (error) {
    console.error('Chat service error:', error);
    return 'Lo siento, ocurrió un error al procesar tu consulta.';
  }
}
