import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import LoginScreen from "../screens/LoginScreen";
import OrdersScreen from "../screens/OrdersScreen";
import CreateOrderScreen from "../screens/CreateOrderScreen";
import ProfileScreen from "../screens/ProfileScreen";
import { colors, radii } from "../theme";

const AuthStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

export function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

export function MainNavigator() {
  const iconMap = {
    Orders: "clipboard-list-outline",
    CreateOrder: "plus-circle-outline",
    Profile: "account-circle-outline",
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTitleStyle: {
          color: colors.text,
          fontWeight: "700",
        },
        headerTintColor: colors.text,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          height: 66,
          borderTopWidth: 0,
          backgroundColor: colors.surface,
          borderTopLeftRadius: radii.lg,
          borderTopRightRadius: radii.lg,
          paddingBottom: 8,
          paddingTop: 8,
          position: "absolute",
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
        tabBarIcon: ({ color, size, focused }) => (
          <MaterialCommunityIcons
            name={focused ? iconMap[route.name].replace("-outline", "") : iconMap[route.name]}
            size={size}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="Orders" component={OrdersScreen} options={{ title: "Siparislerim" }} />
      <Tab.Screen name="CreateOrder" component={CreateOrderScreen} options={{ title: "Yeni Siparis" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "Profil" }} />
    </Tab.Navigator>
  );
}
