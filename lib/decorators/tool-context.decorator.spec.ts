import { ToolContext, readContextParams } from './tool-context.decorator.js';

describe('ToolContext', () => {
  it('records the position of each parameter it marks', () => {
    class Orders {
      list(
        _status: string,
        @ToolContext() _ctx: unknown,
        @ToolContext() _again: unknown,
      ): void {}
    }

    expect(
      readContextParams(Orders.prototype, 'list').sort((a, b) => a - b),
    ).toEqual([1, 2]);
  });

  it('refuses a constructor parameter', () => {
    expect(() => {
      class Orders {
        constructor(@ToolContext() readonly ctx: unknown) {}
      }
      return Orders;
    }).toThrow('@ToolContext can only be used on method parameters.');
  });
});
