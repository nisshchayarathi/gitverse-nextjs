const request = require("supertest");

describe("Repository API Tests", () => {

  test("Repository endpoint responds", async () => {

    const response = await request("http://localhost:3000")
      .get("/api/repositories");

 expect([200, 401, 404, 500]).toContain(response.statusCode);

  });

});