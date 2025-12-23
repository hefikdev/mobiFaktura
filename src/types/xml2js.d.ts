declare module 'xml2js' {
  export function parseStringPromise(
    xml: string,
    options?: Record<string, any>
  ): Promise<any>;
  
  export namespace parseString {
    function _charStr(c: string): string;
  }
  
  export class Builder {
    constructor(options?: Record<string, any>);
    buildObject(obj: any): string;
  }
}
