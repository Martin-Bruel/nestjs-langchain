export class Message {
  id: string;
  name: string;
  content: string;
  type: MessageType;
  getLogString(): string {
    return `Message [ID: ${this.id}, Name: ${this.name}, Type: ${this.type}, Content: ${this.content}]`;
  }
  isFinished(): boolean {
    return false;
  }
}

export class HumanMessage extends Message {
  getLogString(): string {
    return `HumanMessage: ${this.content}`;
  }
  isFinished(): boolean {
    return false;
  }
}

export class AIMessage extends Message {
  response_metadata: ResponseMetadata;
  usage_metadata: UsageMetadata;
  tool_calls: ToolCall[];
  invalid_tool_calls: any[];
  getLogString(): string {
    if (this.response_metadata?.finish_reason === FinishReason.TOOL_CALLS) {
      return `AIMessage: Call tools: ${this.tool_calls
        .map((tc) => tc.toString())
        .join(', ')}`;
    }
    return `AIMessage: ${this.content}`;
  }
  isFinished(): boolean {
    return this.response_metadata?.finish_reason === FinishReason.STOP;
  }
}

export class ToolMessage extends Message {
  tool_call_id: string;
  getLogString(): string {
    return `ToolMessage call tool ${this.name} with args: ${this.content}`;
  }
}

export class ToolCall {
  name: string;
  args: any;
  id: string;
  toString(): string {
    return `${this.name} with args ${JSON.stringify(this.args)}`;
  }
}

export class ResponseMetadata {
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finish_reason: string;
  model_provider: string;
  model_name: string;
}

export enum FinishReason {
  STOP = 'stop',
  TOOL_CALLS = 'tool_calls',
  UNKNOWN = 'unknown',
}

export class UsageMetadata {
  output_tokens: number;
  input_tokens: number;
  total_tokens: number;
  input_token_details: any;
  output_token_details: any;
}

export enum MessageType {
  AI = 'ai',
  HUMAN = 'human',
  TOOL = 'tool',
}
