import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { authorizationApi } from '../services/authorizationService';
import { formatAddress, formatSignature } from '../utils/format';

// Mock data for transactions
const mockTransactions = [
  {
    id: '1',
    signature: '23456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01',
    source: 'Hp7b8rDM3nxxBUjaN49JWZaw1rgPrrWEZeMpi2TShN8b',
    destination: '9vMJfxuKxXBoEa7rM123456789abcdef0123456789abcdef0123456789abcdef01',
    amount: 0.5,
    status: 'success',
    timestamp: new Date().toISOString(),
  },
  {
    id: '2',
    signature: '3456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef012',
    source: '9vMJfxuKxXBoEa7rM123456789abcdef0123456789abcdef0123456789abcdef01',
    destination: 'Hp7b8rDM3nxxBUjaN49JWZaw1rgPrrWEZeMpi2TShN8b',
    amount: 1.2,
    status: 'success',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    signature: '456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123',
    source: 'Hp7b8rDM3nxxBUjaN49JWZaw1rgPrrWEZeMpi2TShN8b',
    destination: '8cY4m7P9QrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWxYz',
    amount: 0.3,
    status: 'pending',
    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
];

// Mock data for authorizations
const mockAuthorizations = [
  {
    id: '1',
    walletAddress: 'Hp7b8rDM3nxxBUjaN49JWZaw1rgPrrWEZeMpi2TShN8b',
    walletName: 'Phantom',
    method: 'silent',
    status: 'fresh',
    timestamp: new Date().toISOString(),
  },
  {
    id: '2',
    walletAddress: 'Hp7b8rDM3nxxBUjaN49JWZaw1rgPrrWEZeMpi2TShN8b',
    walletName: 'Phantom',
    method: 'prompted',
    status: 'fresh',
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const ActivityScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'transactions' | 'authorizations'>('transactions');
  const [transactions, setTransactions] = useState(mockTransactions);
  const [authorizations, setAuthorizations] = useState(mockAuthorizations);

  React.useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setLoading(false);
    }, 1500);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Simulate data refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  const handleTransactionDetail = (signature: string) => {
    navigation.navigate('TransactionDetail', { signature });
  };

  const handleAuthorizationDetail = (authorizationId: string) => {
    navigation.navigate('AuthorizationDetail', { authorizationId });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7F56D9" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'transactions' && styles.activeTab,
          ]}
          onPress={() => setActiveTab('transactions')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'transactions' && styles.activeTabText,
            ]}
          >
            Transactions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'authorizations' && styles.activeTab,
          ]}
          onPress={() => setActiveTab('authorizations')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'authorizations' && styles.activeTabText,
            ]}
          >
            Authorizations
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#7F56D9"
            colors={['#7F56D9']}
          />
        }
      >
        {activeTab === 'transactions' ? (
          <View style={styles.section}>
            {transactions.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No transactions found</Text>
              </View>
            ) : (
              transactions.map((transaction) => (
                <TouchableOpacity
                  key={transaction.id}
                  style={styles.transactionCard}
                  onPress={() => handleTransactionDetail(transaction.signature)}
                >
                  <View style={styles.transactionHeader}>
                    <Text style={styles.transactionSignature}>
                      {formatSignature(transaction.signature)}
                    </Text>
                    <View
                      style={[
                        styles.transactionStatus,
                        transaction.status === 'success'
                          ? styles.transactionStatusSuccess
                          : styles.transactionStatusPending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.transactionStatusText,
                          transaction.status === 'success'
                            ? styles.transactionStatusTextSuccess
                            : styles.transactionStatusTextPending,
                        ]}
                      >
                        {transaction.status}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionAmount}>
                      {transaction.source === 'Hp7b8rDM3nxxBUjaN49JWZaw1rgPrrWEZeMpi2TShN8b'
                        ? `- ${transaction.amount} SOL`
                        : `+ ${transaction.amount} SOL`}
                    </Text>
                    <Text style={styles.transactionAddress}>
                      {transaction.source === 'Hp7b8rDM3nxxBUjaN49JWZaw1rgPrrWEZeMpi2TShN8b'
                        ? `To: ${formatAddress(transaction.destination)}`
                        : `From: ${formatAddress(transaction.source)}`}
                    </Text>
                  </View>
                  <Text style={styles.transactionTimestamp}>
                    {new Date(transaction.timestamp).toLocaleString()}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : (
          <View style={styles.section}>
            {authorizations.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  No authorization events found
                </Text>
              </View>
            ) : (
              authorizations.map((authorization) => (
                <TouchableOpacity
                  key={authorization.id}
                  style={styles.authorizationCard}
                  onPress={() => handleAuthorizationDetail(authorization.id)}
                >
                  <View style={styles.authorizationHeader}>
                    <Text style={styles.authorizationWallet}>
                      {authorization.walletName || formatAddress(authorization.walletAddress)}
                    </Text>
                    <View
                      style={[
                        styles.authorizationStatus,
                        authorization.status === 'fresh'
                          ? styles.authorizationStatusFresh
                          : styles.authorizationStatusStale,
                      ]}
                    >
                      <Text
                        style={[
                          styles.authorizationStatusText,
                          authorization.status === 'fresh'
                            ? styles.authorizationStatusTextFresh
                            : styles.authorizationStatusTextStale,
                        ]}
                      >
                        {authorization.status}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.authorizationInfo}>
                    <Text style={styles.authorizationMethod}>
                      Method: {authorization.method}
                    </Text>
                    <Text style={styles.authorizationAddress}>
                      {formatAddress(authorization.walletAddress)}
                    </Text>
                  </View>
                  <Text style={styles.authorizationTimestamp}>
                    {new Date(authorization.timestamp).toLocaleString()}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1221',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0B1221',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#7F56D9',
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#7F56D9',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 24,
  },
  emptyState: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginTop: 24,
  },
  emptyStateText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
  },
  transactionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transactionSignature: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    flex: 1,
  },
  transactionStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  transactionStatusSuccess: {
    backgroundColor: 'rgba(0, 255, 179, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 179, 0.4)',
  },
  transactionStatusPending: {
    backgroundColor: 'rgba(255, 204, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 204, 0, 0.4)',
  },
  transactionStatusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  transactionStatusTextSuccess: {
    color: '#00FFB3',
  },
  transactionStatusTextPending: {
    color: '#FFCC00',
  },
  transactionInfo: {
    marginBottom: 8,
  },
  transactionAmount: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 4,
  },
  transactionAddress: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  transactionTimestamp: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
  },
  authorizationCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  authorizationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  authorizationWallet: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    flex: 1,
  },
  authorizationStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  authorizationStatusFresh: {
    backgroundColor: 'rgba(127, 86, 217, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(127, 86, 217, 0.4)',
  },
  authorizationStatusStale: {
    backgroundColor: 'rgba(255, 77, 77, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 77, 0.4)',
  },
  authorizationStatusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  authorizationStatusTextFresh: {
    color: '#7F56D9',
  },
  authorizationStatusTextStale: {
    color: '#FF4D4D',
  },
  authorizationInfo: {
    marginBottom: 8,
  },
  authorizationMethod: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 4,
  },
  authorizationAddress: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  authorizationTimestamp: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
  },
});

export default ActivityScreen;