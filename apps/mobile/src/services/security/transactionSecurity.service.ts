import { Transaction, VersionedTransaction } from "@solana/web3.js";

export interface TransactionPreview {
  signature?: string;
  type: "transfer" | "swap" | "stake" | "custom";
  from: string;
  to: string;
  amount: number;
  amountInSol?: number;
  token?: string;
  fee: number;
  feeInSol?: number;
  timestamp?: number;
  blockhash?: string;
  instructions: TransactionInstruction[];
  raw?: Transaction | VersionedTransaction;
}

export interface TransactionInstruction {
  programId: string;
  programName?: string;
  type: string;
  data?: string;
  accounts: string[];
  description?: string;
}

export interface TransactionValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class TransactionSecurityService {
  private static instance: TransactionSecurityService;
  private maxAmountPerTransaction = 100000;
  private maxDailyAmount = 1000000;
  private dailyTransactions: Map<string, number[]> = new Map();

  private constructor() {}

  static getInstance(): TransactionSecurityService {
    if (!TransactionSecurityService.instance) {
      TransactionSecurityService.instance = new TransactionSecurityService();
    }
    return TransactionSecurityService.instance;
  }

  async previewTransaction(
    transaction: Transaction | VersionedTransaction,
  ): Promise<TransactionPreview> {
    const isVersioned = transaction instanceof VersionedTransaction;
    const tx = isVersioned
      ? (transaction as VersionedTransaction)
      : (transaction as Transaction);

    const signature = isVersioned
      ? undefined
      : (tx as Transaction).signature?.toString();
    const blockhash = isVersioned
      ? undefined
      : (tx as Transaction).recentBlockhash;
    const feePayer = isVersioned
      ? ""
      : (tx as Transaction).feePayer?.toString() || "";

    const instructions = this.parseInstructions(tx);
    const transferInstruction = this.findTransferInstruction(instructions);

    const fee = await this.estimateFee(tx);

    let preview: TransactionPreview = {
      signature,
      type: transferInstruction ? "transfer" : "custom",
      from: feePayer,
      to: transferInstruction?.to || "",
      amount: transferInstruction?.amount || 0,
      fee,
      feeInSol: fee / 1e9,
      timestamp: Date.now(),
      blockhash,
      instructions,
      raw: transaction,
    };

    if (transferInstruction?.token) {
      preview.token = transferInstruction.token;
    }

    return preview;
  }

