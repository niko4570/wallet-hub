import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/AppNavigator";

// Type definitions
interface NFT {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
}

interface DeFiProject {
  id: string;
  name: string;
  description: string;
  tvl: number;
  apr: number;
  logo: string;
}

interface DApp {
  id: string;
  name: string;
  description: string;
  category: string;
  logo: string;
}

const ExploreScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [nfts] = useState<NFT[]>([]);
  const [defiProjects] = useState<DeFiProject[]>([]);
  const [dapps] = useState<DApp[]>([]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate data refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  const handleNFTDetail = (nftId: string) => {
    navigation.navigate("NFTDetail", { nftId });
  };

  const handleProjectDetail = (projectId: string) => {
    navigation.navigate("ProjectDetail", { projectId });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#7F56D9"
          colors={["#7F56D9"]}
        />
      }
    >
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search NFTs, DeFi, DApps..."
          placeholderTextColor="rgba(255, 255, 255, 0.6)"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Trending Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trending NFTs</Text>
        {nfts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No NFTs yet</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.nftScrollContainer}
          >
            {nfts.map((nft) => (
              <TouchableOpacity
                key={nft.id}
                style={styles.nftCard}
                onPress={() => handleNFTDetail(nft.id)}
              >
                <View style={styles.nftImage}>
                  <Text style={styles.nftImageEmoji}>{nft.image}</Text>
                </View>
                <Text style={styles.nftName}>{nft.name}</Text>
                <Text style={styles.nftPrice}>{nft.price} SOL</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* DeFi Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top DeFi Projects</Text>
        {defiProjects.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No DeFi projects yet</Text>
          </View>
        ) : (
          defiProjects.map((project) => (
            <TouchableOpacity
              key={project.id}
              style={styles.projectCard}
              onPress={() => handleProjectDetail(project.id)}
            >
              <View style={styles.projectHeader}>
                <View style={styles.projectLogo}>
                  <Text style={styles.projectLogoEmoji}>{project.logo}</Text>
                </View>
                <View style={styles.projectInfo}>
                  <Text style={styles.projectName}>{project.name}</Text>
                  <Text style={styles.projectDescription}>
                    {project.description}
                  </Text>
                </View>
              </View>
              <View style={styles.projectStats}>
                <View style={styles.projectStat}>
                  <Text style={styles.projectStatLabel}>TVL</Text>
                  <Text style={styles.projectStatValue}>
                    ${(project.tvl / 1000000).toFixed(0)}M
                  </Text>
                </View>
                <View style={styles.projectStat}>
                  <Text style={styles.projectStatLabel}>APR</Text>
                  <Text style={styles.projectStatValue}>{project.apr}%</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* DApps Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Popular DApps</Text>
        {dapps.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No dapps yet</Text>
          </View>
        ) : (
          dapps.map((dapp) => (
            <TouchableOpacity key={dapp.id} style={styles.dappCard}>
              <View style={styles.dappHeader}>
                <View style={styles.dappLogo}>
                  <Text style={styles.dappLogoEmoji}>{dapp.logo}</Text>
                </View>
                <View style={styles.dappInfo}>
                  <Text style={styles.dappName}>{dapp.name}</Text>
                  <Text style={styles.dappDescription}>{dapp.description}</Text>
                </View>
              </View>
              <View style={styles.dappCategory}>
                <Text style={styles.dappCategoryText}>{dapp.category}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1221",
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 48,
  },
  searchContainer: {
    marginBottom: 24,
  },
  searchInput: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#FFFFFF",
    fontSize: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  nftScrollContainer: {
    paddingRight: 24,
  },
  nftCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 20,
    padding: 16,
    marginRight: 12,
    width: 200,
    alignItems: "center",
  },
  nftImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  nftImageEmoji: {
    fontSize: 48,
  },
  nftName: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 4,
    textAlign: "center",
  },
  nftPrice: {
    color: "#7F56D9",
    fontWeight: "600",
    fontSize: 14,
  },
  projectCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  projectHeader: {
    flexDirection: "row",
    marginBottom: 12,
  },
  projectLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  projectLogoEmoji: {
    fontSize: 24,
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 4,
  },
  projectDescription: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 14,
  },
  projectStats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  projectStat: {
    flexDirection: "row",
    alignItems: "center",
  },
  projectStatLabel: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
    marginRight: 4,
  },
  projectStatValue: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  dappCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  dappHeader: {
    flexDirection: "row",
    marginBottom: 12,
  },
  dappLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  dappLogoEmoji: {
    fontSize: 24,
  },
  dappInfo: {
    flex: 1,
  },
  dappName: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 4,
  },
  dappDescription: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 14,
  },
  dappCategory: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(127, 86, 217, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(127, 86, 217, 0.4)",
  },
  dappCategoryText: {
    color: "#7F56D9",
    fontSize: 11,
    fontWeight: "600",
  },
  emptyState: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
  },
  emptyStateText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 14,
  },
});

export default ExploreScreen;
