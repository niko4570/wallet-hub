import { AggregatedPortfolio, SessionKey } from '@wallethub/contracts';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const formatUsd = (value: number) => `$${value.toFixed(2)}`;

const fetchJson = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, init);
  if (!response.ok) {
    const errorPayload = await response.text();
    throw new Error(errorPayload || 'API error');
  }
  return response.json() as Promise<T>;
};

export default function App() {
  const [portfolio, setPortfolio] = useState<AggregatedPortfolio | null>(null);
  const [sessions, setSessions] = useState<SessionKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [portfolioResponse, sessionResponse] = await Promise.all([
        fetchJson<AggregatedPortfolio>('/wallets'),
        fetchJson<SessionKey[]>('/session'),
      ]);
      setPortfolio(portfolioResponse);
      setSessions(sessionResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleIssueSessionKey = useCallback(async () => {
    if (!portfolio?.wallets.length) {
      return;
    }

    const primaryWallet = portfolio.wallets[0];
    await fetchJson<SessionKey>('/session/issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: primaryWallet.address,
        devicePublicKey: 'demo-device-public-key',
        expiresInMinutes: 60,
        scopes: [
          {
            name: 'transfer',
            maxUsd: 500,
          },
        ],
        metadata: {
          device: 'Saga Pro devkit',
        },
      }),
    });
    await loadData();
  }, [portfolio, loadData]);

  const handleRevokeSessionKey = useCallback(
    async (id: string) => {
      await fetchJson(`/session/${id}`, {
        method: 'DELETE',
      });
      await loadData();
    },
    [loadData],
  );

  const totalWalletsValue = useMemo(() => portfolio?.totalUsdValue ?? 0, [portfolio]);

  const renderContent = () => {
    if (loading) {
      return (
        <SafeAreaView style={styles.centered}>
          <ActivityIndicator size="large" color="#4B8BF5" />
          <Text style={styles.loadingText}>Syncing WalletHub data...</Text>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
        >
        <Text style={styles.title}>WalletHub Control Center</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Total Portfolio Value</Text>
          <Text style={styles.heroValue}>{formatUsd(totalWalletsValue)}</Text>
          <Text style={styles.heroSubtext}>
            {portfolio?.change24hPercent ?? 0}% vs. 24h · {portfolio?.wallets.length ?? 0} linked wallets
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Wallet Aggregation</Text>
            <Text style={styles.sectionSubtitle}>Multi-wallet overview</Text>
          </View>
          {portfolio?.wallets.map((wallet) => (
            <View key={wallet.address} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{wallet.label ?? wallet.address.slice(0, 6)}</Text>
                <Text style={styles.badge}>{wallet.provider}</Text>
              </View>
              <Text style={styles.cardValue}>{formatUsd(wallet.totalUsdValue)}</Text>
              <Text style={styles.cardMeta}>
                Share {wallet.shareOfPortfolio}% · Session keys {wallet.sessionKeyIds.length}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Session Keys</Text>
            <Text style={styles.sectionSubtitle}>Policy-aware signing</Text>
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={handleIssueSessionKey}>
            <Text style={styles.primaryButtonText}>Issue session key</Text>
          </TouchableOpacity>
          {sessions.map((session) => (
            <View key={session.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{session.metadata?.device ?? 'Unknown device'}</Text>
                <Text style={[styles.badge, session.status !== 'active' && styles.badgeMuted]}>
                  {session.status.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.cardMeta}>Expires {new Date(session.expiresAt).toLocaleString()}</Text>
              <Text style={styles.cardMeta}>Scopes: {session.scopes.map((scope) => scope.name).join(', ')}</Text>
              {session.status === 'active' ? (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => handleRevokeSessionKey(session.id)}
                >
                  <Text style={styles.secondaryButtonText}>Revoke</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </View>
        </ScrollView>
      </SafeAreaView>
    );
  };

  return <SafeAreaProvider>{renderContent()}</SafeAreaProvider>;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#050914',
  },
  scrollContent: {
    padding: 20,
    gap: 20,
    paddingBottom: 80,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: 'white',
  },
  heroCard: {
    backgroundColor: '#11182b',
    padding: 20,
    borderRadius: 16,
  },
  heroLabel: {
    color: '#8EA4FF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  heroValue: {
    color: 'white',
    fontSize: 32,
    fontWeight: '700',
    marginTop: 8,
  },
  heroSubtext: {
    color: '#9aa6c5',
    marginTop: 8,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  sectionSubtitle: {
    color: '#9aa6c5',
  },
  card: {
    backgroundColor: '#121a31',
    padding: 16,
    borderRadius: 14,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  badge: {
    color: '#8EA4FF',
    borderWidth: 1,
    borderColor: '#1F2A44',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  badgeMuted: {
    color: '#9aa6c5',
  },
  cardValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  cardMeta: {
    color: '#9aa6c5',
    fontSize: 13,
  },
  primaryButton: {
    backgroundColor: '#4B8BF5',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 8,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#263659',
  },
  secondaryButtonText: {
    color: '#9aa6c5',
    fontWeight: '600',
  },
  errorText: {
    color: '#ff7a7a',
    backgroundColor: '#2a0f15',
    padding: 10,
    borderRadius: 10,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050914',
    gap: 12,
  },
  loadingText: {
    color: '#9aa6c5',
  },
});
