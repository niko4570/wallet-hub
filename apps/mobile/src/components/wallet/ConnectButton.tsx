import React, { useState, useCallback } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSolana } from '../../context/SolanaContext';
import { useWalletStore } from '../../store/walletStore';
import * as Haptics from 'expo-haptics';

interface ConnectButtonProps {
  onConnect?: (wallets: any[]) => void;
  onError?: (error: Error) => void;
  testID?: string;
}

export const ConnectButton: React.FC<ConnectButtonProps> = ({
  onConnect,
  onError,
  testID = 'connect-wallet-button',
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { startAuthorization, finalizeAuthorization, refreshBalance } = useSolana();
  const walletStore = useWalletStore();
  const { linkedWallets } = walletStore;

  const handleConnect = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    walletStore.setError(null);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const preview = await startAuthorization();
      const accounts = await finalizeAuthorization(preview);
      
      await Promise.all(
        accounts.map((account: any) =>
          refreshBalance(account.address).catch((err: any) =>
            console.warn('Balance refresh failed post-connect', err)
          )
        )
      );

      if (onConnect) {
        onConnect(accounts);
      }
    } catch (error: any) {
      console.error('Wallet connection error:', error);
      walletStore.setError(error.message || 'Failed to connect wallet');
      
      if (onError) {
        onError(error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, startAuthorization, finalizeAuthorization, refreshBalance, onConnect, onError, walletStore]);

  const isConnected = linkedWallets.length > 0;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      disabled={isLoading || isConnected}
      onPress={handleConnect}
      testID={testID}
    >
      <LinearGradient
        colors={['#9333EA', '#7E22CE', '#6B21A8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.button}
      >
        <View style={styles.buttonContent}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Feather name="link-2" size={14} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>
                {isConnected ? 'Connected' : 'Connect Wallet'}
              </Text>
            </>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    minWidth: 140,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});