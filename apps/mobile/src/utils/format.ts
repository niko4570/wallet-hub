export const formatUsd = (value: number): string => {
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

export const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleString();
};

export const formatAmount = (amount: number, decimals: number = 4): string => {
  return amount.toFixed(decimals);
};

export const formatLargeNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};