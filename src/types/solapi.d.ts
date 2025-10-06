declare module 'solapi' {
  export class SolapiMessageService {
    constructor(apiKey: string, apiSecret: string);
    sendOne(args: { to: string; from: string; text: string }): Promise<any>;
  }
}
