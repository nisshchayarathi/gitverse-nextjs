import { TimeoutEstimatorService } from "../timeout-estimator";

describe("TimeoutEstimatorService", () => {
  let mockDateNow: jest.Mock;

  beforeEach(() => {
    mockDateNow = jest.fn(() => 1000000000000);
    jest.spyOn(Date, 'now').mockImplementation(mockDateNow);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should initialize with current time", () => {
    const service = new TimeoutEstimatorService();
    expect(service.getElapsedTimeMs()).toBe(0);
  });

  it("should track elapsed time correctly", () => {
    mockDateNow.mockReturnValueOnce(1000000000000);
    const service = new TimeoutEstimatorService();
    
    mockDateNow.mockReturnValueOnce(1000000005000);
    
    expect(service.getElapsedTimeMs()).toBe(5000);
  });

  it("should calculate remaining time correctly", () => {
    mockDateNow.mockReturnValueOnce(1000000000000);
    const service = new TimeoutEstimatorService();
    
    mockDateNow.mockReturnValueOnce(1000000060000);
    
    const remaining = service.getRemainingTimeMs();
    const maxDuration = 280000;
    expect(remaining).toBe(maxDuration - 60000);
  });

  it("should return 0 remaining time when exhausted", () => {
    mockDateNow.mockReturnValueOnce(1000000000000);
    const service = new TimeoutEstimatorService();
    
    mockDateNow.mockReturnValueOnce(1000000300000);
    
    expect(service.getRemainingTimeMs()).toBe(0);
  });

  it("should not return negative remaining time", () => {
    mockDateNow.mockReturnValueOnce(1000000000000);
    const service = new TimeoutEstimatorService();
    
    mockDateNow.mockReturnValueOnce(1000000500000);
    
    expect(service.getRemainingTimeMs()).toBe(0);
  });

  it("should detect time is not exhausted initially", () => {
    mockDateNow.mockReturnValueOnce(1000000000000);
    const service = new TimeoutEstimatorService();
    expect(service.isTimeExhausted()).toBe(false);
  });

  it("should detect time is exhausted when less than 45000ms remaining", () => {
    mockDateNow.mockReturnValueOnce(1000000000000);
    const service = new TimeoutEstimatorService();
    
    mockDateNow.mockReturnValueOnce(1000000230000);
    expect(service.isTimeExhausted()).toBe(false);
    
    mockDateNow.mockReturnValueOnce(1000000236000);
    expect(service.isTimeExhausted()).toBe(true);
  });

  it("should be exhausted at boundary condition", () => {
    mockDateNow.mockReturnValueOnce(1000000000000);
    const service = new TimeoutEstimatorService();
    
    mockDateNow.mockReturnValueOnce(1000000235001);
    
    expect(service.isTimeExhausted()).toBe(true);
  });
});