  validateTransaction(
    preview: TransactionPreview,
  ): TransactionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!preview.from) {
      errors.push("Missing sender address");
    }

    if (!preview.to) {
      errors.push("Missing recipient address");
    }

    if (preview.from === preview.to) {
      errors.push("Cannot send to the same address");
    }

    if (preview.amount <= 0) {
      errors.push("Amount must be greater than zero");
    }

    if (preview.amount > this.maxAmountPerTransaction) {
      errors.push(
        `Amount exceeds maximum allowed value of ${this.maxAmountPerTransaction} SOL`,
      );
    }

    const today = new Date().toDateString();
    const dailyAmounts = this.dailyTransactions.get(today) || [];
    const dailyTotal = dailyAmounts.reduce((sum, amount) => sum + amount, 0);

    if (dailyTotal + preview.amount > this.maxDailyAmount) {
      warnings.push(
        `This transaction will exceed your daily limit of ${this.maxDailyAmount} SOL`,
      );
    }

    if (preview.fee > 10000000) {
      warnings.push("Transaction fee seems unusually high");
    }

    if (preview.instructions.length === 0) {
      errors.push("Transaction has no instructions");
    }

    const suspiciousInstructions = this.detectSuspiciousInstructions(
      preview.instructions,
    );
    if (suspiciousInstructions.length > 0) {
      warnings.push(
        `Suspicious instructions detected: ${suspiciousInstructions.join(", ")}`,
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  recordTransaction(preview: TransactionPreview): void {
    const today = new Date().toDateString();
    const dailyAmounts = this.dailyTransactions.get(today) || [];
    dailyAmounts.push(preview.amount);
    this.dailyTransactions.set(today, dailyAmounts);
  }

  private parseInstructions(
    transaction: Transaction | VersionedTransaction,
  ): TransactionInstruction[] {
    if (transaction instanceof VersionedTransaction) {
      return [];
    }

    const tx = transaction as Transaction;
    return tx.instructions.map((instruction) => {
      const programId = instruction.programId.toString();
      const accounts = instruction.keys.map((key) => key.pubkey.toString());

      return {
        programId,
        programName: this.getProgramName(programId),
        type: this.getInstructionType(programId),
        data: instruction.data?.toString("base64"),
        accounts,
        description: this.getInstructionDescription(programId),
      };
    });
  }

  private findTransferInstruction(
    instructions: TransactionInstruction[],
  ): { to: string; amount: number; token?: string } | null {
    const systemProgram = "11111111111111111111111111111111";
    const transfer = instructions.find(
      (inst) => inst.programId === systemProgram && inst.type === "transfer",
    );

    if (!transfer) {
      return null;
    }

    const amount = this.parseTransferAmount(transfer.data);
    const to = transfer.accounts[1] || "";

    return { to, amount };
  }

  private parseTransferAmount(data?: string): number {
    if (!data) return 0;

    try {
      const binaryString = atob(data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      if (bytes.length >= 12) {
        const amountBytes = bytes.slice(4, 12);
        let amount = 0;
        for (let i = 0; i < amountBytes.length; i++) {
          amount += amountBytes[i] * Math.pow(256, i);
        }
        return amount;
      }
    } catch (error) {
      console.error("Failed to parse transfer amount:", error);
    }

    return 0;
  }

  private getProgramName(programId: string): string {
    const programNames: Record<string, string> = {
      "11111111111111111111111111111111": "System Program",
      TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: "Token Program",
      TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: "Token-2022 Program",
      ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: "Associated Token Program",
    };

    return programNames[programId] || "Unknown Program";
  }

  private getInstructionType(programId: string): string {
    const systemProgram = "11111111111111111111111111111111";
    const tokenProgram = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

    if (programId === systemProgram) {
      return "transfer";
    } else if (programId === tokenProgram) {
      return "token_transfer";
    }

    return "custom";
  }

  private getInstructionDescription(programId: string): string {
    const descriptions: Record<string, string> = {
      "11111111111111111111111111111111": "SOL Transfer",
      TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: "Token Transfer",
      TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: "Token-2022 Transfer",
      ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL:
        "Associated Token Account Operation",
    };

    return descriptions[programId] || "Custom Instruction";
  }

  private detectSuspiciousInstructions(
    instructions: TransactionInstruction[],
  ): string[] {
    const suspicious: string[] = [];

    const unknownPrograms = instructions.filter(
      (inst) => !this.getProgramName(inst.programId).includes("Program"),
    );

    if (unknownPrograms.length > 0) {
      suspicious.push("Unknown programs");
    }

    const largeDataInstructions = instructions.filter(
      (inst) => inst.data && inst.data.length > 1000,
    );

    if (largeDataInstructions.length > 0) {
      suspicious.push("Large instruction data");
    }

    return suspicious;
  }

  private async estimateFee(
    transaction: Transaction | VersionedTransaction,
  ): Promise<number> {
    try {
      return 5000;
    } catch (error) {
      console.error("Failed to estimate fee:", error);
      return 5000;
    }
  }

  clearDailyTransactions(): void {
    this.dailyTransactions.clear();
  }

  getDailyTransactionsCount(): number {
    const today = new Date().toDateString();
    return this.dailyTransactions.get(today)?.length || 0;
  }

  getDailyTotalAmount(): number {
    const today = new Date().toDateString();
    const dailyAmounts = this.dailyTransactions.get(today) || [];
    return dailyAmounts.reduce((sum, amount) => sum + amount, 0);
  }
}

export const transactionSecurityService =
  TransactionSecurityService.getInstance();
