import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { WalletActivity } from "../../types/wallet";
import { formatAddress, formatAmount } from "../../utils";

interface ActivityListProps {
  data: WalletActivity[];
  title?: string;
  height?: number;
  onActivityPress?: (activity: WalletActivity) => void;
}

export const ActivityList: React.FC<ActivityListProps> = ({
  data,
  title = "Recent Activity",
  height = 300,
  onActivityPress,
}) => {
  // Get screen dimensions for responsive design
  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
  const isTablet = screenWidth >= 768;
  const isDesktop = screenWidth >= 1024;

  // Responsive height
  const responsiveHeight = isDesktop ? 400 : isTablet ? 350 : height;

  // Responsive font sizes
  const titleFontSize = isDesktop ? 16 : isTablet ? 15 : 14;
  const activityLabelFontSize = isDesktop ? 16 : isTablet ? 15 : 14;
  const activityAmountFontSize = isDesktop ? 15 : isTablet ? 14 : 13;
  const activityTimestampFontSize = isDesktop ? 13 : isTablet ? 12 : 11;
  const activityFeeFontSize = isDesktop ? 13 : isTablet ? 12 : 11;
  const activitySourceFontSize = isDesktop ? 13 : isTablet ? 12 : 11;
  const emptyTextFontSize = isDesktop ? 14 : isTablet ? 13 : 12;

  // Responsive padding and spacing
  const containerPadding = isDesktop ? 24 : isTablet ? 20 : 16;
  const titleMarginBottom = isDesktop ? 16 : isTablet ? 14 : 12;
  const listGap = isDesktop ? 16 : isTablet ? 14 : 12;
  const activityItemPadding = isDesktop ? 16 : isTablet ? 14 : 12;
  const activityIconSize = isDesktop ? 48 : isTablet ? 44 : 40;
  const activityIconMarginRight = isDesktop ? 16 : isTablet ? 14 : 12;
  if (!data || data.length === 0) {
    return (
      <View
        style={[
          styles.container,
          {
            height: responsiveHeight,
            padding: containerPadding,
            borderRadius: isDesktop ? 24 : isTablet ? 20 : 16,
          },
        ]}
      >
        <Text
          style={[
            styles.title,
            { fontSize: titleFontSize, marginBottom: titleMarginBottom },
          ]}
        >
          {title}
        </Text>
        <View style={styles.emptyState}>
          <Feather
            name="activity"
            size={isDesktop ? 32 : isTablet ? 28 : 24}
            color="rgba(255, 255, 255, 0.3)"
          />
          <Text style={[styles.emptyText, { fontSize: emptyTextFontSize }]}>
            No recent activity
          </Text>
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
      const iconSize = isDesktop ? 20 : isTablet ? 18 : 16;
      switch (item.direction) {
        case "in":
          return (
            <Feather name="arrow-down-left" size={iconSize} color="#9CFFDA" />
          );
        case "out":
          return (
            <Feather name="arrow-up-right" size={iconSize} color="#F43F5E" />
          );
        default:
          return <Feather name="refresh-cw" size={iconSize} color="#6366F1" />;
      }
    };

    const getDirectionColor = () => {
      switch (item.direction) {
        case "in":
          return "#9CFFDA";
        case "out":
          return "#F43F5E";
        default:
          return "#6366F1";
      }
    };

    const getActivityLabel = () => {
      if (item.description) {
        return item.description;
      }
      switch (item.type) {
        case "transfer":
          return item.direction === "in" ? "Received" : "Sent";
        case "swap":
          return "Swap";
        case "mint":
          return "Mint";
        case "burn":
          return "Burn";
        default:
          return item.type.charAt(0).toUpperCase() + item.type.slice(1);
      }
    };

    return (
      <TouchableOpacity
        key={key}
        style={[
          styles.activityItem,
          isLast && styles.lastItem,
          {
            paddingVertical: activityItemPadding,
            gap: activityIconMarginRight,
          },
        ]}
        onPress={() => onActivityPress?.(item)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.activityIcon,
            {
              backgroundColor: `${getDirectionColor()}20`,
              width: activityIconSize,
              height: activityIconSize,
              borderRadius: isDesktop ? 16 : isTablet ? 14 : 12,
            },
          ]}
        >
          {getDirectionIcon()}
        </View>
        <View style={styles.activityContent}>
          <View style={styles.activityHeader}>
            <Text
              style={[
                styles.activityLabel,
                { fontSize: activityLabelFontSize },
              ]}
            >
              {getActivityLabel()}
            </Text>
            <Text
              style={[
                styles.activityTimestamp,
                { fontSize: activityTimestampFontSize },
              ]}
            >
              {new Date(item.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
          {item.amount && (
            <Text
              style={[
                styles.activityAmount,
                {
                  color: getDirectionColor(),
                  fontSize: activityAmountFontSize,
                },
              ]}
            >
              {item.direction === "out" ? "-" : "+"} {formatAmount(item.amount)}
              {item.mint && ` ${item.mint.substring(0, 4)}...`}
            </Text>
          )}
          {item.fee && (
            <Text
              style={[styles.activityFee, { fontSize: activityFeeFontSize }]}
            >
              Fee: {formatAmount(item.fee)} SOL
            </Text>
          )}
          {item.source && (
            <Text
              style={[
                styles.activitySource,
                { fontSize: activitySourceFontSize },
              ]}
            >
              {formatAddress(item.source)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          height: responsiveHeight,
          padding: containerPadding,
          borderRadius: isDesktop ? 24 : isTablet ? 20 : 16,
        },
      ]}
    >
      <Text
        style={[
          styles.title,
          { fontSize: titleFontSize, marginBottom: titleMarginBottom },
        ]}
      >
        {title}
      </Text>
      <View style={[styles.listContent, { gap: listGap }]}>
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
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  title: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 12,
  },
  listContent: {
    gap: 12,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  activityContent: {
    flex: 1,
    gap: 4,
  },
  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  activityLabel: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  activityTimestamp: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 11,
  },
  activityAmount: {
    fontWeight: "700",
    fontSize: 13,
  },
  activityFee: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 11,
  },
  activitySource: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 11,
    marginTop: 2,
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 12,
  },
});
