import {
  Connection,
  ConnectionConfig,
  Transaction,
  VersionedTransaction,
  Signer,
  SendOptions,
} from "@solana/web3.js";

export interface SecureRpcConfig extends ConnectionConfig {
  apiKey?: string;
}

export class SecureConnection extends Connection {
  private apiKey?: string;

  constructor(endpoint: string, config?: SecureRpcConfig) {
    super(endpoint, config);
    this.apiKey = config?.apiKey;
  }

  async sendTransaction(
    transaction: Transaction,
    signers: Signer[],
    options?: SendOptions,
  ): Promise<string>;
  async sendTransaction(
    transaction: VersionedTransaction,
    options?: SendOptions,
  ): Promise<string>;
  async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    signersOrOptions?: Signer[] | SendOptions,
    options?: SendOptions,
  ): Promise<string> {
    if (this.apiKey) {
      if (signersOrOptions && Array.isArray(signersOrOptions)) {
        return this.sendAuthenticatedTransaction(
          transaction,
          signersOrOptions,
          options,
        );
      } else {
        return this.sendAuthenticatedTransaction(
          transaction,
          [],
          signersOrOptions as SendOptions | undefined,
        );
      }
    }

    if (transaction instanceof VersionedTransaction) {
      return super.sendTransaction(
        transaction,
        signersOrOptions as SendOptions,
      );
    }
    return super.sendTransaction(
      transaction,
      signersOrOptions as Signer[],
      options,
    );
  }

  async sendRawTransaction(
    rawTransaction: Uint8Array,
    options?: SendOptions,
  ): Promise<string> {
    if (this.apiKey) {
      return this.sendAuthenticatedRawTransaction(rawTransaction, options);
    }
    return super.sendRawTransaction(rawTransaction, options);
  }

  private async sendAuthenticatedTransaction(
    transaction: Transaction | VersionedTransaction,
    _signers: Signer[],
    options?: SendOptions,
  ): Promise<string> {
    const serialized = transaction.serialize();
    const signature = await this.sendAuthenticatedRawTransaction(
      serialized,
      options,
    );
    return signature;
  }

  private async sendAuthenticatedRawTransaction(
    rawTransaction: Uint8Array,
    _options?: SendOptions,
  ): Promise<string> {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "sendTransaction",
      params: [this.uint8ArrayToBase64(rawTransaction)],
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(this.rpcEndpoint, {
      method: "POST",
      body,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    if (json.error) {
      throw new Error(json.error.message);
    }
    return json.result;
  }

  async getBalance(publicKey: any, commitmentOrConfig?: any): Promise<number> {
    if (this.apiKey) {
      return this.getAuthenticatedBalance(publicKey, commitmentOrConfig);
    }
    return super.getBalance(publicKey, commitmentOrConfig);
  }

  private async getAuthenticatedBalance(
    publicKey: any,
    commitmentOrConfig?: any,
  ): Promise<number> {
    const commitment =
      typeof commitmentOrConfig === "string"
        ? commitmentOrConfig
        : commitmentOrConfig?.commitment || "confirmed";

    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [
        publicKey.toString(),
        {
          commitment,
        },
      ],
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(this.rpcEndpoint, {
      method: "POST",
      body,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    if (json.error) {
      throw new Error(json.error.message);
    }
    const result = json.result;
    if (typeof result === "number") {
      return result;
    }
    if (result && typeof result.value === "number") {
      return result.value;
    }
    throw new Error("Invalid getBalance response");
  }

  async getAccountInfo(publicKey: any, commitmentOrConfig?: any): Promise<any> {
    if (this.apiKey) {
      return this.getAuthenticatedAccountInfo(publicKey, commitmentOrConfig);
    }
    return super.getAccountInfo(publicKey, commitmentOrConfig);
  }

  private async getAuthenticatedAccountInfo(
    publicKey: any,
    commitmentOrConfig?: any,
  ): Promise<any> {
    const commitment =
      typeof commitmentOrConfig === "string"
        ? commitmentOrConfig
        : commitmentOrConfig?.commitment || "confirmed";

    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getAccountInfo",
      params: [
        publicKey.toString(),
        {
          commitment,
        },
      ],
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(this.rpcEndpoint, {
      method: "POST",
      body,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    if (json.error) {
      throw new Error(json.error.message);
    }
    return json.result;
  }

  async getLatestBlockhash(
    commitment?: any,
  ): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
    if (this.apiKey) {
      return this.getAuthenticatedLatestBlockhash(commitment);
    }
    return super.getLatestBlockhash(commitment);
  }

  private async getAuthenticatedLatestBlockhash(
    commitment?: any,
  ): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
    const commitmentValue = commitment || "confirmed";

    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getLatestBlockhash",
      params: [
        {
          commitment: commitmentValue,
        },
      ],
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(this.rpcEndpoint, {
      method: "POST",
      body,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    if (json.error) {
      throw new Error(json.error.message);
    }
    const payload = json?.result?.value ?? json?.result;

    if (
      !payload ||
      typeof payload.blockhash !== "string" ||
      typeof payload.lastValidBlockHeight !== "number"
    ) {
      throw new Error("Invalid getLatestBlockhash RPC response");
    }

    return {
      blockhash: payload.blockhash,
      lastValidBlockHeight: payload.lastValidBlockHeight,
    };
  }

  async getTransaction(
    signature: string,
    commitmentOrConfig?: any,
  ): Promise<any> {
    if (this.apiKey) {
      return this.getAuthenticatedTransaction(signature, commitmentOrConfig);
    }
    return super.getTransaction(signature, commitmentOrConfig);
  }

  private async getAuthenticatedTransaction(
    signature: string,
    commitmentOrConfig?: any,
  ): Promise<any> {
    const commitment =
      typeof commitmentOrConfig === "string"
        ? commitmentOrConfig
        : commitmentOrConfig?.commitment || "confirmed";

    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: [
        signature,
        {
          commitment,
        },
      ],
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(this.rpcEndpoint, {
      method: "POST",
      body,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    if (json.error) {
      throw new Error(json.error.message);
    }
    return json.result;
  }

  private uint8ArrayToBase64(uint8Array: Uint8Array): string {
    let binary = "";
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  }
}
