// Validation utilities

import { VALIDATION_CONFIG, NETWORK_FEES } from "../config/appConfig";
import { PublicKey } from "@solana/web3.js";

/**
 * Validate Solana wallet address
 * @param address - Wallet address to validate
 * @returns Validation result object
 */
export const validateSolanaAddress = (address: string) => {
  if (!address || address.trim() === "") {
    return {
      valid: false,
      error: "Wallet address is required",
    };
  }

  const trimmedAddress = address.trim();

  if (trimmedAddress.length < VALIDATION_CONFIG.SOLANA_ADDRESS.MIN_LENGTH || 
      trimmedAddress.length > VALIDATION_CONFIG.SOLANA_ADDRESS.MAX_LENGTH) {
    return {
      valid: false,
      error: `Wallet address must be between ${VALIDATION_CONFIG.SOLANA_ADDRESS.MIN_LENGTH} and ${VALIDATION_CONFIG.SOLANA_ADDRESS.MAX_LENGTH} characters`,
    };
  }

  if (!VALIDATION_CONFIG.SOLANA_ADDRESS.BASE58_REGEX.test(trimmedAddress)) {
    return {
      valid: false,
      error: "Wallet address contains invalid characters",
    };
  }

  try {
    new PublicKey(trimmedAddress);
  } catch (error) {
    return {
      valid: false,
      error: "Invalid Solana wallet address format",
    };
  }

  return {
    valid: true,
    error: null,
  };
};

/**
 * Validate SOL amount
 * @param amount - Amount to validate
 * @param balance - Current wallet balance
 * @returns Validation result object
 */
export const validateSolAmount = (amount: string, balance: number) => {
  if (!amount || amount.trim() === "") {
    return {
      valid: false,
      error: "Amount is required",
    };
  }

  const trimmedAmount = amount.trim();

  if (!/^\d*\.?\d+$/.test(trimmedAmount)) {
    return {
      valid: false,
      error: "Amount must be a valid number",
    };
  }

  const parsedAmount = parseFloat(trimmedAmount);

  if (isNaN(parsedAmount)) {
    return {
      valid: false,
      error: "Amount must be a valid number",
    };
  }

  if (parsedAmount <= 0) {
    return {
      valid: false,
      error: "Amount must be greater than 0",
    };
  }

  if (parsedAmount > NETWORK_FEES.MAX_AMOUNT) {
    return {
      valid: false,
      error: `Amount cannot exceed ${NETWORK_FEES.MAX_AMOUNT} SOL`,
    };
  }

  // Check if amount is within balance (including fee)
  const totalCost = parsedAmount + NETWORK_FEES.SOLANA;
  if (totalCost > balance) {
    return {
      valid: false,
      error: `Insufficient balance. Required: ${totalCost.toFixed(6)} SOL (including fee)`,
    };
  }

  return {
    valid: true,
    error: null,
  };
};

/**
 * Validate email address
 * @param email - Email to validate
 * @returns Validation result object
 */
export const validateEmail = (email: string) => {
  if (!email || email.trim() === "") {
    return {
      valid: false,
      error: "Email is required",
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return {
      valid: false,
      error: "Invalid email format",
    };
  }

  return {
    valid: true,
    error: null,
  };
};

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns Validation result object
 */
export const validatePassword = (password: string) => {
  if (!password) {
    return {
      valid: false,
      error: "Password is required",
    };
  }

  if (password.length < 8) {
    return {
      valid: false,
      error: "Password must be at least 8 characters",
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one uppercase letter",
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one lowercase letter",
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one number",
    };
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one special character",
    };
  }

  return {
    valid: true,
    error: null,
  };
};

/**
 * Validate form input for empty value
 * @param value - Value to validate
 * @param fieldName - Field name for error message
 * @returns Validation result object
 */
export const validateRequired = (value: string, fieldName: string) => {
  if (!value || value.trim() === "") {
    return {
      valid: false,
      error: `${fieldName} is required`,
    };
  }

  return {
    valid: true,
    error: null,
  };
};

/**
 * Validate URL format
 * @param url - URL to validate
 * @returns Validation result object
 */
export const validateUrl = (url: string) => {
  if (!url || url.trim() === "") {
    return {
      valid: false,
      error: "URL is required",
    };
  }

  try {
    new URL(url.trim());
  } catch (error) {
    return {
      valid: false,
      error: "Invalid URL format",
    };
  }

  return {
    valid: true,
    error: null,
  };
};

/**
 * Validate positive number
 * @param value - Value to validate
 * @param fieldName - Field name for error message
 * @returns Validation result object
 */
export const validatePositiveNumber = (value: string, fieldName: string) => {
  if (!value || value.trim() === "") {
    return {
      valid: false,
      error: `${fieldName} is required`,
    };
  }

  const parsedValue = parseFloat(value.trim());

  if (isNaN(parsedValue)) {
    return {
      valid: false,
      error: `${fieldName} must be a valid number`,
    };
  }

  if (parsedValue <= 0) {
    return {
      valid: false,
      error: `${fieldName} must be greater than 0`,
    };
  }

  return {
    valid: true,
    error: null,
  };
};
