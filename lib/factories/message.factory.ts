import {
  AIMessage,
  Message,
  MessageType,
  ToolCall,
  ToolMessage,
} from '../types/message';

export class MessageFactory {
  static fromLangChain(lcMessage: any): Message | AIMessage | ToolMessage {
    if (lcMessage.name === 'model') {
      return this.mapAIMessage(lcMessage);
    } else if (lcMessage.tool_call_id) {
      return this.mapToolMessage(lcMessage);
    }
    return this.mapBaseMessage(lcMessage);
  }

  private static mapBaseMessage(lcMessage: any): Message {
    const message = new Message(
      lcMessage.id,
      lcMessage.name,
      lcMessage.content,
      MessageType.UNKNOWN,
    );
    return message;
  }

  private static mapAIMessage(lcMessage: any): AIMessage {
    return new AIMessage(
      lcMessage.id,
      lcMessage.name,
      lcMessage.content,
      lcMessage.response_metadata,
      lcMessage.usage_metadata,
      lcMessage.tool_calls.map((tc: any) => {
        return new ToolCall(tc.id, tc.name, tc.args);
      }),
      lcMessage.invalid_tool_calls,
    );
  }

  private static mapToolMessage(lcMessage: any): ToolMessage {
    return new ToolMessage(
      lcMessage.id,
      lcMessage.name,
      lcMessage.content,
      lcMessage.tool_call_id,
    );
  }
}
