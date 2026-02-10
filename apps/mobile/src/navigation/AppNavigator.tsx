import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

// Import screens
import WalletScreen from "../screens/WalletScreen";
import ExploreScreen from "../screens/ExploreScreen";
import ActivityScreen from "../screens/ActivityScreen";
import SettingsScreen from "../screens/SettingsScreen";

// Import types
export type RootStackParamList = {
  MainTabs: undefined;
  TransactionDetail: { signature: string };
  NFTDetail: { nftId: string };
  ProjectDetail: { projectId: string };
  AuthorizationDetail: { authorizationId: string };
};

export type MainTabParamList = {
  Wallet: undefined;
  Explore: undefined;
  Activity: undefined;
  Settings: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Tab Navigator component
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: "#C7B5FF",
        tabBarInactiveTintColor: "rgba(255, 255, 255, 0.5)",
        tabBarStyle: {
          backgroundColor: "rgba(7, 10, 20, 0.9)",
          borderTopColor: "rgba(255, 255, 255, 0.06)",
          borderTopWidth: 1,
          paddingBottom: 6,
          paddingTop: 6,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
        headerStyle: {
          backgroundColor: "#0B1221",
          borderBottomColor: "rgba(255, 255, 255, 0.1)",
          borderBottomWidth: 1,
        },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: {
          fontWeight: "700",
          fontSize: 18,
        },
      }}
    >
      <Tab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{
          title: "Wallet",
          tabBarIcon: ({ color, size }) => (
            <Feather name="credit-card" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
          title: "Explore",
          tabBarIcon: ({ color, size }) => (
            <Feather name="compass" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Activity"
        component={ActivityScreen}
        options={{
          title: "Activity",
          tabBarIcon: ({ color, size }) => (
            <Feather name="activity" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Feather name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Root Stack Navigator
function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: "#0B1221",
            borderBottomColor: "rgba(255, 255, 255, 0.1)",
            borderBottomWidth: 1,
          },
          headerTintColor: "#FFFFFF",
          headerTitleStyle: {
            fontWeight: "700",
            fontSize: 18,
          },
        }}
      >
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="TransactionDetail"
          component={TransactionDetailScreen}
          options={{ title: "Transaction Detail" }}
        />
        <Stack.Screen
          name="NFTDetail"
          component={NFTDetailScreen}
          options={{ title: "NFT Detail" }}
        />
        <Stack.Screen
          name="ProjectDetail"
          component={ProjectDetailScreen}
          options={{ title: "Project Detail" }}
        />
        <Stack.Screen
          name="AuthorizationDetail"
          component={AuthorizationDetailScreen}
          options={{ title: "Authorization Detail" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Placeholder screens for detail pages
function TransactionDetailScreen({ route }: any) {
  const { signature } = route.params;
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#0B1221",
      }}
    >
      <Text style={{ color: "#FFFFFF" }}>Transaction Detail: {signature}</Text>
    </View>
  );
}

function NFTDetailScreen({ route }: any) {
  const { nftId } = route.params;
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#0B1221",
      }}
    >
      <Text style={{ color: "#FFFFFF" }}>NFT Detail: {nftId}</Text>
    </View>
  );
}

function ProjectDetailScreen({ route }: any) {
  const { projectId } = route.params;
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#0B1221",
      }}
    >
      <Text style={{ color: "#FFFFFF" }}>Project Detail: {projectId}</Text>
    </View>
  );
}

function AuthorizationDetailScreen({ route }: any) {
  const { authorizationId } = route.params;
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#0B1221",
      }}
    >
      <Text style={{ color: "#FFFFFF" }}>
        Authorization Detail: {authorizationId}
      </Text>
    </View>
  );
}

export default AppNavigator;
