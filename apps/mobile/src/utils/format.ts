export const formatUsd = (value?: number | null): string => {
  if (value === undefined || value === null) {
    return "$0.00";
  }
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatAddress = (address?: string | null): string => {
  if (!address) {
    return "Not Connected";
  }
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

export const formatSignature = (signature: string): string => {
  return `${signature.slice(0, 6)}...${signature.slice(-4)}`;
};

export const formatDate = (date?: string | Date | null): string => {
  if (!date) {
    return "N/A";
  }
  return new Date(date).toLocaleString();
};

export const formatAmount = (amount: number, decimals: number = 4): string => {
  if (amount === undefined || amount === null) {
    return "0";
  }
  return amount.toFixed(decimals);
};

export const formatLargeNumber = (num: number): string => {
  if (num === undefined || num === null) {
    return "0";
  }
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};

/**
 * Formats a numerical value as a percentage change string
 * @param value - Numerical value to format
 * @returns Formatted percentage string in the format "+X.XX%", "-X.XX%", or "0.00%"
 */
export const formatPercentChange = (value: number): string => {
  // Handle null, undefined, NaN, and non-finite values
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
    return "0.00%";
  }

  // Determine if the value is positive
  const isPositive = value > 0;
  
  // Round to exactly 2 decimal places
  const roundedValue = Math.round(Math.abs(value) * 100) / 100;
  
  // Format with consistent 2 decimal places
  const formattedValue = roundedValue.toFixed(2);
  
  // Return with appropriate sign
  if (isPositive) {
    return `+${formattedValue}%`;
  } else if (value < 0) {
    return `-${formattedValue}%`;
  } else {
    return "0.00%";
  }
};
