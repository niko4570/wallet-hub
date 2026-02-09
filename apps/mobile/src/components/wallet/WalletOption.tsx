import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { IconLoader } from '../common/IconLoader';
import { DetectedWalletApp } from '../../types/wallet';

interface WalletOptionProps {
  wallet: DetectedWalletApp;
  disabled?: boolean;
  loading?: boolean;
  onPress: (wallet: DetectedWalletApp) => void;
}

export const WalletOption: React.FC<WalletOptionProps> = ({
  wallet,
  disabled = false,
  loading = false,
  onPress,
}) => {
  const isInstalled = wallet.installed;
  const isFallback = wallet.detectionMethod === 'fallback';

  return (
    <TouchableOpacity
      style={[
        styles.container,
        (!isInstalled && !isFallback) && styles.disabled,
        disabled && styles.disabled,
      ]}
      disabled={disabled || loading}
      onPress={() => onPress(wallet)}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <IconLoader walletId={wallet.id} size={40} />
      </View>
      
      <View style={styles.infoContainer}>
        <Text style={styles.name}>{wallet.name}</Text>
        {wallet.subtitle && (
          <Text style={styles.subtitle}>{wallet.subtitle}</Text>
        )}
      </View>
      
      <View style={styles.statusContainer}>
        <Text style={[
          styles.status,
          isInstalled ? styles.installed : styles.notInstalled,
        ]}>
          {isInstalled ? 'Installed' : 'Not detected'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  disabled: {
    opacity: 0.4,
  },
  iconContainer: {
    marginRight: 16,
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  statusContainer: {
    marginLeft: 12,
  },
  status: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  installed: {
    color: '#8EA4FF',
  },
  notInstalled: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
});
