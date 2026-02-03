export class Message {
  id: string;
  name: string;
  content: string;
  type: MessageType;

  constructor(id: string, name: string, content: string, type: MessageType) {
    this.id = id;
    this.name = name;
    this.content = content;
    this.type = type;
  }

  getLogString(): string {
    return `Message [ID: ${this.id}, Name: ${this.name}, Type: ${this.type}, Content: ${this.content}]`;
  }
  isFinished(): boolean {
    return false;
  }
}

export class HumanMessage extends Message {
  constructor(id: string, name: string, content: string) {
    super(id, name, content, MessageType.HUMAN);
  }
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

  constructor(
    id: string,
    name: string,
    content: string,
    response_metadata: ResponseMetadata,
    usage_metadata: UsageMetadata,
    tool_calls: ToolCall[],
    invalid_tool_calls: any[],
  ) {
    super(id, name, content, MessageType.AI);
    this.response_metadata = response_metadata;
    this.usage_metadata = usage_metadata;
    this.tool_calls = tool_calls;
    this.invalid_tool_calls = invalid_tool_calls;
  }

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
  constructor(id: string, name: string, content: string, tool_call_id: string) {
    super(id, name, content, MessageType.TOOL);
    this.tool_call_id = tool_call_id;
  }
  tool_call_id: string;
  getLogString(): string {
    return `ToolMessage call tool ${this.name} with args: ${this.content}`;
  }
}

export class ToolCall {
  name: string;
  args: any;
  id: string;

  constructor(id: string, name: string, args: any) {
    this.name = name;
    this.args = args;
    this.id = id;
  }
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

  constructor(
    tokenUsage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    },
    finish_reason: string,
    model_provider: string,
    model_name: string,
  ) {
    this.tokenUsage = tokenUsage;
    this.finish_reason = finish_reason;
    this.model_provider = model_provider;
    this.model_name = model_name;
  }
}

export enum FinishReason {
  STOP = 'stop',
  TOOL_CALLS = 'tool_calls',
  UNKNOWN = 'unknown',
}

export class UsageMetadata {
  constructor(
    output_tokens: number,
    input_tokens: number,
    total_tokens: number,
    input_token_details: any,
    output_token_details: any,
  ) {
    this.output_tokens = output_tokens;
    this.input_tokens = input_tokens;
    this.total_tokens = total_tokens;
    this.input_token_details = input_token_details;
    this.output_token_details = output_token_details;
  }

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
  UNKNOWN = 'unknown',
}
