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
    const message = new Message();
    message.id = lcMessage.id;
    message.content = lcMessage.text;
    message.name = lcMessage.name;
    return message;
  }

  private static mapAIMessage(lcMessage: any): AIMessage {
    const aiMessage = new AIMessage();
    Object.assign(aiMessage, this.mapBaseMessage(lcMessage));
    aiMessage.response_metadata = lcMessage.response_metadata;
    aiMessage.usage_metadata = lcMessage.usage_metadata;
    aiMessage.tool_calls = lcMessage.tool_calls.map((tc: any) => {
      const toolCall = new ToolCall();
      toolCall.name = tc.name;
      toolCall.args = tc.args;
      toolCall.id = tc.id;
      return toolCall;
    });
    aiMessage.invalid_tool_calls = lcMessage.invalid_tool_calls;
    aiMessage.type = MessageType.AI;
    return aiMessage;
  }

  private static mapToolMessage(lcMessage: any): ToolMessage {
    const toolMessage = new ToolMessage();
    Object.assign(toolMessage, this.mapBaseMessage(lcMessage));
    toolMessage.type = MessageType.TOOL;
    toolMessage.tool_call_id = lcMessage.tool_call_id;
    return toolMessage;
  }
}
