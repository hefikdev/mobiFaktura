declare module 'xml2js' {
  export function parseStringPromise(
    xml: string,
    options?: Record<string, unknown>
  ): Promise<unknown>;
  
  export namespace parseString {
    function _charStr(c: string): string;
  }
  
  export class Builder {
    constructor(options?: Record<string, unknown>);
    buildObject(obj: unknown): string;
  }
}
