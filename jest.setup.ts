import "@testing-library/jest-dom";

(global as any).Request = class Request {};

(global as any).Headers = class Headers {};

(global as any).Response = class Response {
  body: any;
  status: number;

  constructor(body?: any, init?: any) {
    this.body = body;
    this.status = init?.status || 200;
  }

  static json(data: any, init?: any) {
    return {
      json: async () => data,
      status: init?.status || 200,
    };
  }
};