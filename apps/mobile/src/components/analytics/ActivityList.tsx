import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { WalletActivity } from '../../types/wallet';
import { formatAddress, formatAmount } from '../../utils/format';

interface ActivityListProps {
  data: WalletActivity[];
  title?: string;
  height?: number;
  onActivityPress?: (activity: WalletActivity) => void;
}

export const ActivityList: React.FC<ActivityListProps> = ({ 
  data, 
  title = 'Recent Activity', 
  height = 300, 
  onActivityPress 
}) => {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.emptyState}>
          <Feather name="activity" size={24} color="rgba(255, 255, 255, 0.3)" />
          <Text style={styles.emptyText}>No recent activity</Text>
        </View>
      </View>
    );
  }

  const renderActivityItem = (
    item: WalletActivity,
    isLast: boolean,
    key: string,
  ) => {
    const getDirectionIcon = () => {
      switch (item.direction) {
        case 'in':
          return <Feather name="arrow-down-left" size={16} color="#9CFFDA" />;
        case 'out':
          return <Feather name="arrow-up-right" size={16} color="#F43F5E" />;
        default:
          return <Feather name="refresh-cw" size={16} color="#6366F1" />;
      }
    };

    const getDirectionColor = () => {
      switch (item.direction) {
        case 'in':
          return '#9CFFDA';
        case 'out':
          return '#F43F5E';
        default:
          return '#6366F1';
      }
    };

    const getActivityLabel = () => {
      if (item.description) {
        return item.description;
      }
      switch (item.type) {
        case 'transfer':
          return item.direction === 'in' ? 'Received' : 'Sent';
        case 'swap':
          return 'Swap';
        case 'mint':
          return 'Mint';
        case 'burn':
          return 'Burn';
        default:
          return item.type.charAt(0).toUpperCase() + item.type.slice(1);
      }
    };

    return (
      <TouchableOpacity
        key={key}
        style={[styles.activityItem, isLast && styles.lastItem]}
        onPress={() => onActivityPress?.(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.activityIcon, { backgroundColor: `${getDirectionColor()}20` }]}>
          {getDirectionIcon()}
        </View>
        <View style={styles.activityContent}>
          <View style={styles.activityHeader}>
            <Text style={styles.activityLabel}>{getActivityLabel()}</Text>
            <Text style={styles.activityTimestamp}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          {item.amount && (
            <Text style={[styles.activityAmount, { color: getDirectionColor() }]}>
              {item.direction === 'out' ? '-' : '+'} {formatAmount(item.amount)}
              {item.mint && ` ${item.mint.substring(0, 4)}...`}
            </Text>
          )}
          {item.fee && (
            <Text style={styles.activityFee}>Fee: {formatAmount(item.fee)} SOL</Text>
          )}
          {item.source && (
            <Text style={styles.activitySource}>
              {formatAddress(item.source)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { height }]}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.listContent}>
        {data.map((item, index) => {
          const key =
            item.signature ?? `${item.timestamp}-${item.type}-${index}`;
          return renderActivityItem(item, index === data.length - 1, key);
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 12,
  },
  listContent: {
    gap: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: {
    flex: 1,
    gap: 4,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  activityTimestamp: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
  },
  activityAmount: {
    fontWeight: '700',
    fontSize: 13,
  },
  activityFee: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
  },
  activitySource: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    marginTop: 2,
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
  },
});
