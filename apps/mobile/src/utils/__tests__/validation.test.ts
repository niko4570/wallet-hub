import {
  validateSolanaAddress,
  validateSolAmount,
  validateEmail,
  validatePassword,
  validateRequired,
  validateUrl,
  validatePositiveNumber,
} from "../validation/validation";

// Mock the appConfig import
jest.mock("../../config/appConfig", () => ({
  VALIDATION_CONFIG: {
    SOLANA_ADDRESS: {
      MIN_LENGTH: 32,
      MAX_LENGTH: 44,
      BASE58_REGEX: /^[1-9A-HJ-NP-Z]+$/,
    },
    AMOUNT: {
      MIN: 0.000001,
      MAX: 100000,
    },
  },
  NETWORK_FEES: {
    SOLANA: 0.000005,
    MAX_AMOUNT: 100000,
  },
}));

describe("Validation utilities", () => {
  describe("validateSolanaAddress", () => {
    it("should return invalid for empty address", () => {
      const result = validateSolanaAddress("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Wallet address is required");
    });

    it("should return invalid for address that is too short", () => {
      const result = validateSolanaAddress("1234567890123456789012345678901"); // 31 characters
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Wallet address must be between");
    });

    it("should return invalid for address that is too long", () => {
      const result = validateSolanaAddress(
        "12345678901234567890123456789012345678901234",
      ); // 45 characters
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Wallet address must be between");
    });

    it("should return invalid for address with invalid characters", () => {
      const result = validateSolanaAddress(
        "123456789012345678901234567890123456789012340",
      ); // Contains '0' which is invalid
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Wallet address contains invalid characters");
    });

    it("should return valid for a valid Solana address", () => {
      // This is a test Solana address format (not a real one)
      const validAddress = "123456789012345678901234567890123456789012345";
      const result = validateSolanaAddress(validAddress);
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });
  });

  describe("validateSolAmount", () => {
    it("should return invalid for empty amount", () => {
      const result = validateSolAmount("", 10);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Amount is required");
    });

    it("should return invalid for non-numeric amount", () => {
      const result = validateSolAmount("abc", 10);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Amount must be a valid number");
    });

    it("should return invalid for zero amount", () => {
      const result = validateSolAmount("0", 10);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Amount must be greater than 0");
    });

    it("should return invalid for negative amount", () => {
      const result = validateSolAmount("-1", 10);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Amount must be a valid number");
    });

    it("should return invalid for amount exceeding maximum", () => {
      const result = validateSolAmount("100001", 200000);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Amount cannot exceed");
    });

    it("should return invalid for insufficient balance", () => {
      const result = validateSolAmount("10", 5); // Balance is 5, trying to send 10
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Insufficient balance");
    });

    it("should return valid for a valid amount within balance", () => {
      const result = validateSolAmount("5", 10); // Balance is 10, sending 5
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });
  });

  describe("validateEmail", () => {
    it("should return invalid for empty email", () => {
      const result = validateEmail("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Email is required");
    });

    it("should return invalid for invalid email format", () => {
      const result = validateEmail("invalid-email");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid email format");
    });

    it("should return valid for a valid email format", () => {
      const result = validateEmail("test@example.com");
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });
  });

  describe("validatePassword", () => {
    it("should return invalid for empty password", () => {
      const result = validatePassword("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Password is required");
    });

    it("should return invalid for password that is too short", () => {
      const result = validatePassword("Pass123"); // Only 7 characters
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Password must be at least 8 characters");
    });

    it("should return invalid for password without uppercase letter", () => {
      const result = validatePassword("password123!");
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Password must contain at least one uppercase letter",
      );
    });

    it("should return invalid for password without lowercase letter", () => {
      const result = validatePassword("PASSWORD123!");
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Password must contain at least one lowercase letter",
      );
    });

    it("should return invalid for password without number", () => {
      const result = validatePassword("Password!");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Password must contain at least one number");
    });

    it("should return invalid for password without special character", () => {
      const result = validatePassword("Password123");
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Password must contain at least one special character",
      );
    });

    it("should return valid for a strong password", () => {
      const result = validatePassword("Password123!");
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });
  });

  describe("validateRequired", () => {
    it("should return invalid for empty value", () => {
      const result = validateRequired("", "Field");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Field is required");
    });

    it("should return invalid for whitespace-only value", () => {
      const result = validateRequired("   ", "Field");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Field is required");
    });

    it("should return valid for non-empty value", () => {
      const result = validateRequired("value", "Field");
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });
  });

  describe("validateUrl", () => {
    it("should return invalid for empty URL", () => {
      const result = validateUrl("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("URL is required");
    });

    it("should return invalid for invalid URL format", () => {
      const result = validateUrl("invalid-url");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid URL format");
    });

    it("should return valid for a valid URL", () => {
      const result = validateUrl("https://example.com");
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });
  });

  describe("validatePositiveNumber", () => {
    it("should return invalid for empty value", () => {
      const result = validatePositiveNumber("", "Value");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Value is required");
    });

    it("should return invalid for non-numeric value", () => {
      const result = validatePositiveNumber("abc", "Value");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Value must be a valid number");
    });

    it("should return invalid for zero value", () => {
      const result = validatePositiveNumber("0", "Value");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Value must be greater than 0");
    });

    it("should return invalid for negative value", () => {
      const result = validatePositiveNumber("-1", "Value");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Value must be greater than 0");
    });

    it("should return valid for a positive number", () => {
      const result = validatePositiveNumber("10", "Value");
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });
  });
});
