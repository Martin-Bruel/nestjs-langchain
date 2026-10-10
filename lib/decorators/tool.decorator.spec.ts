import { ToolParam } from './tool.decorator.js';

describe('ToolParam', () => {
  it('refuses a constructor parameter', () => {
    expect(() => {
      class Service {
        constructor(@ToolParam({ name: 'x' }) readonly x: string) {}
      }
      return Service;
    }).toThrow('@ToolParam can only be used on method parameters.');
  });
});
