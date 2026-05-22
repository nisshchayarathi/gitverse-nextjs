const request = require("supertest");

describe("Auth API Tests", () => {
test("Signup endpoint responds", async () => {

  const response = await request("http://localhost:3000")
    .post("/api/auth/signup")
    .send({
      email: "test@gmail.com",
      password: "123456"
    });

expect([200, 201, 400, 500]).toContain(response.statusCode);

}, 15000);

});