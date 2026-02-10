import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';

// Mock data for NFTs
const mockNFTs = [
  {
    id: '1',
    name: 'Solana Monkey Business',
    description: 'Limited edition NFT collection on Solana',
    price: 2.5,
    image: '🖼️',
  },
  {
    id: '2',
    name: 'Degenerate Ape Academy',
    description: 'Popular NFT collection with unique traits',
    price: 1.8,
    image: '🐒',
  },
  {
    id: '3',
    name: 'Star Atlas',
    description: 'Space exploration metaverse NFTs',
    price: 3.2,
    image: '🚀',
  },
];

// Mock data for DeFi projects
const mockDeFiProjects = [
  {
    id: '1',
    name: 'Raydium',
    description: 'AMM and liquidity provider on Solana',
    tvl: 1200000000,
    apr: 15.5,
    logo: '💎',
  },
  {
    id: '2',
    name: 'Serum',
    description: 'Decentralized exchange on Solana',
    tvl: 800000000,
    apr: 12.3,
    logo: '💧',
  },
  {
    id: '3',
    name: 'Marinade Finance',
    description: 'Liquid staking solution for Solana',
    tvl: 600000000,
    apr: 7.8,
    logo: '🧂',
  },
];

// Mock data for DApps
const mockDApps = [
  {
    id: '1',
    name: 'Magic Eden',
    description: 'NFT marketplace for Solana',
    category: 'NFT Marketplace',
    logo: '🪄',
  },
  {
    id: '2',
    name: 'StepN',
    description: 'Move-to-earn fitness app',
    category: 'Fitness',
    logo: '👟',
  },
  {
    id: '3',
    name: 'Solanart',
    description: 'Digital art marketplace',
    category: 'NFT Marketplace',
    logo: '🎨',
  },
];

const ExploreScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate data refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  const handleNFTDetail = (nftId: string) => {
    navigation.navigate('NFTDetail', { nftId });
  };

  const handleProjectDetail = (projectId: string) => {
    navigation.navigate('ProjectDetail', { projectId });
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
          colors={['#7F56D9']}
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.nftScrollContainer}
        >
          {mockNFTs.map((nft) => (
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
      </View>

      {/* DeFi Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top DeFi Projects</Text>
        {mockDeFiProjects.map((project) => (
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
                <Text style={styles.projectDescription}>{project.description}</Text>
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
        ))}
      </View>

      {/* DApps Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Popular DApps</Text>
        {mockDApps.map((dapp) => (
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
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1221',
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 48,
  },
  searchContainer: {
    marginBottom: 24,
  },
  searchInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  nftScrollContainer: {
    paddingRight: 24,
  },
  nftCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    padding: 16,
    marginRight: 12,
    width: 200,
    alignItems: 'center',
  },
  nftImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  nftImageEmoji: {
    fontSize: 48,
  },
  nftName: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
    textAlign: 'center',
  },
  nftPrice: {
    color: '#7F56D9',
    fontWeight: '600',
    fontSize: 14,
  },
  projectCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  projectHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  projectLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  projectLogoEmoji: {
    fontSize: 24,
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 4,
  },
  projectDescription: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  projectStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  projectStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectStatLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginRight: 4,
  },
  projectStatValue: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  dappCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  dappHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  dappLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dappLogoEmoji: {
    fontSize: 24,
  },
  dappInfo: {
    flex: 1,
  },
  dappName: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 4,
  },
  dappDescription: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  dappCategory: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(127, 86, 217, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(127, 86, 217, 0.4)',
  },
  dappCategoryText: {
    color: '#7F56D9',
    fontSize: 11,
    fontWeight: '600',
  },
});

export default ExploreScreen;