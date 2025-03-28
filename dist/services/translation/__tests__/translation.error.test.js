"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
jest.mock("../ai-adapters/ai-service.factory");
describe("TranslationService Error Handling", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it("should handle translation errors", async () => {
        const errorAdapter = {
            translateText: jest.fn().mockRejectedValue(new Error("Translation failed")),
        };
    });
});
